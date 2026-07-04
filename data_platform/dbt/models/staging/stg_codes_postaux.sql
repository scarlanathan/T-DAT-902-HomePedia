{{
  config(
    materialized='view',
    tags=['laposte', 'staging'],
  )
}}

-- Staging: La Poste postal codes. Grain = one (commune, postal code) row.
SELECT
    raw_id,
    ingested_at,
    source_file,
    source_row_number,
    NULLIF(TRIM(code_commune), '')         AS code_commune,
    NULLIF(TRIM(nom_commune), '')          AS nom_commune,
    NULLIF(TRIM(code_postal), '')          AS code_postal,
    NULLIF(TRIM(libelle_acheminement), '') AS libelle_acheminement
FROM {{ source('raw', 'raw_code_postal') }}
WHERE NULLIF(TRIM(code_commune), '') IS NOT NULL
  AND NULLIF(TRIM(code_postal), '') IS NOT NULL
