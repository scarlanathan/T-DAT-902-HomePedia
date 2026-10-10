"""Unit tests for the price forecast model (no database needed)."""

from __future__ import annotations

from datetime import date

import numpy as np
import pandas as pd
import pytest

from forecast import model as m
from forecast.forecast_prices import (
    PHI_GRID,
    Panel,
    add_quarters,
    backtest,
    fit_at,
    last_complete_quarter,
    quarterly_rates,
)
from forecast.scenarios import SCENARIOS, rate_delta_at


def test_wls_trend_recovers_exact_line():
    t = np.arange(16, dtype=float)
    y = np.vstack([5.0 + 0.01 * t, 8.0 - 0.02 * t])
    n = np.full_like(y, 50.0)
    trend = m.wls_trend(y, n, origin=15)
    assert trend.ok.all()
    np.testing.assert_allclose(trend.slope, [0.01, -0.02], atol=1e-10)
    np.testing.assert_allclose(trend.level, [5.0 + 0.15, 8.0 - 0.30], atol=1e-10)
    np.testing.assert_allclose(trend.se, [0.0, 0.0], atol=1e-8)


def test_wls_trend_requires_enough_points():
    y = np.full((1, 16), np.nan)
    y[0, -4:] = [1.0, 1.1, 1.2, 1.3]
    trend = m.wls_trend(y, np.full_like(y, 10.0), origin=15)
    assert not trend.ok[0]
    assert np.isnan(trend.slope[0])


def test_rate_elasticity_recovered_on_synthetic_panel():
    rng = np.random.default_rng(0)
    rate = np.concatenate([np.linspace(1.0, 4.0, 12), np.linspace(4.0, 3.2, 10)])
    beta = -0.035
    fe = rng.normal(0, 0.005, size=(40, 1))
    t = np.arange(rate.size)
    log_p = 7.5 + fe * t + beta * rate + rng.normal(0, 0.003, size=(40, rate.size))
    est = m.estimate_rate_elasticity(log_p, rate)
    assert est == pytest.approx(beta, abs=0.006)


def test_rate_elasticity_is_clamped():
    rate = np.concatenate([np.linspace(1, 4, 10), np.linspace(4, 2, 10)])
    log_p = np.tile(7 + 0.5 * rate, (5, 1))  # absurd positive effect
    assert m.estimate_rate_elasticity(log_p, rate) == m.ELASTICITY_BOUNDS[1]


def test_shrinkage_pulls_noisy_children_towards_parent():
    slope = np.array([0.05, 0.05, -0.01, 0.0, 0.01])
    se = np.array([1.0, 1e-4, 0.002, 0.002, 0.002])
    ok = np.ones(5, dtype=bool)
    parent_slope = np.zeros(5)
    out = m.shrink_slopes(slope, se, ok, parent_slope, np.zeros(5, dtype=int))
    assert abs(out[0]) < 1e-3          # very noisy → parent slope
    assert out[1] == pytest.approx(0.05, rel=0.05)  # precise → keeps its own slope


def test_shrinkage_unfitted_rows_inherit_parent():
    out = m.shrink_slopes(
        np.array([np.nan, 0.02, 0.0, 0.01]),
        np.array([np.nan, 0.01, 0.01, 0.01]),
        np.array([False, True, True, True]),
        np.array([0.007, 0.0, 0.0, 0.0]),
        np.zeros(4, dtype=int),
    )
    assert out[0] == pytest.approx(0.007)


def test_damped_cumsum():
    np.testing.assert_allclose(m.damped_cumsum(0.5, 3), [0.5, 0.75, 0.875])
    np.testing.assert_allclose(m.damped_cumsum(1.0, 4), [1, 2, 3, 4])


def test_error_quantiles_fill_missing_horizons_and_classes():
    errors = {(1, 1): list(np.linspace(-0.1, 0.1, 50)), (1, 2): list(np.linspace(-0.2, 0.2, 50))}
    q = m.ErrorQuantiles.from_errors(errors, horizon=4)
    assert np.isfinite(q.q10).all() and np.isfinite(q.q90).all()
    assert q.q90[1, 3] == pytest.approx(q.q90[1, 1] * np.sqrt(4 / 2))
    np.testing.assert_allclose(q.q10[0], q.q10[1])  # class 0 borrows from class 1


