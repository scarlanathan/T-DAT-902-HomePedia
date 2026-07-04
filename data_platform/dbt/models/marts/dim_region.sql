{{
  config(
    materialized='table',
    tags=['dimension', 'geography', 'cog'],
  )
}}

-- Dimension: région (INSEE COG).
SELECT
    {{ dbt_utils.generate_surrogate_key(['code_region']) }} AS region_id,
    code_region,
    nom_region,
    code_commune_cheflieu,
    millesime AS cog_millesime
FROM {{ ref('normalized_cog_region') }}
