{{
  config(
    materialized='table',
    tags=['dimension', 'geography', 'cog'],
  )
}}

-- Dimension: département (INSEE COG).
SELECT
    {{ dbt_utils.generate_surrogate_key(['code_departement']) }} AS departement_id,
    code_departement,
    nom_departement,
    code_region,
    code_commune_cheflieu,
    millesime AS cog_millesime
FROM {{ ref('normalized_cog_departement') }}
