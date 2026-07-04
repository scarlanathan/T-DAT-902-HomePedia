{{
  config(
    materialized='view',
    tags=['fiscalite', 'core'],
  )
}}

-- Core: latest-exercice taxe foncière rate per commune.
WITH ranked AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY code_commune
            ORDER BY exercice DESC NULLS LAST, ingested_at DESC, raw_id DESC
        ) AS _rn
    FROM {{ ref('stg_taxe_fonciere') }}
    WHERE code_commune IS NOT NULL
)

SELECT
    code_commune,
    nom_commune,
    code_departement,
    exercice,
    part_communale_tfpb_pct,
    taux_global_tfb_pct
FROM ranked
WHERE _rn = 1
