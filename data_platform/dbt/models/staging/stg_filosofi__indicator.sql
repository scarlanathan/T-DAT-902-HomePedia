{{
  config(
    materialized='view',
    tags=['filosofi', 'staging'],
  )
}}

-- Staging: INSEE FiLoSoFi indicators. Grain = one raw CSV row (commune or IRIS × millésime).
SELECT
    raw_id,
    ingested_at,
    source_file,
    source_row_number,
    millesime,
    NULLIF(TRIM(kind), '') AS kind,
    NULLIF(TRIM(codgeo), '') AS codgeo,
    NULLIF(TRIM(libgeo), '') AS libgeo,
    {{ parse_decimal('tp60') }} AS poverty_rate_pct,
    {{ parse_decimal('med') }} AS median_income_eur,
    {{ parse_decimal('d1') }} AS income_d1_eur,
    {{ parse_decimal('d2') }} AS income_d2_eur,
    {{ parse_decimal('d3') }} AS income_d3_eur,
    {{ parse_decimal('d4') }} AS income_d4_eur,
    {{ parse_decimal('d5') }} AS income_d5_eur,
    {{ parse_decimal('d6') }} AS income_d6_eur,
    {{ parse_decimal('d7') }} AS income_d7_eur,
    {{ parse_decimal('d8') }} AS income_d8_eur,
    {{ parse_decimal('d9') }} AS income_d9_eur,
    {{ parse_decimal('rd') }} AS inequality_ratio_d9_d1,
    {{ parse_decimal('pact') }} AS income_share_activity_pct,
    {{ parse_decimal('ptsa') }} AS income_share_wages_pct,
    {{ parse_decimal('pcho') }} AS income_share_unemployment_pct,
    {{ parse_decimal('pben') }} AS income_share_business_pct,
    {{ parse_decimal('ppen') }} AS income_share_pensions_pct,
    {{ parse_decimal('ppat') }} AS income_share_wealth_pct,
    {{ parse_decimal('pcaf') }} AS income_share_caf_pct,
    {{ parse_decimal('plog') }} AS income_share_housing_aid_pct,
    CASE
        WHEN NULLIF(TRIM(kind), '') = 'commune' THEN NULLIF(TRIM(codgeo), '')
        WHEN NULLIF(TRIM(kind), '') = 'iris'
             AND NULLIF(TRIM(codgeo), '') IS NOT NULL
             AND LENGTH(TRIM(codgeo)) >= 5
        THEN LEFT(TRIM(codgeo), 5)
    END AS code_commune,
    CASE
        WHEN NULLIF(TRIM(kind), '') = 'iris'
             AND NULLIF(TRIM(codgeo), '') IS NOT NULL
             AND LENGTH(TRIM(codgeo)) = 9
        THEN TRIM(codgeo)
    END AS code_iris
FROM {{ source('raw', 'raw_filosofi') }}
