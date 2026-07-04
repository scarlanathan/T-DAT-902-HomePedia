{{
  config(
    materialized='table',
    tags=['filosofi', 'app'],
  )
}}

-- App-facing: FiLoSoFi social indicators at IRIS level (communes >20k hab typically).
SELECT
    i.code_iris,
    i.code_commune,
    d.nom_commune,
    i.nom_iris,
    i.millesime AS filosofi_millesime,
    i.median_income_eur,
    i.poverty_rate_pct AS poverty_rate,
    i.inequality_ratio_d9_d1 AS inequality_ratio,
    i.income_share_caf_pct AS caf_beneficiary_share
FROM {{ ref('normalized_filosofi_iris') }} i
LEFT JOIN {{ ref('dim_location') }} d ON d.code_commune = i.code_commune
