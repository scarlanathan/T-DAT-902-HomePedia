{{
  config(
    materialized='view',
    tags=['securite', 'staging'],
  )
}}

-- Staging: SSMSI recorded crime. Grain = commune × year × indicator × counting unit.
-- Source years are 2-digit (e.g. '16' = 2016); normalise to 4-digit.
SELECT
    raw_id,
    ingested_at,
    source_file,
    source_row_number,
    NULLIF(TRIM(codgeo), '') AS code_commune,
    CASE
        WHEN annee ~ '^[0-9]{4}$' THEN annee::int
        WHEN annee ~ '^[0-9]{2}$' THEN 2000 + annee::int
    END AS annee,
    NULLIF(TRIM(indicateur), '')      AS indicateur,
    NULLIF(TRIM(unite_de_compte), '') AS unite_de_compte,
    {{ parse_decimal('nombre') }}          AS nombre,
    {{ parse_decimal('taux_pour_mille') }} AS taux_pour_mille,
    NULLIF(TRIM(est_diffuse), '')     AS est_diffuse
FROM {{ source('raw', 'raw_delinquance') }}
