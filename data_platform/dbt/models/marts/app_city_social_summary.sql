{{
  config(
    materialized='table',
    tags=['filosofi', 'app'],
  )
}}

-- App-facing: FiLoSoFi social indicators at commune level (latest millésime per commune).
SELECT
    s.code_commune,
    COALESCE(s.nom_commune, d.nom_commune) AS nom_commune,
    s.millesime AS filosofi_millesime,
    s.median_income_eur,
    s.poverty_rate_pct AS poverty_rate,
    s.inequality_ratio_d9_d1 AS inequality_ratio,
    s.income_share_caf_pct AS caf_beneficiary_share,
    s.income_share_housing_aid_pct AS housing_aid_share,
    s.income_d1_eur,
    s.income_d9_eur
FROM {{ ref('normalized_filosofi_commune') }} s
LEFT JOIN {{ ref('dim_location') }} d ON d.code_commune = s.code_commune
