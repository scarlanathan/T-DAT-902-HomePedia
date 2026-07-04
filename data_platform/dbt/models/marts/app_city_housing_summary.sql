{{
  config(
    materialized='table',
    tags=['dvf', 'app'],
  )
}}

-- App-facing aggregate: commune × month for dwelling sales (mutation grain).
SELECT
    m.code_commune,
    MAX(m.nom_commune) AS nom_commune,
    date_trunc('month', m.date_mutation)::date AS period_month,
    COUNT(*) AS sale_line_count,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY m.valeur_fonciere) AS median_valeur_fonciere,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY m.price_per_sqm_built)
        FILTER (WHERE m.price_per_sqm_built IS NOT NULL) AS median_price_per_sqm_built
FROM {{ ref('dvf_mutation_price') }} m
WHERE m.price_per_sqm_built IS NOT NULL
GROUP BY m.code_commune, date_trunc('month', m.date_mutation)::date
