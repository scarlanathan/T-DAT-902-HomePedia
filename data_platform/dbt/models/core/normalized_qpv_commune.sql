{{
  config(
    materialized='view',
    tags=['qpv', 'core'],
  )
}}

-- Core: number of Quartiers Prioritaires per commune (0 when none via LEFT JOIN downstream).
SELECT
    code_commune,
    MAX(nom_commune) AS nom_commune,
    COUNT(DISTINCT code_qp) AS qpv_count
FROM {{ ref('stg_qpv') }}
WHERE code_commune IS NOT NULL
GROUP BY code_commune
