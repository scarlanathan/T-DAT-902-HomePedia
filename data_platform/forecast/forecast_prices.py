#!/usr/bin/env python3
"""Train the price forecast on app_price_history and write the app_price_forecast* tables.

Reads (dbt marts / core views): app_price_history, normalized_interest_rate_monthly, dim_departement.
Writes (owned by this job, not by dbt):
  app_price_forecast, app_price_forecast_summary, app_price_forecast_scenario,
  app_price_forecast_backtest, app_price_forecast_model

Usage:
  python forecast/forecast_prices.py [--database-url ...] [--horizon 8]

Environment:
  DATABASE_URL  PostgreSQL connection URI
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import psycopg
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from forecast import model as m  # noqa: E402
from forecast.scenarios import SCENARIOS, rate_delta_at  # noqa: E402

LEVELS = ("france", "region", "departement", "commune")
MIN_QUARTER_SALES = 5        # a quarter counts in a series only with at least this many sales
MIN_COMMUNE_ANNUAL_SALES = 40
PHI_GRID = (0.0, 0.3, 0.5, 0.7, 0.8, 0.9, 0.95, 1.0)
MIN_BACKTEST_ORIGIN = 7      # first origin index (8 quarters of history)
# Trend-fit window per level, chosen by backtest: aggregates react faster with 8 quarters,
# noisy commune medians need 12.
FIT_WINDOW_BY_LEVEL = {"france": 8, "region": 8, "departement": 8, "commune": 12}

METHOD = (
    "Tendance log-linéaire amortie, nette de l'effet des taux de crédit, estimée par "
    "moindres carrés pondérés (poids √ventes) sur les 8 derniers trimestres (12 pour les "
    "communes) ; pentes "
    "communales rétrécies vers celle du département (bayésien empirique), elles-mêmes "
    "rétrécies vers la région puis la France. Effet taux : élasticité estimée sur le panel "
    "départemental (variations sur 1 an, effets fixes), décalage de 2 trimestres ; "
    "saisonnalité trimestrielle estimée sur le même panel. "
    "Intervalles à 80 % : quantiles empiriques des erreurs de backtest à origine glissante "
    "par horizon et classe de volume."
)


# --------------------------------------------------------------------------- data


def _frame(conn: psycopg.Connection, sql: str) -> pd.DataFrame:
    with conn.cursor() as cur:
        cur.execute(sql)
        return pd.DataFrame(cur.fetchall(), columns=[c.name for c in cur.description])


def read_inputs(conn: psycopg.Connection) -> tuple[pd.DataFrame, pd.DataFrame, dict[str, str]]:
    hist = _frame(
        conn,
        """
        SELECT level, code, nom, code_departement, property_type, period_quarter,
               sale_count::float AS sale_count, median_price_per_sqm::float AS price
        FROM app_price_history
        """,
    )
    rates = _frame(
        conn,
        "SELECT rate_month, housing_loan_rate_pct::float AS rate FROM normalized_interest_rate_monthly ORDER BY rate_month",
    )
    dept = _frame(conn, "SELECT code_departement, code_region FROM dim_departement")
    return hist, rates, dict(zip(dept.code_departement, dept.code_region))


def quarter_start(d: date) -> date:
    return date(d.year, 3 * ((d.month - 1) // 3) + 1, 1)


def add_quarters(d: date, k: int) -> date:
    idx = d.year * 4 + (d.month - 1) // 3 + k
    return date(idx // 4, 3 * (idx % 4) + 1, 1)


def last_complete_quarter(hist: pd.DataFrame) -> date:
    """Drop trailing quarters whose national volume collapses (late DVF registrations)."""
    nat = (
        hist[(hist.level == "france") & (hist.property_type == "all")]
        .sort_values("period_quarter")
        .set_index("period_quarter")["sale_count"]
    )
    if nat.empty:
        raise ValueError("app_price_history has no national series; run dbt first")
    quarters = list(nat.index)
    while len(quarters) > 5:
        ref = float(np.median(nat.loc[quarters[-5:-1]]))
        if nat.loc[quarters[-1]] >= 0.6 * ref:
            break
        quarters.pop()
    return quarters[-1]


def quarterly_rates(
    rates: pd.DataFrame, first_q: date, last_q: date, scenario_key: str | None
) -> tuple[dict[date, float], float, date]:
    """Average rate per quarter. Months after the last observation follow the scenario path."""
    rates = rates.dropna()
    monthly = {pd.Timestamp(r).date().replace(day=1): float(v) for r, v in zip(rates.rate_month, rates.rate)}
    last_month = max(monthly)
    last_rate = monthly[last_month]
    scen = next((s for s in SCENARIOS if s.key == scenario_key), None)
    out: dict[date, float] = {}
    q = first_q
    while q <= last_q:
        vals = []
        for k in range(3):
            month = date(q.year, q.month + k, 1)
            if month in monthly:
                vals.append(monthly[month])
            elif month > last_month:
                delta = rate_delta_at(scen, month, last_month) if scen else 0.0
                vals.append(last_rate + delta)
        if vals:
            out[q] = float(np.mean(vals))
        q = add_quarters(q, 1)
    # Fill gaps before the series start with the earliest value.
    first_val = monthly[min(monthly)]
    q = first_q
    while q <= last_q:
        out.setdefault(q, first_val)
        q = add_quarters(q, 1)
    return out, last_rate, last_month


# --------------------------------------------------------------------------- panel


class Panel:
    def __init__(self, hist: pd.DataFrame, quarters: list[date], dept_region: dict[str, str]):
        self.quarters = quarters
        q_index = {q: i for i, q in enumerate(quarters)}
        hist = hist[hist.period_quarter.isin(q_index)]
        keys = (
            hist.groupby(["level", "code", "property_type"], sort=False)
            .agg(nom=("nom", "last"), code_departement=("code_departement", "last"))
            .reset_index()
        )
        keys["level_rank"] = keys.level.map({lv: i for i, lv in enumerate(LEVELS)})
        keys = keys.sort_values(["level_rank", "property_type", "code"]).reset_index(drop=True)
        self.keys = keys
        row_of = {(lv, c, pt): i for i, (lv, c, pt) in enumerate(zip(keys.level, keys.code, keys.property_type))}

        n_s, n_q = len(keys), len(quarters)
        self.log_price = np.full((n_s, n_q), np.nan)
        self.sales = np.zeros((n_s, n_q))
        rows = np.array([row_of[k] for k in zip(hist.level, hist.code, hist.property_type)])
        cols = np.array([q_index[q] for q in hist.period_quarter])
        self.sales[rows, cols] = hist.sale_count.to_numpy()
        price = hist.price.to_numpy()
        good = (hist.sale_count.to_numpy() >= MIN_QUARTER_SALES) & (price > 0)
        self.log_price[rows[good], cols[good]] = np.log(price[good])

        # Parent row per series (same property type): commune→dept→region→france.
        parent = np.full(n_s, -1)
        for i, (lv, c, pt, dep) in enumerate(zip(keys.level, keys.code, keys.property_type, keys.code_departement)):
            if lv == "commune":
                cand = [("departement", dep), ("france", "FR")]
            elif lv == "departement":
                cand = [("region", dept_region.get(c)), ("france", "FR")]
            elif lv == "region":
                cand = [("france", "FR")]
            else:
                cand = []
            for plv, pc in cand:
                j = row_of.get((plv, pc, pt))
                if j is not None:
                    parent[i] = j
                    break
        self.parent = parent
        self.level = keys.level.to_numpy()

    def annual_sales(self, origin: int) -> np.ndarray:
        return self.sales[:, max(0, origin - 3) : origin + 1].sum(axis=1)

    def eligible(self, origin: int) -> np.ndarray:
        """Series allowed to receive a forecast at this origin."""
        annual = self.annual_sales(origin)
        return (self.level != "commune") | (annual >= MIN_COMMUNE_ANNUAL_SALES)


def fit_at(panel: Panel, adj: np.ndarray, origin: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Fit trends at origin and shrink slopes top-down. Returns (level, slope*, ok)."""
    trend = m.Trend(*(np.full(len(panel.level), np.nan) for _ in range(3)), ok=np.zeros(len(panel.level), bool))
    for lv, window in FIT_WINDOW_BY_LEVEL.items():
        rows = panel.level == lv
        t = m.wls_trend(adj[rows], panel.sales[rows], origin, window)
        trend.level[rows], trend.slope[rows], trend.se[rows], trend.ok[rows] = t.level, t.slope, t.se, t.ok
    ok = trend.ok & panel.eligible(origin)
    slope_star = np.zeros(len(panel.level))
    for lv in LEVELS:
        rows = panel.level == lv
        if lv == "france":
            slope_star[rows] = np.where(ok[rows], trend.slope[rows], 0.0)
            continue
        par = panel.parent[rows]
        parent_slope = np.where(par >= 0, slope_star[np.maximum(par, 0)], 0.0)
        slope_star[rows] = m.shrink_slopes(trend.slope[rows], trend.se[rows], ok[rows], parent_slope, par)
    return trend.level, slope_star, ok


