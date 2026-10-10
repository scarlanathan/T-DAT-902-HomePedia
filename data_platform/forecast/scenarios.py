"""Macro scenarios for the price forecast (mortgage rate paths).

The model forecasts prices conditionally on an average new housing-loan rate path.
Each scenario moves the rate, relative to its last observed value, by a given
amount at end-2026 and end-2027 (linear in between, flat afterwards).

Anchors (as of October 2026, see docs/predictions_fr.md for the full source list):
  - Observatoire Crédit Logement/CSA: 3.31 % average rate in August 2026.
  - Cafpi (Oct. 2026): 3.70-4.00 % expected by end-2026.
  - M. Mouillart (Jan. 2026): 3.55 % Q4 2026, 3.95 % Q4 2027.
  - ECB deposit rate raised to 2.50 % on 10/09/2026; a cut is not expected before autumn 2027.
  - OAT 10 ans ≈ 4.0 % (August 2026), highest since 2008.
The deltas are applied to the ECB MIR series loaded in the warehouse, whose level
is slightly below the CSA one; only the change matters for the model.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class Scenario:
    key: str
    label: str
    description: str
    # Rate change (percentage points) vs the reference level, at the anchor dates.
    rate_delta: dict[date, float]


# Reference: CSA average rate of August 2026 (3.31 %).
RATE_ANCHOR_END_2026 = date(2026, 12, 1)
RATE_ANCHOR_END_2027 = date(2027, 12, 1)

SCENARIOS: tuple[Scenario, ...] = (
    Scenario(
        key="central",
        label="Central",
        description=(
            "Remontée modérée des taux (≈ 3,6 % fin 2026, ≈ 3,9 % fin 2027), "
            "dans la lignée des prévisions des courtiers et de la politique "
            "monétaire restrictive de la BCE."
        ),
        rate_delta={RATE_ANCHOR_END_2026: 0.29, RATE_ANCHOR_END_2027: 0.59},
    ),
    Scenario(
        key="optimiste",
        label="Optimiste",
        description=(
            "Taux stabilisés autour de 3,4 % : la BCE suspend ses hausses et "
            "anticipe une baisse à l'automne 2027 ; le crédit redevient accessible."
        ),
        rate_delta={RATE_ANCHOR_END_2026: 0.09, RATE_ANCHOR_END_2027: 0.09},
    ),
    Scenario(
        key="pessimiste",
        label="Pessimiste",
        description=(
            "Tensions persistantes sur l'OAT 10 ans (> 4,4 %) : taux à ≈ 3,9 % "
            "fin 2026 puis ≈ 4,3 % fin 2027, solvabilité des ménages dégradée."
        ),
        rate_delta={RATE_ANCHOR_END_2026: 0.59, RATE_ANCHOR_END_2027: 0.99},
    ),
)


def month_index(d: date) -> int:
    return d.year * 12 + (d.month - 1)


def rate_delta_at(scenario: Scenario, month: date, last_observed: date) -> float:
    """Rate change vs the last observed month, linearly interpolated between anchors."""
    points = [(month_index(last_observed), 0.0)] + sorted(
        (month_index(d), v) for d, v in scenario.rate_delta.items() if d > last_observed
    )
    m = month_index(month)
    if m <= points[0][0]:
        return 0.0
    for (m0, v0), (m1, v1) in zip(points, points[1:]):
        if m <= m1:
            return v0 + (v1 - v0) * (m - m0) / (m1 - m0)
    return points[-1][1]
