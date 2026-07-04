{{
  config(
    materialized='table',
    tags=['bpe', 'app'],
  )
}}

-- App-facing aggregate: équipement counts per commune (all rows in current BPE load).
SELECT
    f.code_commune,
    MAX(d.nom_commune) AS nom_commune,
    MAX(f.millesime) AS bpe_millesime,
    COUNT(*) AS equipment_total_count,
    COUNT(*) FILTER (WHERE f.equipment_category = 'education') AS education_count,
    COUNT(*) FILTER (WHERE f.equipment_category = 'health') AS health_count,
    COUNT(*) FILTER (WHERE f.equipment_category = 'commerce') AS commerce_count,
    COUNT(*) FILTER (WHERE f.equipment_category = 'sport') AS sport_count,
    COUNT(*) FILTER (WHERE f.equipment_category = 'other') AS other_count
FROM {{ ref('fact_equipment') }} f
JOIN {{ ref('dim_location') }} d ON d.location_id = f.location_id
GROUP BY f.code_commune
