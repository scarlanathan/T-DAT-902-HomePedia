-- Raw landing table for monthly bank interest rates (ECB MIR / Banque de France).
-- One row per series × month. Default series: France housing loans to households
-- (new business), key M.FR.B.A2C.A.R.A.2250.EUR.N.
-- Values stay TEXT until dbt staging casts them.

CREATE TABLE IF NOT EXISTS raw_interest_rate (
    raw_id              BIGSERIAL PRIMARY KEY,
    ingested_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    source_file         TEXT NOT NULL,
    source_row_number   INTEGER NOT NULL,

    series_key          TEXT,        -- ECB series key, e.g. M.FR.B.A2C.A.R.A.2250.EUR.N
    indicator           TEXT,        -- logical name, e.g. 'housing_loan_rate'
    ref_area            TEXT,        -- ISO country, e.g. FR
    freq                TEXT,        -- M = monthly
    period              TEXT,        -- ISO period, e.g. 2026-03
    obs_value           TEXT         -- rate in percent, e.g. 3.1
);

CREATE INDEX IF NOT EXISTS idx_raw_interest_rate_series ON raw_interest_rate (series_key);
CREATE INDEX IF NOT EXISTS idx_raw_interest_rate_period ON raw_interest_rate (period);
