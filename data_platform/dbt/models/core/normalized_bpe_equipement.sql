{{
  config(
    materialized='view',
    tags=['bpe', 'core'],
  )
}}

-- Core: BPE équipement with valid commune code. Grain = one équipement (raw row).
SELECT
    raw_id AS normalized_equipment_id,
    ingested_at,
    source_file,
    source_row_number,
    millesime,
    an,
    dciris,
    code_commune,
    code_iris,
    dep AS code_departement,
    reg AS code_region,
    typequ,
    equipment_category,
    lambert_x,
    lambert_y,
    qualite_xy
FROM {{ ref('stg_bpe__equipement') }}
WHERE code_commune IS NOT NULL
  AND typequ IS NOT NULL
