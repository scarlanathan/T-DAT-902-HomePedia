-- Raw landing table for ANCT Quartiers Prioritaires de la Ville (QPV) 2024 list.
-- Source: data.gouv.fr / quartiers-prioritaires-de-la-politique-de-la-ville-qpv
--         (listeqp2024-cog2024.csv). One row per quartier prioritaire.
-- A commune can host several QPV. A QPV maps to exactly one commune (insee_com).

CREATE TABLE IF NOT EXISTS raw_qpv (
    raw_id              BIGSERIAL PRIMARY KEY,
    ingested_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    source_file         TEXT NOT NULL,
    source_row_number   INTEGER NOT NULL,

    code_qp             TEXT,   -- QPV code, e.g. QN00101M
    lib_qp              TEXT,   -- QPV name
    insee_reg           TEXT,
    lib_reg             TEXT,
    insee_dep           TEXT,
    lib_dep             TEXT,
    insee_com           TEXT,   -- host commune INSEE code
    lib_com             TEXT,
    siren_epci          TEXT,
    lib_epci            TEXT
);

CREATE INDEX IF NOT EXISTS idx_raw_qpv_insee_com ON raw_qpv (insee_com);
CREATE INDEX IF NOT EXISTS idx_raw_qpv_code      ON raw_qpv (code_qp);
