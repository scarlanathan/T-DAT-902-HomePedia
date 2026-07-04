# Sources manquantes récupérées — manifeste de provenance

Données réelles téléchargées pour alimenter les colonnes aujourd'hui bouchonnées
(`CAST(NULL AS …)`) ou codées en dur du mart `dbt/models/marts/app_opportunity_score.sql`.
Fichiers non versionnés (voir `.gitignore`) — ré-téléchargeables via les URLs ci-dessous.

Récupéré le 2026-07-04.

| Fichier | Source / producteur | URL directe | Colonne cible du mart | Pilier problématique |
|---|---|---|---|---|
| `taux_credit_immobilier_fr.csv` | BCE — MIR, taux crédits habitat ménages France (mensuel, 2000→) | `https://data-api.ecb.europa.eu/service/data/MIR/M.FR.B.A2C.A.R.A.2250.EUR.N?format=csvdata&detail=dataonly` | `assumed_interest_rate` → taux réel ; `borrowing_capacity_eur` | 🔴 Capacité d'emprunt |
| `taxe_fonciere.csv` | DGFiP — Fiscalité locale des particuliers (`fiscalite-locale-des-particuliers`) | `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/fiscalite-locale-des-particuliers/exports/csv?select=insee_com,com,libcom,dep,exercice,e12vote,taux_global_tfb&use_labels=false&delimiter=;` | charges récurrentes (`taux_global_tfb`) | 🔴 Capacité d'emprunt |
| `qpv_2024_liste.csv` | ANCT — Quartiers prioritaires 2024 (data.gouv) | `https://static.data.gouv.fr/resources/quartiers-prioritaires-de-la-politique-de-la-ville-qpv/20260116-110350/listeqp2024-cog2024.csv` | `qpv_share` (nb QPV / commune) | 🟠 Mixité sociale |
| `insee_rp_activite_2021_csv.zip` | INSEE — RP 2021, activité des résidents IRIS (CSP `C21_ACT1564_CS1..6`) | `https://www.insee.fr/fr/statistiques/fichier/8268843/base-ic-activite-residents-2021_csv.zip` | indice de mixité CSP (Gini/entropie) | 🟠 Mixité sociale |
| `delinquance_communale_2025.csv.gz` | SSMSI/Min. Intérieur — délinquance enregistrée base communale | `https://static.data.gouv.fr/resources/bases-statistiques-communale-departementale-et-regionale-de-la-delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales/20260326-124144/donnee-data.gouv-2025-geographie2025-produit-le2026-02-03.csv.gz` | `safety_index` | 🟡 Qualité de vie |
| `codes_postaux.csv` | La Poste / Etalab — Base officielle des codes postaux | `https://datanova.laposte.fr/data-fair/api/v1/datasets/laposte-hexasmal/raw` | `dim_commune_postal` (recherche par code postal) | 🔎 Recherche |

## Non récupéré

| Source | Colonne cible | Raison | Piste recommandée |
|---|---|---|---|
| **GTFS transports** | `transit_accessibility` | Pas de fichier national unique : ~centaines de flux GTFS par AOM via transport.data.gouv. Agrégation nationale = tâche lourde à part. | Court terme : dériver de la BPE déjà chargée (types transport : gares, arrêts). Cible : ingérer les flux GTFS majeurs via l'API `transport.data.gouv.fr/api/datasets`. |

## Notes d'intégration
- **Taux BCE** : série nationale mensuelle → jointure temporelle sur `period_month`, pas par commune. Remplace la constante `var('assumed_interest_rate', 0.035)`.
- **Taxe foncière** : `exercice` multi-années + plusieurs échelons — filtrer le dernier `exercice` et l'échelon communal côté staging.
- **Délinquance** : séparateur `;`, décimale virgule, valeurs `NA`, colonne `taux_pour_mille` par `indicateur` — pivoter ou agréger en indice sécurité normalisé.
- **QPV** : liste = comptage QPV/commune (proxy). Pour une vraie *part* surfacique/population, utiliser en plus le GeoJSON QPV (`qpv-2024-geojson.zip`) + PostGIS.
- **INSEE RP CSP** : encodage latin-1, niveau IRIS avec code `COM` — agréger à la commune pour rejoindre `app_city_social_summary`.
