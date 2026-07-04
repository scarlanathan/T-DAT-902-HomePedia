-- Raw landing table for geo-DVF CSV (data.gouv « Demandes de valeurs foncières géolocalisées »).
-- Column names match the published CSV header. Values stay TEXT until dbt staging casts them.

CREATE TABLE IF NOT EXISTS raw_dvf_transaction (
    raw_id              BIGSERIAL PRIMARY KEY,
    ingested_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    source_file         TEXT NOT NULL,
    source_row_number   INTEGER NOT NULL,

    id_mutation         TEXT,
    date_mutation       TEXT,
    numero_disposition  TEXT,
    nature_mutation     TEXT,
    valeur_fonciere     TEXT,
    adresse_numero      TEXT,
    adresse_suffixe     TEXT,
    adresse_nom_voie    TEXT,
    adresse_code_voie   TEXT,
    code_postal         TEXT,
    code_commune        TEXT,
    nom_commune         TEXT,
    code_departement    TEXT,
    ancien_code_commune TEXT,
    ancien_nom_commune  TEXT,
    id_parcelle         TEXT,
    ancien_id_parcelle  TEXT,
    numero_volume       TEXT,
    lot1_numero         TEXT,
    lot1_surface_carrez TEXT,
    lot2_numero         TEXT,
    lot2_surface_carrez TEXT,
    lot3_numero         TEXT,
    lot3_surface_carrez TEXT,
    lot4_numero         TEXT,
    lot4_surface_carrez TEXT,
    lot5_numero         TEXT,
    lot5_surface_carrez TEXT,
    nombre_lots         TEXT,
    code_type_local     TEXT,
    type_local          TEXT,
    surface_reelle_bati TEXT,
    nombre_pieces_principales TEXT,
    code_nature_culture TEXT,
    nature_culture      TEXT,
    code_nature_culture_speciale TEXT,
    nature_culture_speciale TEXT,
    surface_terrain     TEXT,
    longitude           TEXT,
    latitude            TEXT
);

CREATE INDEX IF NOT EXISTS idx_raw_dvf_transaction_source ON raw_dvf_transaction (source_file);
CREATE INDEX IF NOT EXISTS idx_raw_dvf_transaction_commune ON raw_dvf_transaction (code_commune);
