{{
  config(
    materialized='view',
    tags=['bpe', 'staging'],
  )
}}

-- Staging: INSEE BPE équipements. Grain = one raw CSV row (one équipement).
SELECT
    raw_id,
    ingested_at,
    source_file,
    source_row_number,
    millesime,
    NULLIF(TRIM(an), '') AS an,
    NULLIF(TRIM(dciris), '') AS dciris,
    NULLIF(TRIM(dep), '') AS dep,
    NULLIF(TRIM(reg), '') AS reg,
    NULLIF(TRIM(typequ), '') AS typequ,
    NULLIF(TRIM(lambert_x), '')::double precision AS lambert_x,
    NULLIF(TRIM(lambert_y), '')::double precision AS lambert_y,
    NULLIF(TRIM(qualite_xy), '') AS qualite_xy,
    CASE
        WHEN NULLIF(TRIM(dciris), '') IS NULL THEN NULL
        WHEN LENGTH(TRIM(dciris)) >= 5 THEN LEFT(TRIM(dciris), 5)
    END AS code_commune,
    CASE
        WHEN NULLIF(TRIM(dciris), '') IS NULL THEN NULL
        WHEN LENGTH(TRIM(dciris)) = 9 THEN TRIM(dciris)
    END AS code_iris,
    CASE
        WHEN NULLIF(TRIM(typequ), '') IN ('C101', 'C102', 'C201', 'C301') THEN 'education'
        WHEN NULLIF(TRIM(typequ), '') IN ('D101', 'D106', 'D201', 'D501') THEN 'health'
        WHEN NULLIF(TRIM(typequ), '') IN ('A504', 'A505') THEN 'commerce'
        WHEN NULLIF(TRIM(typequ), '') IN ('F101') THEN 'sport'
        ELSE 'other'
    END AS equipment_category
FROM {{ source('raw', 'raw_bpe_equipement') }}
