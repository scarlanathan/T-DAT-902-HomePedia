{{
  config(
    materialized='table',
    tags=['laposte', 'app'],
  )
}}

-- Lookup: commune INSEE code <-> postal code (many-to-many). Used by the API to
-- search communes by postal code and to display a commune's postal code(s).
-- Restricted to communes present in dim_location to keep referential integrity.
SELECT DISTINCT
    cp.code_commune,
    cp.code_postal,
    COALESCE(d.nom_commune, cp.nom_commune) AS nom_commune,
    cp.libelle_acheminement
FROM {{ ref('stg_codes_postaux') }} cp
JOIN {{ ref('dim_location') }} d ON d.code_commune = cp.code_commune
