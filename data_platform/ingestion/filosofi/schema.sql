-- Raw landing table for INSEE FiLoSoFi (Fichier Localisé Social et Fiscal).
-- Covers both commune and IRIS levels (distinguished by the `kind` column).
-- Year suffixes from source column names (e.g. MED21) are stripped by the loader.
-- Values stay TEXT until dbt staging casts them.

CREATE TABLE IF NOT EXISTS raw_filosofi (
    raw_id              BIGSERIAL PRIMARY KEY,
    ingested_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    source_file         TEXT NOT NULL,
    source_row_number   INTEGER NOT NULL,
    millesime           SMALLINT,
    kind                TEXT NOT NULL,  -- 'commune' or 'iris'

    codgeo              TEXT,  -- code commune (commune level) or code IRIS 9 chars (iris level)
    libgeo              TEXT,

    -- Revenus et pauvreté
    tp60                TEXT,  -- Taux de pauvreté seuil à 60 % (%)
    med                 TEXT,  -- Revenu médian disponible par UC (€)
    d1                  TEXT,
    d2                  TEXT,
    d3                  TEXT,
    d4                  TEXT,
    d5                  TEXT,
    d6                  TEXT,
    d7                  TEXT,
    d8                  TEXT,
    d9                  TEXT,
    rd                  TEXT,  -- Ratio interdécile D9/D1

    -- Composition des revenus
    pact                TEXT,  -- Part de l'activité dans les revenus
    ptsa                TEXT,  -- Part des traitements et salaires
    pcho                TEXT,  -- Part des indemnités chômage
    pben                TEXT,  -- Part des bénéfices (BNC, BIC, BA)
    ppen                TEXT,  -- Part des pensions, retraites et rentes
    ppat                TEXT,  -- Part des revenus du patrimoine
    pcaf                TEXT,  -- Part des prestations CAF
    plog                TEXT   -- Part des aides au logement (subset CAF)
);

CREATE INDEX IF NOT EXISTS idx_raw_filosofi_source    ON raw_filosofi (source_file);
CREATE INDEX IF NOT EXISTS idx_raw_filosofi_codgeo    ON raw_filosofi (codgeo);
CREATE INDEX IF NOT EXISTS idx_raw_filosofi_millesime ON raw_filosofi (millesime, kind);
