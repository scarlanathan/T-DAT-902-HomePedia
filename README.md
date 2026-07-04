# Homepedia

Plateforme d'analyse du logement en France, croisant valeurs foncières, capacité d'emprunt et indicateurs socio-économiques pour faire émerger des zones d'opportunité.

## Problématique

> **Optimisation du choix de résidence : comment concilier capacité d'emprunt réelle et indicateurs de mixité sociale pour identifier les meilleures opportunités locales ?**

Choisir où acheter ou louer ne se résume pas au prix au m². L'arbitrage réel mêle :

- **Capacité d'emprunt effective** : prix médians, taux d'intérêt et d'usure en vigueur, charges (taxe foncière, copro), reste-à-vivre par rapport au revenu local.
- **Mixité sociale et qualité de vie** : revenus médians, taux de pauvreté, taux de chômage, proximité de QPV, équipements (écoles, santé, transports), sécurité.
- **Dimension temporelle** : évolution des prix, dynamique démographique, projets d'aménagement.

Homepedia consolide ces dimensions au niveau commune (et plus fin lorsque possible — IRIS) pour faire ressortir les territoires où le pouvoir d'achat immobilier rencontre une qualité de vie objectivable, et permettre à un utilisateur de pondérer ses propres critères.

## Architecture

```
┌──────────────┐    ┌──────────────────┐    ┌──────────────┐    ┌──────────────┐
│  Sources FR  │───▶│  Data platform   │───▶│   Backend    │───▶│   Frontend   │
│ data.gouv,   │    │ ingestion + dbt  │    │   NestJS     │    │  Next.js 15  │
│ INSEE, IGN…  │    │ Postgres+PostGIS │    │ REST/Swagger │    │ MapLibre GL  │
└──────────────┘    └──────────────────┘    └──────────────┘    └──────────────┘
```

| Dossier | Rôle |
|---|---|
| `data_platform/` | Ingestion brute, transformations dbt, warehouse Postgres/PostGIS |
| `backend/` | API NestJS qui sert les marts (Swagger sur `/docs`) |
| `frontend/` | Application Next.js (carte, filtres, dashboards) |
| `infra/` | Configuration de déploiement (à venir) |

## Stack technique

### Data platform
- **Python 3.11+** pour les loaders d'ingestion (`ingestion/dvf/load_raw_dvf.py` aujourd'hui).
- **Polars** *(à explorer)* — transformations colonnaires rapides en mémoire pour les fichiers de taille moyenne (DVF départemental, BPE, FiLoSoFi). Multithread natif, *lazy frames*, conso mémoire réduite — alternative à pandas pour le pré-chargement.
- **PySpark** *(à explorer)* — traitement distribué pour les volumes nationaux et les jointures multi-millions de lignes (DVF national × BAN × INSEE RP). Mode `local[*]` en dev, cluster (Databricks / EMR) ensuite.
- **dbt-core + dbt-postgres** — couche de modélisation SQL, tests d'intégrité, lineage. Modèles déjà livrés : `stg_dvf__transaction` → `normalized_dvf_transaction` → `dim_location` / `fact_transaction` → `app_city_housing_summary`.
- **PostgreSQL 16 + PostGIS** (image `postgis/postgis:16-3.4`) — warehouse + indexation spatiale.
- **Airflow** *(prévu)* — orchestration des DAGs (`data_platform/airflow/dags/`).
- **OpenSearch** *(prévu)* — recherche plein-texte sur communes / quartiers.

### Backend (`backend/`)
- **NestJS 10 + TypeScript**, modules `db`, `health`, `locations`, `transactions`, `stats`, `map`.
- **node-postgres (`pg`)** côté base, **Swagger** auto-généré sur `/docs`.
- Tests **Jest** (`*.spec.ts`).

### Frontend (`frontend/`)
- **Next.js 15** (App Router) + **React 19** + **TypeScript** + **Tailwind CSS**.
- **MapLibre GL** + `react-map-gl/maplibre` (alternative open-source compatible Mapbox).
- **ECharts** (`echarts-for-react`) pour les graphes de tendances.
- Tests **Vitest** + Testing Library.

## Sources de données (France)

### Logement & marché immobilier
| Source | Producteur | Fréquence | Niveau | Apport |
|---|---|---|---|---|
| **DVF — Demandes de valeurs foncières géolocalisées** | DGFiP / Etalab (data.gouv) | semestrielle | parcelle / commune | prix de vente, surface, type de bien |
| **DPE — Diagnostics de performance énergétique** | ADEME (data.gouv) | continu | logement | classe énergie, consommation |
| **RPLS — Logements locatifs sociaux** | SDES | annuelle | commune | parc social, taux SRU |
| **Sit@del2 — Permis de construire** | SDES | mensuelle | commune | dynamique de construction |

