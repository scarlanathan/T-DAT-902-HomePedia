-- Raw landing table for DGFiP local taxation (taxe foncière sur les propriétés bâties).
-- Source dataset: data.economie.gouv.fr / fiscalite-locale-des-particuliers.
-- One row per commune × exercice (year). Values stay TEXT until dbt staging casts them.

CREATE TABLE IF NOT EXISTS raw_taxe_fonciere (
    raw_id              BIGSERIAL PRIMARY KEY,
    ingested_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    source_file         TEXT NOT NULL,
    source_row_number   INTEGER NOT NULL,

    insee_com           TEXT,   -- code commune INSEE (5 chars)
    com                 TEXT,   -- code commune DGFiP (3 chars, within dep)
    libcom              TEXT,   -- commune name
    dep                 TEXT,   -- département code
    exercice            TEXT,   -- fiscal year, e.g. 2023
    part_communale_tfpb TEXT,   -- e12vote: taux voté part communale TFPB (%)
    taux_global_tfb     TEXT    -- taux global taxe foncière bâti, toutes collectivités (%)
);

CREATE INDEX IF NOT EXISTS idx_raw_taxe_fonciere_insee    ON raw_taxe_fonciere (insee_com);
CREATE INDEX IF NOT EXISTS idx_raw_taxe_fonciere_exercice ON raw_taxe_fonciere (exercice);