# --------------------------------------------------------------------------- backtest


def backtest(
    panel: Panel, adj: np.ndarray, rate_lag: np.ndarray, beta: float, season: np.ndarray, horizon: int, last: int
):
    """Rolling-origin backtest for each φ, conditional on realised rates."""
    actual = panel.log_price
    fits = {o: fit_at(panel, adj, o) for o in range(MIN_BACKTEST_ORIGIN, last)}
    results = {}
    for phi in PHI_GRID:
        ape = defaultdict(list)          # (level, h) -> APE model
        ape_naive = defaultdict(list)    # (level, h) -> APE naive
        log_err = defaultdict(list)      # (volume class, h) -> log errors
        for o, (level, slope, ok) in fits.items():
            hmax = min(horizon, last - o)
            effect = beta * rate_lag[None, o + 1 : o + 1 + hmax] + season[:, o + 1 : o + 1 + hmax]
            pred = m.project(level, slope, phi, effect)
            # Naive: average log price of the last 4 quarters, carried forward.
            window = actual[:, max(0, o - 3) : o + 1]
            cnt = np.isfinite(window).sum(axis=1)
            naive = np.where(cnt > 0, np.where(np.isfinite(window), window, 0).sum(axis=1) / np.maximum(cnt, 1), np.nan)
            vclass = m.volume_class(panel.annual_sales(o))
            for h in range(1, hmax + 1):
                y = actual[:, o + h]
                mask = ok & np.isfinite(y) & np.isfinite(pred[:, h - 1]) & np.isfinite(naive)
                e = y[mask] - pred[mask, h - 1]
                e_naive = y[mask] - naive[mask]
                for lv in LEVELS:
                    sel = panel.level[mask] == lv
                    ape[(lv, h)].extend(np.abs(np.expm1(-e[sel])).tolist())
                    ape_naive[(lv, h)].extend(np.abs(np.expm1(-e_naive[sel])).tolist())
                for c in np.unique(vclass[mask]):
                    log_err[(int(c), h)].extend(e[vclass[mask] == c].tolist())
        score = np.mean(
            [np.mean(ape[(lv, h)]) for lv in ("departement", "commune") for h in range(1, horizon + 1) if ape[(lv, h)]]
        )
        results[phi] = (score, ape, ape_naive, log_err)
    best_phi = min(results, key=lambda p: results[p][0])
    return best_phi, results[best_phi], fits


