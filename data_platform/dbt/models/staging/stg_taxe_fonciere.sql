{{
  config(
    materialized='view',
    tags=['fiscalite', 'staging'],
  )
}}

-- Staging: DGFiP taxe foncière. Grain = one raw CSV row (commune × exercice).
SELECT
    raw_id,
    ingested_at,
    source_file,
    source_row_number,
    NULLIF(TRIM(insee_com), '') AS code_commune,
    NULLIF(TRIM(libcom), '')    AS nom_commune,
    NULLIF(TRIM(dep), '')       AS code_departement,
    CASE WHEN exercice ~ '^[0-9]{4}$' THEN exercice::int END AS exercice,
    {{ parse_decimal('part_communale_tfpb') }} AS part_communale_tfpb_pct,
    {{ parse_decimal('taux_global_tfb') }}      AS taux_global_tfb_pct
FROM {{ source('raw', 'raw_taxe_fonciere') }}
