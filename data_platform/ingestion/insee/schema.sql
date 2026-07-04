-- Raw landing tables for INSEE COG (Code Officiel Géographique).
-- Published yearly by INSEE (info 7766585). Columns names match the CSV header.
-- Values stay TEXT until dbt staging casts them - millésime kept on each row for diffing.

CREATE TABLE IF NOT EXISTS raw_insee_cog_commune (
    raw_id              BIGSERIAL PRIMARY KEY,
    ingested_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    source_file         TEXT NOT NULL,
    source_row_number   INTEGER NOT NULL,
    millesime           INTEGER,

    typecom             TEXT,
    com                 TEXT,
    reg                 TEXT,
    dep                 TEXT,
    ctcd                TEXT,
    arr                 TEXT,
    tncc                TEXT,
    ncc                 TEXT,
    nccenr              TEXT,
    libelle             TEXT,
    can                 TEXT,
    comparent           TEXT
);

CREATE INDEX IF NOT EXISTS idx_raw_insee_cog_commune_source ON raw_insee_cog_commune (source_file);
CREATE INDEX IF NOT EXISTS idx_raw_insee_cog_commune_com    ON raw_insee_cog_commune (com);


CREATE TABLE IF NOT EXISTS raw_insee_cog_departement (
    raw_id              BIGSERIAL PRIMARY KEY,
    ingested_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    source_file         TEXT NOT NULL,
    source_row_number   INTEGER NOT NULL,
    millesime           INTEGER,

    dep                 TEXT,
    reg                 TEXT,
    cheflieu            TEXT,
    tncc                TEXT,
    ncc                 TEXT,
    nccenr              TEXT,
    libelle             TEXT
);

CREATE INDEX IF NOT EXISTS idx_raw_insee_cog_departement_source ON raw_insee_cog_departement (source_file);
CREATE INDEX IF NOT EXISTS idx_raw_insee_cog_departement_dep    ON raw_insee_cog_departement (dep);


CREATE TABLE IF NOT EXISTS raw_insee_cog_region (
    raw_id              BIGSERIAL PRIMARY KEY,
    ingested_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    source_file         TEXT NOT NULL,
    source_row_number   INTEGER NOT NULL,
    millesime           INTEGER,

    reg                 TEXT,
    cheflieu            TEXT,
    tncc                TEXT,
    ncc                 TEXT,
    nccenr              TEXT,
    libelle             TEXT
);

CREATE INDEX IF NOT EXISTS idx_raw_insee_cog_region_source ON raw_insee_cog_region (source_file);
CREATE INDEX IF NOT EXISTS idx_raw_insee_cog_region_reg    ON raw_insee_cog_region (reg);
