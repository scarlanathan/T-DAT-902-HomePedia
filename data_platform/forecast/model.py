"""Price forecast model: damped log-linear trend net of rates, with hierarchical shrinkage.

For a series s (one geographic unit × property type) with quarterly median €/m² P_t:

    y_t      = log P_t − β · r_{t−L} − s_{q(t)}       (price net of rate effect and seasonality)
    y_t      ≈ a_s + b_s · t                          (WLS on the last W quarters, weights √n_sales)
    b*_s     = w · b_s + (1 − w) · b*_parent          (empirical-Bayes shrinkage, w = τ² / (τ² + se²))
    ŷ_{T+h}  = a_s + b*_s · Σ_{k=1..h} φ^k + β · r^{scenario}_{T+h−L} + s_{q(T+h)}

β (rate elasticity) and s (quarter-of-year effects, per property type) are estimated on
the département panel; φ (damping) is chosen by backtest. Prediction intervals are empirical quantiles of rolling-origin backtest errors
by horizon and sales-volume class.

Everything is vectorised over series: arrays are (n_series, n_quarters) with NaN for
missing quarters.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

FIT_WINDOW = 12          # quarters used for the trend fit
MIN_FIT_POINTS = 6       # minimum valid quarters inside the window
RATE_LAG = 2             # quarters between a rate move and its price effect
ELASTICITY_BOUNDS = (-0.08, -0.005)
VOLUME_CLASSES = (0, 100, 400, 2000)  # annual-sales lower bounds


@dataclass
class Trend:
    level: np.ndarray   # a_s: fitted (rate-adjusted) log level at the origin
    slope: np.ndarray   # b_s per quarter
    se: np.ndarray      # standard error of b_s
    ok: np.ndarray      # bool: enough points to fit


def wls_trend(y: np.ndarray, n: np.ndarray, origin: int, window: int = FIT_WINDOW) -> Trend:
    """Weighted least squares of y on t over quarters (origin − window, origin], per row.

    t is centred on the origin so the intercept is the fitted level at the origin.
    """
    n_series, n_q = y.shape
    start = max(0, origin - window + 1)
    ys = y[:, start : origin + 1]
    ns = n[:, start : origin + 1]
    t = np.arange(start, origin + 1, dtype=float) - origin
    valid = np.isfinite(ys) & (ns > 0)
    w = np.where(valid, np.sqrt(np.where(valid, ns, 0.0)), 0.0)
    yv = np.where(valid, ys, 0.0)
    k = valid.sum(axis=1)

    s0 = w.sum(axis=1)
    s1 = (w * t).sum(axis=1)
    s2 = (w * t * t).sum(axis=1)
    sy = (w * yv).sum(axis=1)
    sty = (w * t * yv).sum(axis=1)
    det = s0 * s2 - s1 * s1
    ok = (k >= MIN_FIT_POINTS) & (det > 1e-12)
    safe_det = np.where(ok, det, 1.0)
    safe_s0 = np.where(ok, s0, 1.0)
    slope = np.where(ok, (s0 * sty - s1 * sy) / safe_det, np.nan)
    level = np.where(ok, (sy - slope * s1) / safe_s0, np.nan)

    resid = np.where(valid, ys - level[:, None] - slope[:, None] * t, 0.0)
    sigma2 = (w * resid * resid).sum(axis=1) / np.maximum(k - 2, 1)
    se = np.where(ok, np.sqrt(sigma2 * safe_s0 / safe_det), np.nan)
    return Trend(level=level, slope=slope, se=se, ok=ok)


def estimate_rate_elasticity(log_price: np.ndarray, rate_lagged: np.ndarray) -> float:
    """β from year-on-year changes on a panel (rows = départements), unit fixed effects.

    Δ4 log P_{d,t} − mean_d = β · (Δ4 r_{t−L} − mean_d) + ε. Clamped to a plausible range.
    """
    dy = log_price[:, 4:] - log_price[:, :-4]
    dr = np.broadcast_to(rate_lagged[4:] - rate_lagged[:-4], dy.shape)
    valid = np.isfinite(dy) & np.isfinite(dr)
    rows = valid.sum(axis=1) >= 4
    dy, dr, valid = dy[rows], dr[rows], valid[rows]
    if dy.size == 0:
        return float(np.mean(ELASTICITY_BOUNDS))
    cnt = valid.sum(axis=1, keepdims=True)
    dy_d = np.where(valid, dy - np.nansum(np.where(valid, dy, 0), axis=1, keepdims=True) / cnt, 0)
    dr_d = np.where(valid, dr - np.nansum(np.where(valid, dr, 0), axis=1, keepdims=True) / cnt, 0)
    denom = (dr_d * dr_d).sum()
    if denom <= 1e-12:
        return float(np.mean(ELASTICITY_BOUNDS))
    beta = float((dr_d * dy_d).sum() / denom)
    return float(np.clip(beta, *ELASTICITY_BOUNDS))


def seasonal_factors(y: np.ndarray, n: np.ndarray, quarter_of_year: np.ndarray) -> np.ndarray:
    """Additive log seasonal effect per quarter of year (shape (4,), sums to 0).

    Residuals of each row around its own full-history linear trend, averaged by quarter
    of year (weights √n), pooled over rows (e.g. all départements of a property type).
    """
    trend = wls_trend(y, n, origin=y.shape[1] - 1, window=y.shape[1])
    t = np.arange(y.shape[1], dtype=float) - (y.shape[1] - 1)
    resid = y - trend.level[:, None] - trend.slope[:, None] * t
    valid = np.isfinite(resid) & trend.ok[:, None] & (n > 0)
    w = np.where(valid, np.sqrt(np.where(valid, n, 0.0)), 0.0)
    out = np.zeros(4)
    for q in range(4):
        cols = quarter_of_year == q
        sw = w[:, cols].sum()
        if sw > 0:
            out[q] = (w[:, cols] * np.where(valid[:, cols], resid[:, cols], 0.0)).sum() / sw
    return out - out.mean()


def shrink_slopes(
    slope: np.ndarray,
    se: np.ndarray,
    ok: np.ndarray,
    parent_slope: np.ndarray,
    parent_key: np.ndarray,
) -> np.ndarray:
    """Empirical-Bayes shrinkage of child slopes towards their parent's (already shrunk) slope.

    τ² (between-children slope variance) is estimated per parent by method of moments,
    falling back to the pooled estimate when a parent has fewer than 3 children.
    Rows without a fit (ok=False) inherit the parent slope.
    """
    out = np.where(np.isfinite(parent_slope), parent_slope, 0.0).astype(float)

    def tau2_of(mask: np.ndarray) -> float:
        b, s = slope[mask], se[mask]
        if b.size < 3:
            return np.nan
        return max(float(np.var(b, ddof=1) - np.mean(s * s)), 1e-6)

    pooled = tau2_of(ok)
    if not np.isfinite(pooled):
        pooled = 1e-4
    tau2 = np.full(slope.shape, pooled)
    for key in np.unique(parent_key[ok]):
        m = ok & (parent_key == key)
        t = tau2_of(m)
        if np.isfinite(t):
            tau2[m] = t
    w = np.where(ok, tau2 / (tau2 + np.where(ok, se, 1.0) ** 2), 0.0)
    return np.where(ok, w * np.where(ok, slope, 0.0) + (1 - w) * out, out)


def damped_cumsum(phi: float, horizon: int) -> np.ndarray:
    """Σ_{k=1..h} φ^k for h = 1..horizon."""
    return np.cumsum(phi ** np.arange(1, horizon + 1))


def project(level: np.ndarray, slope: np.ndarray, phi: float, effect: np.ndarray) -> np.ndarray:
    """Log-price path (n_series, horizon).

    effect: additive log terms for h = 1..H — the rate effect β · r_{T+h−L} (shape (H,))
    and/or per-series seasonal effects (shape (n_series, H)).
    """
    effect = np.atleast_2d(effect)
    horizon = effect.shape[1]
    return level[:, None] + slope[:, None] * damped_cumsum(phi, horizon)[None, :] + effect


def volume_class(annual_sales: np.ndarray) -> np.ndarray:
    return np.searchsorted(np.asarray(VOLUME_CLASSES), annual_sales, side="right") - 1


@dataclass
class ErrorQuantiles:
    """q10 / q90 of log errors (actual − forecast) per (volume class, horizon)."""
    q10: np.ndarray  # (n_classes, horizon)
    q90: np.ndarray

    @classmethod
    def from_errors(cls, errors: dict[tuple[int, int], list[float]], horizon: int) -> "ErrorQuantiles":
        n_cls = len(VOLUME_CLASSES)
        q10 = np.full((n_cls, horizon), np.nan)
        q90 = np.full((n_cls, horizon), np.nan)
        for (c, h), errs in errors.items():
            if len(errs) >= 30 and 1 <= h <= horizon:
                q10[c, h - 1], q90[c, h - 1] = np.quantile(errs, [0.1, 0.9])
        # Missing horizons: scale the last available one by √(h / h_ref).
        for c in range(n_cls):
            last = None
            for h in range(horizon):
                if np.isfinite(q10[c, h]):
                    last = h
                elif last is not None:
                    scale = np.sqrt((h + 1) / (last + 1))
                    q10[c, h], q90[c, h] = q10[c, last] * scale, q90[c, last] * scale
        # Missing classes: borrow from the nearest class with data.
        filled = [c for c in range(n_cls) if np.isfinite(q10[c]).all()]
        for c in range(n_cls):
            if not np.isfinite(q10[c]).all():
                if not filled:
                    base = 0.03 * np.sqrt(np.arange(1, horizon + 1))
                    q10[c], q90[c] = -base, base
                else:
                    near = min(filled, key=lambda f: abs(f - c))
                    q10[c], q90[c] = q10[near], q90[near]
        return cls(q10=q10, q90=q90)
