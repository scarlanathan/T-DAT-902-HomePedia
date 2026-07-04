{{
  config(
    materialized='view',
    tags=['dvf', 'core'],
  )
}}

/*
  One row per DVF mutation (id_mutation × commune).

  In geo-DVF, valeur_fonciere is the total sale price and is repeated on every
  CSV line of the same mutation. Dividing by a single line's surface_reelle_bati
  inflates €/m² (classic multi-lot bug). Use the sum of dwelling surfaces instead.
*/
WITH mutation_building AS (
    SELECT
        n.id_mutation,
        n.code_commune,
        MAX(n.nom_commune) AS nom_commune,
        MAX(n.date_mutation) AS date_mutation,
        MAX(n.valeur_fonciere) AS valeur_fonciere,
        SUM(n.surface_reelle_bati) FILTER (
            WHERE n.type_local IN ('Maison', 'Appartement')
              AND n.surface_reelle_bati >= 10
        ) AS total_surface_bati
    FROM {{ ref('normalized_dvf_transaction') }} n
    WHERE n.nature_mutation = 'Vente'
      AND n.valeur_fonciere IS NOT NULL
      AND n.valeur_fonciere > 0
      AND n.id_mutation IS NOT NULL
      AND n.code_commune IS NOT NULL
    GROUP BY n.id_mutation, n.code_commune
)

SELECT
    id_mutation,
    code_commune,
    nom_commune,
    date_mutation,
    valeur_fonciere,
    total_surface_bati,
    CASE
        WHEN total_surface_bati >= 10
            AND (valeur_fonciere / total_surface_bati) BETWEEN 100 AND 30000
        THEN valeur_fonciere / total_surface_bati
    END AS price_per_sqm_built
FROM mutation_building
WHERE total_surface_bati >= 10
