{{
  config(
    materialized='table',
    tags=['dimension', 'geography', 'cog'],
  )
}}

/*
  Dimension: commune (INSEE).
  Primary source: COG (authoritative labels & hierarchy).
  Fallback: communes observed in DVF/BPE but absent from COG (one row per code_commune).
*/
WITH cog_communes AS (
    SELECT
        code_commune,
        nom_commune,
        code_departement,
        code_region,
        typecom AS type_commune,
        code_commune_parent,
        millesime AS cog_millesime
    FROM {{ ref('normalized_cog_commune') }}
),

geo_observed AS (
    SELECT
        n.code_commune,
        n.nom_commune,
        n.code_departement,
        CAST(NULL AS TEXT) AS code_region
    FROM {{ ref('normalized_dvf_transaction') }} n
    WHERE n.code_commune IS NOT NULL

    UNION ALL

    SELECT
        e.code_commune,
        CAST(NULL AS TEXT) AS nom_commune,
        e.code_departement,
        e.code_region
    FROM {{ ref('normalized_bpe_equipement') }} e
    WHERE e.code_commune IS NOT NULL
),

fallback_communes AS (
    SELECT
        o.code_commune,
        MAX(o.nom_commune) AS nom_commune,
        MAX(o.code_departement) AS code_departement,
        MAX(o.code_region) AS code_region,
        CAST(NULL AS TEXT) AS type_commune,
        CAST(NULL AS TEXT) AS code_commune_parent,
        CAST(NULL AS INTEGER) AS cog_millesime
    FROM geo_observed o
    LEFT JOIN cog_communes c ON c.code_commune = o.code_commune
    WHERE c.code_commune IS NULL
    GROUP BY o.code_commune
),

combined AS (
    SELECT * FROM cog_communes
    UNION ALL
    SELECT * FROM fallback_communes
),

postal_counts AS (
    SELECT
        code_commune,
        NULLIF(TRIM(code_postal), '') AS code_postal,
        COUNT(*) AS cnt
    FROM {{ ref('normalized_dvf_transaction') }}
    WHERE code_commune IS NOT NULL
    GROUP BY code_commune, NULLIF(TRIM(code_postal), '')
),

postal_by_commune AS (
    SELECT code_commune, code_postal
    FROM (
        SELECT
            code_commune,
            code_postal,
            ROW_NUMBER() OVER (
                PARTITION BY code_commune
                ORDER BY cnt DESC, code_postal
            ) AS rn
        FROM postal_counts
        WHERE code_postal IS NOT NULL
    ) ranked
    WHERE rn = 1
)

SELECT
    {{ dbt_utils.generate_surrogate_key(['c.code_commune']) }} AS location_id,
    c.code_commune,
    c.nom_commune,
    c.code_departement,
    c.code_region,
    c.type_commune,
    c.code_commune_parent,
    c.cog_millesime,
    p.code_postal
FROM combined c
LEFT JOIN postal_by_commune p ON p.code_commune = c.code_commune
