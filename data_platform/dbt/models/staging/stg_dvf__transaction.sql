{{
  config(
    materialized='view',
    tags=['dvf', 'staging'],
  )
}}

-- Staging: one row per raw row; typed fields. Grain = one geo-DVF CSV line.
SELECT
    raw_id,
    ingested_at,
    source_file,
    source_row_number,
    NULLIF(TRIM(id_mutation), '') AS id_mutation,
    CASE
        WHEN NULLIF(TRIM(date_mutation), '') IS NULL THEN NULL
        ELSE NULLIF(TRIM(date_mutation), '')::date
    END AS date_mutation,
    NULLIF(TRIM(numero_disposition), '') AS numero_disposition,
    NULLIF(TRIM(nature_mutation), '') AS nature_mutation,
    NULLIF(TRIM(valeur_fonciere), '')::numeric AS valeur_fonciere,
    NULLIF(TRIM(adresse_numero), '') AS adresse_numero,
    NULLIF(TRIM(adresse_suffixe), '') AS adresse_suffixe,
    NULLIF(TRIM(adresse_nom_voie), '') AS adresse_nom_voie,
    NULLIF(TRIM(adresse_code_voie), '') AS adresse_code_voie,
    NULLIF(TRIM(code_postal), '') AS code_postal,
    NULLIF(TRIM(code_commune), '') AS code_commune,
    NULLIF(TRIM(nom_commune), '') AS nom_commune,
    NULLIF(TRIM(code_departement), '') AS code_departement,
    NULLIF(TRIM(ancien_code_commune), '') AS ancien_code_commune,
    NULLIF(TRIM(ancien_nom_commune), '') AS ancien_nom_commune,
    NULLIF(TRIM(id_parcelle), '') AS id_parcelle,
    NULLIF(TRIM(ancien_id_parcelle), '') AS ancien_id_parcelle,
    NULLIF(TRIM(numero_volume), '') AS numero_volume,
    NULLIF(TRIM(lot1_numero), '') AS lot1_numero,
    NULLIF(TRIM(lot1_surface_carrez), '')::numeric AS lot1_surface_carrez,
    NULLIF(TRIM(lot2_numero), '') AS lot2_numero,
    NULLIF(TRIM(lot2_surface_carrez), '')::numeric AS lot2_surface_carrez,
    NULLIF(TRIM(lot3_numero), '') AS lot3_numero,
    NULLIF(TRIM(lot3_surface_carrez), '')::numeric AS lot3_surface_carrez,
    NULLIF(TRIM(lot4_numero), '') AS lot4_numero,
    NULLIF(TRIM(lot4_surface_carrez), '')::numeric AS lot4_surface_carrez,
    NULLIF(TRIM(lot5_numero), '') AS lot5_numero,
    NULLIF(TRIM(lot5_surface_carrez), '')::numeric AS lot5_surface_carrez,
    NULLIF(TRIM(nombre_lots), '')::integer AS nombre_lots,
    NULLIF(TRIM(code_type_local), '') AS code_type_local,
    NULLIF(TRIM(type_local), '') AS type_local,
    NULLIF(TRIM(surface_reelle_bati), '')::numeric AS surface_reelle_bati,
    NULLIF(TRIM(nombre_pieces_principales), '')::integer AS nombre_pieces_principales,
    NULLIF(TRIM(code_nature_culture), '') AS code_nature_culture,
    NULLIF(TRIM(nature_culture), '') AS nature_culture,
    NULLIF(TRIM(code_nature_culture_speciale), '') AS code_nature_culture_speciale,
    NULLIF(TRIM(nature_culture_speciale), '') AS nature_culture_speciale,
    NULLIF(TRIM(surface_terrain), '')::numeric AS surface_terrain,
    NULLIF(TRIM(longitude), '')::double precision AS longitude,
    NULLIF(TRIM(latitude), '')::double precision AS latitude
FROM {{ source('raw', 'raw_dvf_transaction') }}
