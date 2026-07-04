-- Raw landing table for INSEE Recensement (RP) — active population by
-- socio-professional category (CSP) at IRIS level.
-- Source: base-ic-activite-residents-2021 (INSEE), variables C21_ACT1564_CS1..CS6.
-- One row per IRIS. The commune code (com) lets dbt aggregate to commune level.
-- Values stay TEXT until dbt staging casts them.

CREATE TABLE IF NOT EXISTS raw_rp_csp (
    raw_id              BIGSERIAL PRIMARY KEY,
    ingested_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    source_file         TEXT NOT NULL,
    source_row_number   INTEGER NOT NULL,
    millesime           SMALLINT,

    code_iris           TEXT,   -- IRIS code (9 chars)
    code_com            TEXT,   -- commune code (5 chars)
    pop_active_1564     TEXT,   -- P21_ACT1564: active population 15-64

    -- Active population 15-64 by socio-professional category (CS1..CS6)
    cs1_agriculteurs    TEXT,   -- C21_ACT1564_CS1
    cs2_artisans        TEXT,   -- C21_ACT1564_CS2
    cs3_cadres          TEXT,   -- C21_ACT1564_CS3
    cs4_prof_interm     TEXT,   -- C21_ACT1564_CS4
    cs5_employes        TEXT,   -- C21_ACT1564_CS5
    cs6_ouvriers        TEXT    -- C21_ACT1564_CS6
);

CREATE INDEX IF NOT EXISTS idx_raw_rp_csp_com  ON raw_rp_csp (code_com);
CREATE INDEX IF NOT EXISTS idx_raw_rp_csp_iris ON raw_rp_csp (code_iris);
