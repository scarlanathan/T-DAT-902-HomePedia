{{
  config(
    materialized='view',
    tags=['cog', 'staging'],
  )
}}

-- Staging: INSEE COG régions. Grain = one raw CSV row (région × millésime).
SELECT
    raw_id,
    ingested_at,
    source_file,
    source_row_number,
    millesime,
    NULLIF(TRIM(reg), '') AS reg,
    NULLIF(TRIM(cheflieu), '') AS cheflieu,
    NULLIF(TRIM(tncc), '') AS tncc,
    NULLIF(TRIM(ncc), '') AS ncc,
    NULLIF(TRIM(nccenr), '') AS nccenr,
    NULLIF(TRIM(libelle), '') AS libelle
FROM {{ source('raw', 'raw_insee_cog_region') }}
