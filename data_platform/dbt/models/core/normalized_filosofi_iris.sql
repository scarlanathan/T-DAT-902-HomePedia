{{
  config(
    materialized='view',
    tags=['filosofi', 'core'],
  )
}}

-- Core: latest FiLoSoFi row per IRIS. Grain = one IRIS × latest millésime.
WITH ranked AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY codgeo
            ORDER BY millesime DESC NULLS LAST, ingested_at DESC, raw_id DESC
        ) AS _rn
    FROM {{ ref('stg_filosofi__indicator') }}
    WHERE kind = 'iris'
      AND codgeo IS NOT NULL
)

SELECT
    raw_id AS normalized_iris_indicator_id,
    ingested_at,
    source_file,
    source_row_number,
    millesime,
    codgeo AS code_iris,
    code_commune,
    libgeo AS nom_iris,
    poverty_rate_pct,
    median_income_eur,
    income_d1_eur,
    income_d2_eur,
    income_d3_eur,
    income_d4_eur,
    income_d5_eur,
    income_d6_eur,
    income_d7_eur,
    income_d8_eur,
    income_d9_eur,
    inequality_ratio_d9_d1,
    income_share_activity_pct,
    income_share_wages_pct,
    income_share_unemployment_pct,
    income_share_business_pct,
    income_share_pensions_pct,
    income_share_wealth_pct,
    income_share_caf_pct,
    income_share_housing_aid_pct
FROM ranked
WHERE _rn = 1
