{{
  config(
    materialized='table',
    tags=['dvf', 'fact'],
  )
}}

/*
  Fact: housing transaction line from DVF.
  Grain: one row per geo-DVF CSV line (lot / local line), keyed by transaction_id = normalized_sale_line_id.

  price_per_sqm_built comes from dvf_mutation_price (total sale / sum of dwelling surfaces).
*/
SELECT
    n.normalized_sale_line_id AS transaction_id,
    {{ dbt_utils.generate_surrogate_key(['n.code_commune']) }} AS location_id,
    n.date_mutation,
    n.nature_mutation,
    n.valeur_fonciere,
    n.surface_reelle_bati,
    CASE
        WHEN n.type_local IN ('Maison', 'Appartement')
        THEN mp.price_per_sqm_built
    END AS price_per_sqm_built,
    n.type_local,
    n.code_type_local,
    n.id_parcelle,
    n.code_postal,
    n.longitude,
    n.latitude,
    n.source_file,
    n.ingested_at
FROM {{ ref('normalized_dvf_transaction') }} n
LEFT JOIN {{ ref('dvf_mutation_price') }} mp
    ON mp.id_mutation = n.id_mutation
   AND mp.code_commune = n.code_commune
