-- Raw landing table for La Poste "Base officielle des codes postaux" (Etalab/La Poste).
-- Maps INSEE commune codes to postal codes. One row per (commune, code_postal) —
-- a commune may have several postal codes and a postal code several communes.
-- Values stay TEXT until dbt staging casts them.

CREATE TABLE IF NOT EXISTS raw_code_postal (
    raw_id              BIGSERIAL PRIMARY KEY,
    ingested_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    source_file         TEXT NOT NULL,
    source_row_number   INTEGER NOT NULL,

    code_commune        TEXT,   -- code commune INSEE (5 chars)
    nom_commune         TEXT,
    code_postal         TEXT,   -- 5-digit postal code
    libelle_acheminement TEXT,
    ligne_5             TEXT
);

CREATE INDEX IF NOT EXISTS idx_raw_code_postal_commune ON raw_code_postal (code_commune);
CREATE INDEX IF NOT EXISTS idx_raw_code_postal_cp      ON raw_code_postal (code_postal);
