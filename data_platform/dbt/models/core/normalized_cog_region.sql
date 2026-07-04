{{
  config(
    materialized='view',
    tags=['cog', 'core'],
  )
}}

-- Core: latest COG row per région. Grain = one INSEE région (reg).
WITH ranked AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY reg
            ORDER BY millesime DESC NULLS LAST, ingested_at DESC, raw_id DESC
        ) AS _rn
    FROM {{ ref('stg_cog__region') }}
    WHERE reg IS NOT NULL
)

SELECT
    raw_id AS normalized_region_id,
    ingested_at,
    source_file,
    source_row_number,
    millesime,
    reg AS code_region,
    cheflieu AS code_commune_cheflieu,
    tncc,
    ncc,
    nccenr,
    libelle AS nom_region
FROM ranked
WHERE _rn = 1
