{{
  config(
    materialized='view',
    tags=['cog', 'staging'],
  )
}}

-- Staging: INSEE COG communes. Grain = one raw CSV row (commune × millésime).
SELECT
    raw_id,
    ingested_at,
    source_file,
    source_row_number,
    millesime,
    NULLIF(TRIM(typecom), '') AS typecom,
    NULLIF(TRIM(com), '') AS com,
    NULLIF(TRIM(reg), '') AS reg,
    NULLIF(TRIM(dep), '') AS dep,
    NULLIF(TRIM(ctcd), '') AS ctcd,
    NULLIF(TRIM(arr), '') AS arr,
    NULLIF(TRIM(tncc), '') AS tncc,
    NULLIF(TRIM(ncc), '') AS ncc,
    NULLIF(TRIM(nccenr), '') AS nccenr,
    NULLIF(TRIM(libelle), '') AS libelle,
    NULLIF(TRIM(can), '') AS can,
    NULLIF(TRIM(comparent), '') AS comparent
FROM {{ source('raw', 'raw_insee_cog_commune') }}