### Démographie & socio-économique
| Source | Producteur | Niveau | Apport |
|---|---|---|---|
| **INSEE Recensement (RP)** | INSEE | IRIS / commune | population, CSP, ménages, logements |
| **INSEE FiLoSoFi** | INSEE × DGFiP | commune / IRIS | revenus médians, taux de pauvreté, déciles |
| **INSEE BPE — Base permanente des équipements** | INSEE | commune | écoles, médecins, commerces, transports |
| **France Travail / DARES** | France Travail, DARES | bassin / dpt | taux de chômage |
| **QPV — Quartiers prioritaires de la ville** | ANCT (data.gouv) | quartier (géom) | géolocalisation des QPV — proxy mixité |

### Capacité d'emprunt
| Source | Producteur | Fréquence | Apport |
|---|---|---|---|
| **Taux d'usure** | Banque de France | trimestrielle | plafond légal du taux annuel effectif global |
| **Taux moyens crédit immobilier** | Banque de France / CSA-Crédit Logement | mensuelle | base de la simulation de capacité |
| **Taux de taxe foncière (locaux)** | DGFiP (data.gouv) | annuelle | coût récurrent de possession |

### Cadre de vie & sécurité
| Source | Producteur | Niveau |
|---|---|---|
| **Délinquance enregistrée (interstats)** | SSMSI / Min. Intérieur | commune (>20 k hab.) |
| **Annuaire de l'éducation** | MEN (data.gouv) | établissement |
| **Équipements de santé (FINESS)** | Min. Santé | établissement |
| **Open Data SNCF / IDFM / régies (GTFS)** | SNCF, IDFM, autorités locales | arrêt / ligne |

### Référentiels géographiques
| Source | Apport |
|---|---|
| **COG INSEE** | référentiel communes / dpt / régions (codes officiels) |
| **IGN ADMIN-EXPRESS** | géométries communes / dpt / régions (Shapefile / GeoJSON) |
| **BAN — Base Adresse Nationale** | géocodage adresses |

## Endpoints d'extraction

Toutes les URLs ci-dessous sont publiques. La majorité expose un fichier statique versionné (CSV/Parquet/Shapefile) ; quelques-unes fournissent une API JSON (DPE, annuaire éducation, transport.data.gouv).

### Logement
| Source | Page de catalogue | URL de téléchargement / API |
|---|---|---|
| DVF géolocalisé | `https://www.data.gouv.fr/datasets/demandes-de-valeurs-foncieres-geolocalisees/` | `https://files.data.gouv.fr/geo-dvf/latest/csv/{YYYY}/full.csv.gz` (national) ou `…/{YYYY}/departements/{DD}.csv.gz` |
| DPE logements existants (ADEME) | `https://data.ademe.fr/datasets/dpe-v2-logements-existants` | API : `https://data.ademe.fr/data-fair/api/v1/datasets/dpe-v2-logements-existants/lines?size=10000&after=<token>` |
| DPE logements neufs (ADEME) | `https://data.ademe.fr/datasets/dpe-v2-logements-neufs` | API : `https://data.ademe.fr/data-fair/api/v1/datasets/dpe-v2-logements-neufs/lines` |
| RPLS — logements sociaux | `https://www.data.gouv.fr/datasets/repertoire-des-logements-locatifs-des-bailleurs-sociaux/` | CSV annuel sur la fiche dataset |
| Sit@del2 — permis de construire | `https://www.statistiques.developpement-durable.gouv.fr/sitadel2-la-base-de-donnees-des-permis-de-construire` | CSV mensuel (lien sur la page) |

### Démographie & socio-économique
| Source | Page | URL / API |
|---|---|---|
| INSEE RP (recensement) | `https://www.insee.fr/fr/information/2410988` | fichiers ZIP par millésime (CSV/XLSX) |
| INSEE FiLoSoFi | `https://www.insee.fr/fr/statistiques/6692392` | XLSX commune / IRIS |
| INSEE BPE | `https://www.insee.fr/fr/statistiques/8217525` | CSV / XLSX commune |
| Taux de chômage localisé (DARES) | `https://dares.travail-emploi.gouv.fr/donnees/le-taux-de-chomage-localise` | XLSX trimestriel |
| France Travail open data | `https://www.francetravail.fr/statistiques-analyses/open-data.html` | API REST (clé requise) |
| QPV — quartiers prioritaires | `https://www.data.gouv.fr/datasets/quartiers-prioritaires-de-la-politique-de-la-ville-qpv/` | Shapefile / GeoJSON |

