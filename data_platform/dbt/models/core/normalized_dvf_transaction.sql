{{
  config(
    materialized='view',
    tags=['dvf', 'core'],
  )
}}

-- Core: conformed DVF line; grain = one geo-DVF CSV row (same as raw/stg).
-- `normalized_sale_line_id` is the stable warehouse key (equals raw_id).
SELECT
    raw_id AS normalized_sale_line_id,
    ingested_at,
    source_file,
    source_row_number,
    id_mutation,
    date_mutation,
    numero_disposition,
    nature_mutation,
    valeur_fonciere,
    adresse_numero,
    adresse_suffixe,
    adresse_nom_voie,
    adresse_code_voie,
    code_postal,
    code_commune,
    nom_commune,
    code_departement,
    ancien_code_commune,
    ancien_nom_commune,
    id_parcelle,
    ancien_id_parcelle,
    numero_volume,
    lot1_numero,
    lot1_surface_carrez,
    lot2_numero,
    lot2_surface_carrez,
    lot3_numero,
    lot3_surface_carrez,
    lot4_numero,
    lot4_surface_carrez,
    lot5_numero,
    lot5_surface_carrez,
    nombre_lots,
    code_type_local,
    type_local,
    surface_reelle_bati,
    nombre_pieces_principales,
    code_nature_culture,
    nature_culture,
    code_nature_culture_speciale,
    nature_culture_speciale,
    surface_terrain,
    longitude,
    latitude
FROM {{ ref('stg_dvf__transaction') }}
WHERE code_commune IS NOT NULL