# --------------------------------------------------------------------------- main


def run(conn: psycopg.Connection, horizon: int) -> dict:
    hist, rates, dept_region = read_inputs(conn)
    hist["period_quarter"] = pd.to_datetime(hist.period_quarter).dt.date
    last_q = last_complete_quarter(hist)
    quarters = sorted(q for q in hist.period_quarter.unique() if q <= last_q)
    panel = Panel(hist, quarters, dept_region)
    last = len(quarters) - 1

    first_rate_q = add_quarters(quarters[0], -m.RATE_LAG)
    end_q = add_quarters(last_q, horizon)
    # Realised rates (no scenario: months after the last observation stay flat).
    realised, last_rate, last_rate_month = quarterly_rates(rates, first_rate_q, end_q, None)

    def lagged(rate_by_q: dict[date, float], n: int) -> np.ndarray:
        return np.array([rate_by_q[add_quarters(quarters[0], i - m.RATE_LAG)] for i in range(n)])

    rate_lag_hist = lagged(realised, len(quarters))
    dept_all = (panel.level == "departement") & (panel.keys.property_type.to_numpy() == "all")
    beta = m.estimate_rate_elasticity(panel.log_price[dept_all], rate_lag_hist)
    adj = panel.log_price - beta * rate_lag_hist[None, :]

    # Quarter-of-year effects per property type, estimated on the département panel.
    all_q = quarters + [add_quarters(last_q, h) for h in range(1, horizon + 1)]
    qoy = np.array([(q.month - 1) // 3 for q in all_q])
    ptype = panel.keys.property_type.to_numpy()
    season = np.zeros((len(ptype), len(all_q)))
    seasonal = {}
    for pt in np.unique(ptype):
        rows = (panel.level == "departement") & (ptype == pt)
        seasonal[pt] = m.seasonal_factors(adj[rows], panel.sales[rows], qoy[: len(quarters)])
        season[ptype == pt] = seasonal[pt][qoy][None, :]
    adj = adj - season[:, : len(quarters)]

    phi, (_, ape, ape_naive, log_err), fits = backtest(panel, adj, rate_lag_hist, beta, season, horizon, last)
    quant = m.ErrorQuantiles.from_errors(log_err, horizon)

    level, slope, ok = fit_at(panel, adj, last)
    annual = panel.annual_sales(last)
    vclass = m.volume_class(annual)
    keys = panel.keys
    trained_at = datetime.now(timezone.utc)
    future_q = [add_quarters(last_q, h) for h in range(1, horizon + 1)]
    last_price = np.exp(level + beta * rate_lag_hist[last] + season[:, last])
    last_observed = np.exp(panel.log_price[:, last])

    forecast_rows, summary_rows, scenario_rows = [], [], []
    national_paths = {}
    for scen in SCENARIOS:
        rq, _, _ = quarterly_rates(rates, first_rate_q, end_q, scen.key)
        rate_lag_future = np.array([rq[add_quarters(q, -m.RATE_LAG)] for q in future_q])
        logp = m.project(level, slope, phi, beta * rate_lag_future[None, :] + season[:, last + 1 :])
        lo = logp + quant.q10[vclass]
        hi = logp + quant.q90[vclass]
        price, lower, upper = np.exp(logp), np.exp(lo), np.exp(hi)

        for i in np.flatnonzero(ok):
            k = keys.iloc[i]
            for h in range(horizon):
                forecast_rows.append(
                    (k.level, k.code, k.nom, k.code_departement, k.property_type, scen.key, future_q[h], h + 1,
                     round(price[i, h], 2), round(lower[i, h], 2), round(upper[i, h], 2), trained_at)
                )
            h4, h8 = min(4, horizon) - 1, horizon - 1
            rel_width = (upper[i, h4] - lower[i, h4]) / (2 * price[i, h4])
            reliability = "elevee" if rel_width < 0.06 else "moyenne" if rel_width < 0.12 else "faible"
            summary_rows.append(
                (k.level, k.code, k.nom, k.code_departement, k.property_type, scen.key, last_q,
                 round(last_price[i], 2),
                 round(last_observed[i], 2) if np.isfinite(last_observed[i]) else None,
                 int(annual[i]),
                 round(float(np.expm1(4 * slope[i]) * 100), 3),
                 round(price[i, h4], 2), round(float((price[i, h4] / last_price[i] - 1) * 100), 3),
                 round(lower[i, h4], 2), round(upper[i, h4], 2),
                 round(price[i, h8], 2), round(float((price[i, h8] / last_price[i] - 1) * 100), 3),
                 round(lower[i, h8], 2), round(upper[i, h8], 2),
                 reliability, trained_at)
            )

        fr = np.flatnonzero((panel.level == "france") & (keys.property_type.to_numpy() == "all") & ok)
        national_paths[scen.key] = (
            np.concatenate([np.exp(panel.log_price[fr[0]]), price[fr[0]]]) if fr.size else None
        )
        for h, q in enumerate(future_q, start=1):
            yoy = None
            path = national_paths[scen.key]
            if path is not None:
                cur, prev = path[last + h], path[last + h - 4]
                if np.isfinite(cur) and np.isfinite(prev):
                    yoy = round(float((cur / prev - 1) * 100), 3)
            scenario_rows.append((scen.key, scen.label, scen.description, q, h, round(rq[q], 3), yoy))

    backtest_rows = []
    for lv in LEVELS:
        for h in range(1, horizon + 1):
            if not ape[(lv, h)]:
                continue
            backtest_rows.append(
                (lv, h, len(ape[(lv, h)]),
                 round(float(np.mean(ape[(lv, h)]) * 100), 3),
                 round(float(np.mean(ape_naive[(lv, h)]) * 100), 3))
            )

    coverage = coverage_by_level(panel, fits, rate_lag_hist, beta, season, phi, quant, horizon, last)
    backtest_rows = [row + (coverage.get((row[0], row[1])),) for row in backtest_rows]

    n_series = {
        lv: int(((panel.level == lv) & (keys.property_type.to_numpy() == "all") & ok).sum()) for lv in LEVELS
    }
    model_row = (
        trained_at, quarters[0], last_q, horizon, METHOD, round(beta, 5), phi, 0.0,
        round(last_rate, 3), last_rate_month, json.dumps(n_series),
    )
    write_tables(conn, forecast_rows, summary_rows, scenario_rows, backtest_rows, model_row)
    return {
        "history": f"{quarters[0]} -> {last_q}",
        "beta": beta,
        "phi": phi,
        "seasonal": {k: [round(float(x), 4) for x in v] for k, v in seasonal.items()},
        "n_series_all": n_series,
        "forecast_rows": len(forecast_rows),
        "national": {
            k: [round(float(v), 0) for v in p[last:]] if p is not None else None for k, p in national_paths.items()
        },
        "backtest": backtest_rows,
    }


def coverage_by_level(panel, fits, rate_lag, beta, season, phi, quant, horizon, last) -> dict[tuple[str, int], float]:
    """Share of backtest observations falling inside the final 80 % intervals."""
    hits = defaultdict(list)
    for o, (level, slope, ok) in fits.items():
        hmax = min(horizon, last - o)
        pred = m.project(level, slope, phi, beta * rate_lag[None, o + 1 : o + 1 + hmax] + season[:, o + 1 : o + 1 + hmax])
        vclass = m.volume_class(panel.annual_sales(o))
        for h in range(1, hmax + 1):
            y = panel.log_price[:, o + h]
            mask = ok & np.isfinite(y)
            inside = (y >= pred[:, h - 1] + quant.q10[vclass, h - 1]) & (y <= pred[:, h - 1] + quant.q90[vclass, h - 1])
            for lv in LEVELS:
                sel = mask & (panel.level == lv)
                hits[(lv, h)].extend(inside[sel].tolist())
    return {k: round(float(np.mean(v) * 100), 2) for k, v in hits.items() if v}


DDL = """
DROP TABLE IF EXISTS app_price_forecast;
CREATE TABLE app_price_forecast (
    level text NOT NULL, code text NOT NULL, nom text, code_departement text,
    property_type text NOT NULL, scenario text NOT NULL, period_quarter date NOT NULL,
    horizon int NOT NULL, median_price_per_sqm numeric, lower_80 numeric, upper_80 numeric,
    trained_at timestamptz NOT NULL,
    PRIMARY KEY (level, code, property_type, scenario, period_quarter)
);
DROP TABLE IF EXISTS app_price_forecast_summary;
CREATE TABLE app_price_forecast_summary (
    level text NOT NULL, code text NOT NULL, nom text, code_departement text,
    property_type text NOT NULL, scenario text NOT NULL, last_quarter date NOT NULL,
    last_price numeric, last_observed_price numeric, annual_sales bigint, trend_pct_year numeric,
    price_h4 numeric, change_pct_h4 numeric, lower_80_h4 numeric, upper_80_h4 numeric,
    price_h8 numeric, change_pct_h8 numeric, lower_80_h8 numeric, upper_80_h8 numeric,
    reliability text, trained_at timestamptz NOT NULL,
    PRIMARY KEY (level, code, property_type, scenario)
);
CREATE INDEX idx_app_price_forecast_summary_rank
    ON app_price_forecast_summary (level, scenario, property_type, code_departement);
DROP TABLE IF EXISTS app_price_forecast_scenario;
CREATE TABLE app_price_forecast_scenario (
    scenario text NOT NULL, label text, description text, period_quarter date NOT NULL,
    horizon int NOT NULL, rate_pct numeric, national_change_pct_year numeric,
    PRIMARY KEY (scenario, period_quarter)
);
DROP TABLE IF EXISTS app_price_forecast_backtest;
CREATE TABLE app_price_forecast_backtest (
    level text NOT NULL, horizon int NOT NULL, n_series int, mape_model numeric,
    mape_naive numeric, coverage_80 numeric,
    PRIMARY KEY (level, horizon)
);
DROP TABLE IF EXISTS app_price_forecast_model;
CREATE TABLE app_price_forecast_model (
    trained_at timestamptz NOT NULL, history_start date, history_end date, horizon_quarters int,
    method text, rate_elasticity numeric, damping_phi numeric, mean_reversion_kappa numeric,
    last_rate_pct numeric, last_rate_month date, n_series jsonb
);
"""

COLUMNS = {
    "app_price_forecast": "level, code, nom, code_departement, property_type, scenario, period_quarter, horizon, "
    "median_price_per_sqm, lower_80, upper_80, trained_at",
    "app_price_forecast_summary": "level, code, nom, code_departement, property_type, scenario, last_quarter, "
    "last_price, last_observed_price, annual_sales, trend_pct_year, price_h4, change_pct_h4, lower_80_h4, "
    "upper_80_h4, price_h8, change_pct_h8, lower_80_h8, upper_80_h8, reliability, trained_at",
    "app_price_forecast_scenario": "scenario, label, description, period_quarter, horizon, rate_pct, "
    "national_change_pct_year",
    "app_price_forecast_backtest": "level, horizon, n_series, mape_model, mape_naive, coverage_80",
    "app_price_forecast_model": "trained_at, history_start, history_end, horizon_quarters, method, "
    "rate_elasticity, damping_phi, mean_reversion_kappa, last_rate_pct, last_rate_month, n_series",
}


def _py(v):
    return v.item() if isinstance(v, np.generic) else v


def write_tables(conn, forecast_rows, summary_rows, scenario_rows, backtest_rows, model_row) -> None:
    """Replace all forecast tables in one transaction."""
    data = {
        "app_price_forecast": forecast_rows,
        "app_price_forecast_summary": summary_rows,
        "app_price_forecast_scenario": scenario_rows,
        "app_price_forecast_backtest": backtest_rows,
        "app_price_forecast_model": [model_row],
    }
    with conn.transaction():
        with conn.cursor() as cur:
            for stmt in (s.strip() for s in DDL.split(";")):
                if stmt:
                    cur.execute(stmt)
            for table, rows in data.items():
                with cur.copy(f"COPY {table} ({COLUMNS[table]}) FROM STDIN") as copy:
                    for row in rows:
                        copy.write_row(tuple(_py(v) for v in row))


def main() -> int:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Train the price forecast and write app_price_forecast*")
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL"))
    parser.add_argument("--horizon", type=int, default=8, help="Quarters ahead (default 8 = 2 years)")
    args = parser.parse_args()
    if not args.database_url:
        print("Missing DATABASE_URL or --database-url", file=sys.stderr)
        return 1
    if args.horizon < 4:
        print("--horizon must be >= 4", file=sys.stderr)
        return 1
    with psycopg.connect(args.database_url) as conn:
        report = run(conn, args.horizon)
    print(json.dumps(report, indent=2, ensure_ascii=False, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