### Capacité d'emprunt
| Source | Page | URL / API |
|---|---|---|
| Taux d'usure BdF | `https://www.banque-france.fr/fr/statistiques/taux/taux-dusure` | trimestriel — table HTML / PDF (parsing) |
| Taux crédits immobiliers BdF (Webstat) | `https://webstat.banque-france.fr/` | API SDMX : `https://webstat.banque-france.fr/ws_wsfr/fr/downloadFile.do?id=<series>` |
| CSA / Crédit Logement | `https://www.creditlogement.fr/observatoire/` | PDF mensuel (parsing) |
| Taxe foncière (taux locaux) | `https://www.data.gouv.fr/datasets/impots-locaux/` | CSV annuel DGFiP |

### Cadre de vie & sécurité
| Source | Page | URL / API |
|---|---|---|
| Délinquance enregistrée (interstats) | `https://www.data.gouv.fr/datasets/bases-statistiques-communale-departementale-et-regionale-de-la-delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales/` | CSV annuel |
| Annuaire de l'éducation | `https://www.data.gouv.fr/datasets/annuaire-de-leducation/` | API : `https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-annuaire-education/records?limit=100&offset=...` |
| FINESS (santé) | `https://www.data.gouv.fr/datasets/finess-extraction-du-fichier-des-etablissements/` | CSV mensuel |
| Catalogue transports (GTFS) | `https://transport.data.gouv.fr/` | API : `https://transport.data.gouv.fr/api/datasets` puis URL GTFS par AOM |
| GTFS SNCF (TER) | `https://ressources.data.sncf.com/explore/dataset/sncf-ter-gtfs/` | ZIP GTFS hebdomadaire |
| GTFS IDFM (Île-de-France) | `https://prim.iledefrance-mobilites.fr/fr/jeux-de-donnees/offre-horaires-tc-gtfs-idfm` | ZIP GTFS hebdomadaire (clé API) |

### Référentiels géographiques
| Source | Page | URL |
|---|---|---|
| COG INSEE | `https://www.insee.fr/fr/information/7766585` | CSV par millésime (commune, dpt, région) |
| IGN ADMIN-EXPRESS | `https://geoservices.ign.fr/adminexpress` | Shapefile : `https://data.geopf.fr/telechargement/download/ADMIN-EXPRESS/ADMIN-EXPRESS_<version>/ADMIN-EXPRESS_<version>__SHP_<srs>_FRA_<date>.7z` |
| BAN — Base Adresse Nationale | `https://adresse.data.gouv.fr/donnees-nationales` | `https://adresse.data.gouv.fr/data/ban/adresses/latest/csv/adresses-france.csv.gz` |
| API Découpage administratif (geo.api.gouv.fr) | `https://geo.api.gouv.fr/` | `https://geo.api.gouv.fr/communes?fields=nom,code,codeDepartement,population,centre&format=json` |

## Extraction en continu

L'objectif est de garder le warehouse à jour automatiquement, sans re-télécharger l'historique à chaque fois et sans dupliquer les lignes. La recette générale : **planification + watermark + chargement idempotent + tests**.

### 1. Cadence par source

| Catégorie | Cadence d'update producteur | Cadence d'extraction recommandée |
|---|---|---|
| DVF | semestrielle (avril / octobre) | mensuelle (vérification ETag/Last-Modified) |
| DPE (ADEME) | quotidienne | quotidienne, par delta `date_etablissement_dpe` |
| RPLS / Sit@del2 / FiLoSoFi / BPE / RP | annuelle | mensuelle (sentinel HEAD), full reload sur changement de millésime |
| Taux BdF / CSA | mensuelle / trimestrielle | hebdomadaire |
| Délinquance interstats | annuelle | mensuelle (HEAD) |
| Annuaire éducation | continu (API) | hebdomadaire incrémental |
| FINESS | mensuelle | mensuelle |
| GTFS transports | hebdomadaire | hebdomadaire (full snapshot) |
| COG / IGN / BAN | trimestrielle (BAN : continue) | mensuelle (HEAD) ; BAN : hebdomadaire |

### 2. Watermarking (état d'avancement par source)

Une table `pipeline_state` dans Postgres :

