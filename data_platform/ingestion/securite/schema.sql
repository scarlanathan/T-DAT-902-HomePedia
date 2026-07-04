-- Raw landing table for SSMSI recorded-crime statistics at commune level.
-- Source: data.gouv.fr "bases statistiques communale ... de la délinquance".
-- Grain = commune × year × indicator × counting unit. Values stay TEXT until
-- dbt staging casts them (French decimals, 'NA' sentinels).

CREATE TABLE IF NOT EXISTS raw_delinquance (
    raw_id              BIGSERIAL PRIMARY KEY,
    ingested_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    source_file         TEXT NOT NULL,
    source_row_number   INTEGER NOT NULL,

    codgeo              TEXT,   -- commune INSEE code (CODGEO_2025)
    annee               TEXT,   -- year (2 or 4 digits in source, e.g. 2016 or 16)
    indicateur          TEXT,   -- crime family label
    unite_de_compte     TEXT,   -- counting unit (Victime, Infraction, ...)
    nombre              TEXT,   -- count (may be NA when confidential)
    taux_pour_mille     TEXT,   -- rate per 1000 inhabitants
    est_diffuse         TEXT    -- 'diff' / 'ndiff' confidentiality flag
);

CREATE INDEX IF NOT EXISTS idx_raw_delinquance_codgeo ON raw_delinquance (codgeo);
CREATE INDEX IF NOT EXISTS idx_raw_delinquance_annee  ON raw_delinquance (annee);