def test_rate_delta_interpolation():
    central = next(s for s in SCENARIOS if s.key == "central")
    last = date(2026, 8, 1)
    assert rate_delta_at(central, date(2026, 8, 1), last) == 0.0
    assert rate_delta_at(central, date(2026, 12, 1), last) == pytest.approx(0.29)
    assert 0.29 < rate_delta_at(central, date(2027, 6, 1), last) < 0.59
    assert rate_delta_at(central, date(2028, 6, 1), last) == pytest.approx(0.59)


def test_quarterly_rates_uses_actuals_then_scenario():
    rates = pd.DataFrame(
        {"rate_month": pd.to_datetime(["2025-10-01", "2025-11-01", "2025-12-01"]), "rate": [3.0, 3.1, 3.2]}
    )
    rq, last_rate, last_month = quarterly_rates(rates, date(2025, 10, 1), date(2027, 10, 1), "pessimiste")
    assert last_rate == 3.2 and last_month == date(2025, 12, 1)
    assert rq[date(2025, 10, 1)] == pytest.approx(3.1)
    assert rq[date(2027, 10, 1)] > rq[date(2026, 10, 1)] > 3.2


def _synthetic_history(n_quarters: int = 20) -> pd.DataFrame:
    rng = np.random.default_rng(1)
    quarters = [add_quarters(date(2021, 1, 1), i) for i in range(n_quarters)]
    rows = []

    def add(level, code, dep, base, slope, sales, noise):
        for i, q in enumerate(quarters):
            price = base * np.exp(slope * i + rng.normal(0, noise))
            rows.append((level, code, f"{level}-{code}", dep, "all", q, sales, price))

    add("france", "FR", None, 3000, 0.004, 200000, 0.002)
    add("region", "84", None, 3200, 0.004, 30000, 0.004)
    add("departement", "69", "69", 3800, 0.006, 6000, 0.005)
    add("departement", "01", "01", 2500, 0.002, 2000, 0.006)
    for k in range(6):
        add("commune", f"6912{k}", "69", 4000 + 100 * k, 0.006, 150, 0.03)
    add("commune", "69999", "69", 2000, 0.0, 6, 0.1)  # too few sales → not eligible
    return pd.DataFrame(
        rows,
        columns=["level", "code", "nom", "code_departement", "property_type", "period_quarter", "sale_count", "price"],
    )


def test_panel_fit_and_backtest_on_synthetic_history():
    hist = _synthetic_history()
    assert last_complete_quarter(hist) == date(2025, 10, 1)
    quarters = sorted(hist.period_quarter.unique())
    panel = Panel(hist, quarters, {"69": "84", "01": "84"})

    keys = panel.keys
    dept69 = keys.index[(keys.level == "departement") & (keys.code == "69")][0]
    commune = keys.index[keys.code == "69120"][0]
    assert panel.parent[commune] == dept69

    adj = panel.log_price.copy()
    last = len(quarters) - 1
    level, slope, ok = fit_at(panel, adj, last)
    assert not ok[keys.index[keys.code == "69999"][0]]
    assert ok[commune]
    # Slope of the commune is close to the département's true trend.
    assert slope[commune] == pytest.approx(0.006, abs=0.004)

    phi, (score, ape, ape_naive, _), fits = backtest(panel, adj, np.zeros(len(quarters)), 0.0, np.zeros((len(panel.level), len(quarters) + 8)), 8, last)
    assert phi in PHI_GRID
    assert np.isfinite(score)
    # On trending series the model beats "price unchanged" at long horizons.
    assert np.mean(ape[("departement", 8)]) < np.mean(ape_naive[("departement", 8)])


def test_last_complete_quarter_drops_incomplete_tail():
    hist = _synthetic_history(21)
    tail = hist.period_quarter == hist.period_quarter.max()
    hist.loc[tail & (hist.level == "france"), "sale_count"] = 1000
    assert last_complete_quarter(hist) == date(2025, 10, 1)


def test_seasonal_factors_recover_pattern():
    rng = np.random.default_rng(2)
    qoy = np.arange(20) % 4
    pattern = np.array([-0.02, 0.0, 0.03, -0.01])
    y = 7 + 0.005 * np.arange(20) + pattern[qoy] + rng.normal(0, 0.002, (30, 20))
    est = m.seasonal_factors(y, np.full_like(y, 100.0), qoy)
    np.testing.assert_allclose(est, pattern - pattern.mean(), atol=0.003)
    assert est.sum() == pytest.approx(0.0, abs=1e-12)