```sql
CREATE TABLE IF NOT EXISTS pipeline_state (
    source_id        TEXT PRIMARY KEY,         -- ex: 'dvf', 'dpe-existants'
    last_run_at      TIMESTAMPTZ,
    last_success_at  TIMESTAMPTZ,
    last_etag        TEXT,                     -- HTTP ETag du fichier source
    last_modified    TEXT,                     -- HTTP Last-Modified
    last_watermark   TEXT,                     -- ex: max(date_mutation) déjà chargé
    last_row_count   BIGINT
);
```

Avant chaque run :
- pour un **fichier statique** (DVF, COG, IGN…) : `HEAD` sur l'URL, comparer `ETag`/`Last-Modified` à `pipeline_state` — pas de changement → skip ;
- pour une **API delta** (DPE, BAN, annuaire éducation) : envoyer `?after=<token>` ou `?where=date_modification > <last_watermark>` ;
- pour un **dump versionné** (FiLoSoFi 2021, RP 2020…) : skip tant que le millésime publié est inchangé.

### 3. Chargement idempotent

Le schéma `raw_dvf_transaction` contient déjà `source_file` + `source_row_number` — c'est la clef anti-doublon. Deux patterns :

- **Append + dédup** (DVF, RPLS) : on insère puis on déduplique en `stg` via `ROW_NUMBER() OVER (PARTITION BY <id_naturel> ORDER BY ingested_at DESC) = 1`.
- **Upsert** (DPE, annuaire éducation) :

```sql
INSERT INTO raw_dpe (numero_dpe, ...)
VALUES (...)
ON CONFLICT (numero_dpe) DO UPDATE SET ...,
                                       ingested_at = now();
```

Côté dbt, basculer les modèles volumineux en `materialized='incremental'` :

```sql
{{ config(materialized='incremental', unique_key='transaction_id') }}
SELECT ...
FROM {{ ref('normalized_dvf_transaction') }}
{% if is_incremental() %}
  WHERE ingested_at > (SELECT max(ingested_at) FROM {{ this }})
{% endif %}
```

### 4. Orchestration (Airflow cible)

Un DAG **par domaine** + un DAG **gold** terminal :

```
dag_logement       (mensuel)  → dvf, rpls, sitadel, dpe
dag_demo           (mensuel)  → insee_rp, filosofi, bpe, qpv
dag_emprunt        (hebdo)    → bdf_taux, csa, taxe_fonciere
dag_cadre_vie      (mensuel)  → interstats, finess, education
dag_transports     (hebdo)    → gtfs (batch transport.data.gouv)
dag_referentiels   (mensuel)  → cog, ign_admin_express, ban
dag_gold_refresh   (déclenché par les autres) → dbt deps && dbt run && dbt test
```

Patterns à utiliser :
- `HttpSensor` pour vérifier qu'un fichier est publié (HEAD 200) avant de tirer ;
- `BashOperator` ou `PythonOperator` pour le téléchargement + `COPY` Postgres ;
- `DbtRunOperator` (`astronomer-cosmos` ou `airflow-dbt`) pour la couche transformation ;
- `on_failure_callback` → notification Slack / email ;
- `SLA` : 24 h pour les flux mensuels, 1 h pour les hebdo.

### 5. Backfill vs steady-state

- **Premier run** : on charge l'historique complet (tous les millésimes DVF, FiLoSoFi des dernières années, BPE depuis 2018…). Faisable hors orchestration via `scripts/load_dvf.sh url --url …` pour chaque millésime.
- **Steady-state** : Airflow ne récupère que les nouveautés via `pipeline_state`. Si le producteur publie un nouveau millésime, le DAG correspondant déclenche un backfill ciblé (insertion en `raw` puis re-run dbt).

### 6. Qualité & freshness

- **dbt tests** (`not_null`, `unique`, `relationships`) sur chaque modèle critique — déjà en place sur `dim_location` / `fact_transaction`.
- **Source freshness** dbt (`dbt source freshness`) : lever une alerte si `raw_dvf_transaction` ne s'est pas mis à jour depuis 90 jours, `raw_dpe` 7 jours, etc.
- **Tests métier** : `valeur_fonciere > 0`, `surface_reelle_bati > 0`, `code_commune` ∈ COG INSEE.
- **Observabilité** : log par run dans `pipeline_state`, dashboard Grafana sur `last_success_at` par source.

### 7. Outillage à considérer

