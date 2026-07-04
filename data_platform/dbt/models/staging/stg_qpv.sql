{{
  config(
    materialized='view',
    tags=['qpv', 'staging'],
  )
}}

-- Staging: ANCT QPV list. Grain = one quartier prioritaire.
SELECT
    raw_id,
    ingested_at,
    source_file,
    source_row_number,
    NULLIF(TRIM(code_qp), '')   AS code_qp,
    NULLIF(TRIM(lib_qp), '')    AS nom_qp,
    NULLIF(TRIM(insee_com), '') AS code_commune,
    NULLIF(TRIM(lib_com), '')   AS nom_commune,
    NULLIF(TRIM(insee_dep), '') AS code_departement,
    NULLIF(TRIM(siren_epci), '') AS siren_epci
FROM {{ source('raw', 'raw_qpv') }}
WHERE NULLIF(TRIM(code_qp), '') IS NOT NULL
