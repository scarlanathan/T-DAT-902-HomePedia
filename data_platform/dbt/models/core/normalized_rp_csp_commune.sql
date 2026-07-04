{{
  config(
    materialized='view',
    tags=['rp', 'core'],
  )
}}

-- Core: CSP mix per commune (latest millésime), aggregated from IRIS rows.
-- csp_diversity_index = Simpson diversity 1 - Σ(pᵢ²) over the 6 CSP shares of the
-- active 15-64 population — higher = more socio-professionally mixed.
WITH latest AS (
    SELECT MAX(millesime) AS millesime FROM {{ ref('stg_rp__csp') }}
),

agg AS (
    SELECT
        s.code_commune,
        MAX(s.millesime) AS millesime,
        SUM(COALESCE(s.cs1_agriculteurs, 0)) AS cs1,
        SUM(COALESCE(s.cs2_artisans, 0))     AS cs2,
        SUM(COALESCE(s.cs3_cadres, 0))       AS cs3,
        SUM(COALESCE(s.cs4_prof_interm, 0))  AS cs4,
        SUM(COALESCE(s.cs5_employes, 0))     AS cs5,
        SUM(COALESCE(s.cs6_ouvriers, 0))     AS cs6
    FROM {{ ref('stg_rp__csp') }} s
    CROSS JOIN latest l
    WHERE s.code_commune IS NOT NULL
      AND (s.millesime = l.millesime OR l.millesime IS NULL)
    GROUP BY s.code_commune
),

shares AS (
    SELECT
        code_commune,
        millesime,
        (cs1 + cs2 + cs3 + cs4 + cs5 + cs6) AS active_total,
        cs3 AS cadres_count,
        cs6 AS ouvriers_count
    FROM agg
)

SELECT
    a.code_commune,
    a.millesime,
    s.active_total,
    s.cadres_count,
    s.ouvriers_count,
    CASE WHEN s.active_total > 0 THEN s.cadres_count / s.active_total END AS cadres_share,
    CASE WHEN s.active_total > 0 THEN s.ouvriers_count / s.active_total END AS ouvriers_share,
    CASE
        WHEN s.active_total > 0 THEN
            1 - (
                  power(a.cs1 / s.active_total, 2)
                + power(a.cs2 / s.active_total, 2)
                + power(a.cs3 / s.active_total, 2)
                + power(a.cs4 / s.active_total, 2)
                + power(a.cs5 / s.active_total, 2)
                + power(a.cs6 / s.active_total, 2)
            )
    END AS csp_diversity_index
FROM agg a
JOIN shares s ON s.code_commune = a.code_commune
