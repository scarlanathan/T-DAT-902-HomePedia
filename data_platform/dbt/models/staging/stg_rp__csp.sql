{{
  config(
    materialized='view',
    tags=['rp', 'staging'],
  )
}}

-- Staging: INSEE RP active population by socio-professional category.
-- Grain = one IRIS. code_commune derived from com (or first 5 chars of IRIS).
SELECT
    raw_id,
    ingested_at,
    source_file,
    source_row_number,
    millesime,
    NULLIF(TRIM(code_iris), '') AS code_iris,
    COALESCE(
        NULLIF(TRIM(code_com), ''),
        CASE WHEN LENGTH(TRIM(code_iris)) >= 5 THEN LEFT(TRIM(code_iris), 5) END
    ) AS code_commune,
    {{ parse_decimal('pop_active_1564') }} AS pop_active_1564,
    {{ parse_decimal('cs1_agriculteurs') }} AS cs1_agriculteurs,
    {{ parse_decimal('cs2_artisans') }}     AS cs2_artisans,
    {{ parse_decimal('cs3_cadres') }}       AS cs3_cadres,
    {{ parse_decimal('cs4_prof_interm') }}  AS cs4_prof_interm,
    {{ parse_decimal('cs5_employes') }}     AS cs5_employes,
    {{ parse_decimal('cs6_ouvriers') }}     AS cs6_ouvriers
FROM {{ source('raw', 'raw_rp_csp') }}
