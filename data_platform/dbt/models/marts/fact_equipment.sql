{{
  config(
    materialized='table',
    tags=['bpe', 'fact'],
  )
}}

/*
  Fact: public equipment from BPE.
  Grain: one row per équipement (normalized_equipment_id = raw_id).
*/
SELECT
    e.normalized_equipment_id AS equipment_id,
    {{ dbt_utils.generate_surrogate_key(['e.code_commune']) }} AS location_id,
    e.code_commune,
    e.code_iris,
    e.millesime,
    e.typequ,
    e.equipment_category,
    e.lambert_x,
    e.lambert_y,
    e.qualite_xy,
    e.source_file,
    e.ingested_at
FROM {{ ref('normalized_bpe_equipement') }} e
