{{
  config(
    materialized='view',
    tags=['securite', 'core'],
  )
}}

-- Core: overall recorded-crime rate per commune for the latest available year.
-- total_crime_rate_per_1000 sums taux_pour_mille across all crime families
-- (an exposure proxy); indicator_count tracks how many families were reported.
WITH latest_per_commune AS (
    SELECT
        code_commune,
        MAX(annee) AS annee
    FROM {{ ref('stg_delinquance') }}
    WHERE code_commune IS NOT NULL
      AND annee IS NOT NULL
    GROUP BY code_commune
)

SELECT
    d.code_commune,
    d.annee,
    SUM(d.taux_pour_mille) AS total_crime_rate_per_1000,
    SUM(d.nombre) AS total_crime_count,
    COUNT(*) FILTER (WHERE d.taux_pour_mille IS NOT NULL) AS indicator_count
FROM {{ ref('stg_delinquance') }} d
JOIN latest_per_commune l
  ON l.code_commune = d.code_commune
 AND l.annee = d.annee
GROUP BY d.code_commune, d.annee
