{{
  config(
    materialized='table',
    tags=['dvf', 'app', 'forecast'],
    post_hook=[
      "CREATE INDEX IF NOT EXISTS idx_app_price_history_key ON {{ this }} (level, code, property_type, period_quarter)"
    ],
  )
}}

/*
  Quarterly median €/m² per geographic level — input of the price forecast job
  (data_platform/forecast) and the history series of the /forecast API.

  Grain: level × code × property_type × period_quarter.
    level         : france | region | departement | commune
    property_type : all | appartement | maison

  Built at mutation grain (same multi-lot rule as dvf_mutation_price): the sale
  price is divided by the summed dwelling surface. Department and region medians
  are computed from mutations, never by averaging commune medians.

  A mutation is typed 'appartement' / 'maison' only when all its dwellings share
  that type; mixed mutations only count in 'all'. Mutations including a
  commercial premise are excluded (their price is not a housing price).

  DVF records Paris, Lyon and Marseille by arrondissement (ARM codes 751xx, 6938x,
  132xx): their sales are also aggregated under the parent commune (75056, 69123,
  13055) so the commune picked in the app has a series.
*/
WITH mutation AS (
    SELECT
        n.id_mutation,
        n.code_commune,
        MAX(n.nom_commune) AS nom_commune,
        MAX(n.code_departement) AS code_departement,
        MAX(n.date_mutation) AS date_mutation,
        MAX(n.valeur_fonciere) AS valeur_fonciere,
        SUM(n.surface_reelle_bati) FILTER (
            WHERE n.type_local IN ('Maison', 'Appartement')
              AND n.surface_reelle_bati >= 10
        ) AS total_surface_bati,
        COUNT(*) FILTER (WHERE n.type_local = 'Appartement' AND n.surface_reelle_bati >= 10) AS n_appartement,
        COUNT(*) FILTER (WHERE n.type_local = 'Maison' AND n.surface_reelle_bati >= 10) AS n_maison,
        COUNT(*) FILTER (WHERE n.type_local LIKE 'Local industriel%') AS n_commercial
    FROM {{ ref('normalized_dvf_transaction') }} n
    WHERE n.nature_mutation = 'Vente'
      AND n.valeur_fonciere > 0
      AND n.id_mutation IS NOT NULL
      AND n.code_commune IS NOT NULL
      AND n.date_mutation IS NOT NULL
    GROUP BY n.id_mutation, n.code_commune
),

-- Materialized so the planner hashes this small lookup instead of re-evaluating
-- the COG view per mutation.
arrondissement AS MATERIALIZED (
    SELECT code_commune, code_commune_parent
    FROM {{ ref('normalized_cog_commune') }}
    WHERE typecom = 'ARM'
),

priced AS (
    SELECT
        m.code_commune,
        m.nom_commune,
        m.code_departement,
        d.code_region,
        arm.code_commune_parent,
        date_trunc('quarter', m.date_mutation)::date AS period_quarter,
        m.valeur_fonciere / m.total_surface_bati AS price_per_sqm,
        CASE
            WHEN m.n_appartement > 0 AND m.n_maison = 0 THEN 'appartement'
            WHEN m.n_maison > 0 AND m.n_appartement = 0 THEN 'maison'
        END AS typed_property
    FROM mutation m
    LEFT JOIN {{ ref('dim_departement') }} d
        ON d.code_departement = m.code_departement
    LEFT JOIN arrondissement arm
        ON arm.code_commune = m.code_commune
    WHERE m.total_surface_bati >= 10
      AND m.n_commercial = 0
      AND m.valeur_fonciere / m.total_surface_bati BETWEEN 100 AND 30000
),

typed AS (
    SELECT p.*, 'all'::text AS property_type FROM priced p
    UNION ALL
    SELECT p.*, p.typed_property AS property_type FROM priced p WHERE p.typed_property IS NOT NULL
),

by_level AS (
    SELECT 'france'::text AS level, 'FR'::text AS code, property_type, period_quarter, price_per_sqm, NULL::text AS nom_commune
    FROM typed
    UNION ALL
    SELECT 'region', code_region, property_type, period_quarter, price_per_sqm, NULL
    FROM typed WHERE code_region IS NOT NULL
    UNION ALL
    SELECT 'departement', code_departement, property_type, period_quarter, price_per_sqm, NULL
    FROM typed WHERE code_departement IS NOT NULL
    UNION ALL
    SELECT 'commune', code_commune, property_type, period_quarter, price_per_sqm, nom_commune
    FROM typed
    UNION ALL
    SELECT 'commune', code_commune_parent, property_type, period_quarter, price_per_sqm, NULL
    FROM typed WHERE code_commune_parent IS NOT NULL
),

aggregated AS (
    SELECT
        level,
        code,
        property_type,
        period_quarter,
        MAX(nom_commune) AS nom_commune,
        COUNT(*) AS sale_count,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY price_per_sqm) AS median_price_per_sqm,
        percentile_cont(0.25) WITHIN GROUP (ORDER BY price_per_sqm) AS p25_price_per_sqm,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY price_per_sqm) AS p75_price_per_sqm
    FROM by_level
    GROUP BY level, code, property_type, period_quarter
)

SELECT
    a.level,
    a.code,
    CASE a.level
        WHEN 'france' THEN 'France'
        WHEN 'region' THEN r.nom_region
        WHEN 'departement' THEN d.nom_departement
        ELSE COALESCE(a.nom_commune, c.nom_commune)
    END AS nom,
    CASE a.level
        WHEN 'commune' THEN LEFT(a.code, CASE WHEN a.code LIKE '97%' THEN 3 ELSE 2 END)
        WHEN 'departement' THEN a.code
    END AS code_departement,
    a.property_type,
    a.period_quarter,
    a.sale_count,
    ROUND(a.median_price_per_sqm::numeric, 2) AS median_price_per_sqm,
    ROUND(a.p25_price_per_sqm::numeric, 2) AS p25_price_per_sqm,
    ROUND(a.p75_price_per_sqm::numeric, 2) AS p75_price_per_sqm
FROM aggregated a
LEFT JOIN {{ ref('dim_region') }} r
    ON a.level = 'region' AND r.code_region = a.code
LEFT JOIN {{ ref('dim_departement') }} d
    ON a.level = 'departement' AND d.code_departement = a.code
LEFT JOIN {{ ref('normalized_cog_commune') }} c
    ON a.level = 'commune' AND a.nom_commune IS NULL AND c.code_commune = a.code
