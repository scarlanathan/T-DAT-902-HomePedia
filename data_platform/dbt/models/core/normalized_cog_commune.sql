{{
  config(
    materialized='view',
    tags=['cog', 'core'],
  )
}}

-- Core: latest COG row per commune code. Grain = one INSEE commune (com).
WITH ranked AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY com
            ORDER BY
                millesime DESC NULLS LAST,
                CASE typecom
                    WHEN 'COM' THEN 0
                    WHEN 'COMD' THEN 1
                    ELSE 2
                END,
                ingested_at DESC,
                raw_id DESC
        ) AS _rn
    FROM {{ ref('stg_cog__commune') }}
    WHERE com IS NOT NULL
)

SELECT
    raw_id AS normalized_commune_id,
    ingested_at,
    source_file,
    source_row_number,
    millesime,
    typecom,
    com AS code_commune,
    reg AS code_region,
    dep AS code_departement,
    ctcd,
    arr,
    tncc,
    ncc,
    nccenr,
    libelle AS nom_commune,
    can,
    comparent AS code_commune_parent
FROM ranked
WHERE _rn = 1
