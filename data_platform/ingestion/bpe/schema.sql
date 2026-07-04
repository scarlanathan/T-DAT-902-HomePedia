-- Raw landing table for INSEE BPE (Base Permanente des Équipements).
-- One row per équipement. The DCIRIS column encodes both the IRIS code (9 chars)
-- and the commune code (first 5 chars of DCIRIS). Values stay TEXT until dbt staging.

CREATE TABLE IF NOT EXISTS raw_bpe_equipement (
    raw_id              BIGSERIAL PRIMARY KEY,
    ingested_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    source_file         TEXT NOT NULL,
    source_row_number   INTEGER NOT NULL,
    millesime           SMALLINT,

    an                  TEXT,  -- Année de la base (e.g. 2022)
    dciris              TEXT,  -- Code commune (5 chars) or code IRIS (9 chars)
    dep                 TEXT,  -- Code département
    reg                 TEXT,  -- Code région
    typequ              TEXT,  -- Code type d'équipement (e.g. C101 = école maternelle)
    lambert_x           TEXT,  -- Coordonnée X Lambert 93
    lambert_y           TEXT,  -- Coordonnée Y Lambert 93
    qualite_xy          TEXT   -- Qualité du géocodage (Bonne/Acceptable/Mauvaise/Non géocodé)
);

CREATE INDEX IF NOT EXISTS idx_raw_bpe_source  ON raw_bpe_equipement (source_file);
CREATE INDEX IF NOT EXISTS idx_raw_bpe_dciris  ON raw_bpe_equipement (dciris);
CREATE INDEX IF NOT EXISTS idx_raw_bpe_typequ  ON raw_bpe_equipement (typequ);
CREATE INDEX IF NOT EXISTS idx_raw_bpe_millesime ON raw_bpe_equipement (millesime);
