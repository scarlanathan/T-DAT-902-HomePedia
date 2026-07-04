{{
  config(
    materialized='view',
    tags=['cog', 'core'],
  )
}}

-- Core: latest COG row per département. Grain = one INSEE département (dep).
WITH ranked AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY dep
            ORDER BY millesime DESC NULLS LAST, ingested_at DESC, raw_id DESC
        ) AS _rn
    FROM {{ ref('stg_cog__departement') }}
    WHERE dep IS NOT NULL
)

SELECT
    raw_id AS normalized_departement_id,
    ingested_at,
    source_file,
    source_row_number,
    millesime,
    dep AS code_departement,
    reg AS code_region,
    cheflieu AS code_commune_cheflieu,
    tncc,
    ncc,
    nccenr,
    libelle AS nom_departement
FROM ranked
WHERE _rn = 1
