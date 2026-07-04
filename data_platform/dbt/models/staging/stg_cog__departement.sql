{{
  config(
    materialized='view',
    tags=['cog', 'staging'],
  )
}}

-- Staging: INSEE COG départements. Grain = one raw CSV row (département × millésime).
SELECT
    raw_id,
    ingested_at,
    source_file,
    source_row_number,
    millesime,
    NULLIF(TRIM(dep), '') AS dep,
    NULLIF(TRIM(reg), '') AS reg,
    NULLIF(TRIM(cheflieu), '') AS cheflieu,
    NULLIF(TRIM(tncc), '') AS tncc,
    NULLIF(TRIM(ncc), '') AS ncc,
    NULLIF(TRIM(nccenr), '') AS nccenr,
    NULLIF(TRIM(libelle), '') AS libelle
FROM {{ source('raw', 'raw_insee_cog_departement') }}