- **`dlt`** (`pip install dlt`) — abstraction "Singer-like" pour les API delta : gère le state, le retry et le typage automatiquement. Bon candidat pour DPE / annuaire éducation.
- **`requests` + `tenacity`** pour les loaders maison sur fichiers statiques (DVF, INSEE).
- **`ogr2ogr`** (GDAL) pour ingérer Shapefile / GeoJSON IGN/QPV directement dans PostGIS.
- **dbt source freshness + Elementary Data** pour la surveillance.

## Stratégie ETL / ELT

Approche **ELT-first** : on charge les sources brutes telles quelles dans Postgres (couche `raw_*`) et on transforme avec **dbt** (SQL). On garde la traçabilité de la donnée et on tire parti de PostGIS côté warehouse. On bascule en **ETL** uniquement quand la source est trop large pour Postgres en l'état, ou quand un nettoyage lourd doit précéder le chargement (Polars / PySpark).

### Couches (medallion architecture)
```
raw  ─▶ stg  ─▶ normalized / dim / fact  ─▶ app_*
bronze   silver         gold                 marts API/UI
```

### Stratégie par source

| Source | Volumétrie indicative | Extraction | Transformation | Mode |
|---|---|---|---|---|
| DVF national | ~500 MB compressé, ~5 M lignes/an | Python (`urllib` → `COPY` Postgres) | dbt | **ELT** |
| DVF sample (dev) | < 1 MB | Python | dbt | ELT |
| INSEE FiLoSoFi | ~200 MB | **Polars** (lecture XLSX/CSV, pivot) → Postgres | dbt | **ETL léger** |
| INSEE RP (IRIS) | national large | **PySpark** (parquet ou direct gold) | PySpark + dbt | **ETL** |
| INSEE BPE | ~50 MB | **Polars** | dbt | ELT |
| Géométries IGN | volumineux | `ogr2ogr` → PostGIS | dbt + PostGIS | ELT |
| QPV | shapefile | `ogr2ogr` → PostGIS | dbt | ELT |
| Délinquance (interstats) | ~50 MB | **Polars** | dbt | ELT |
| Banque de France (taux) | quelques Ko | Python (HTTP / scrape) | dbt | ELT |
| BAN | ~5 GB | **PySpark** (jointures géocodage) | PySpark | **ETL** |
| GTFS transports | variable | Python (zip GTFS) → Postgres | dbt | ELT |

### Choix des outils de transformation

- **dbt** — outil principal. SQL pur, tests d'intégrité (`not_null`, `unique`, `relationships`), lineage, documentation auto. Couvre la majorité des transformations sur Postgres.
- **Polars** — sources moyennes nécessitant un prétraitement (pivots, parsing complexe, nettoyage). Plus rapide que pandas et l'empreinte mémoire est sensiblement plus faible — adapté au pré-load avant `COPY`.
- **PySpark** — jointures larges (BAN × DVF × INSEE) ou volume dépassant la RAM d'une machine. Permet aussi d'écrire directement la couche `gold` en parquet et de la charger ensuite dans Postgres.

### Orchestration
- **Court terme** : scripts shell (`data_platform/scripts/load_sample_demo.sh`) + cron pour les refresh nationaux.
- **Cible** : **Airflow** (`data_platform/airflow/dags/`) — un DAG par domaine (logement / démographie / sécurité / référentiels) + un DAG terminal `gold_refresh` déclenchant `dbt run` + `dbt test`.

### Mart cible pour la problématique

Une table `app_opportunity_score` (commune × période) combinera :

- **Prix & emprunt** : prix médian €/m², capacité d'emprunt indicative = `revenu_median * taux_endettement_max / mensualite_pour_taux_BdF`, charges récurrentes (taxe foncière).
- **Mixité sociale** : indice (Gini revenus, % de QPV dans la commune, écart-type des CSP, taux de pauvreté).
- **Qualité de vie** : score d'équipement (BPE), accessibilité transports (GTFS), sécurité (interstats normalisé), éducation (annuaire MEN).
- **Score composite** pondérable côté UI pour qu'un utilisateur ajuste l'arbitrage selon ses préférences.

## Démarrage rapide

```bash
# Data platform
cd data_platform
./scripts/bootstrap_venv.sh
./scripts/postgres_up.sh
./scripts/load_sample_demo.sh

# Backend
cd ../backend
cp .env.example .env
npm install
./scripts/run.sh           # http://localhost:3001 — Swagger sur /docs

# Frontend
cd ../frontend
cp .env.example .env.local
npm install
./scripts/run_dev.sh       # http://localhost:3000
```

## Suivi projet

Tickets Jira : projet **Homepedia** (clé `HOM`) sur `scarla-homepedia.atlassian.net`.