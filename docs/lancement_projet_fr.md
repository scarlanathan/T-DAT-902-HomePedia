# Lancer le projet Homepedia — toutes les commandes

Guide opérationnel unique : **toutes les commandes** pour démarrer chaque brique de la
plateforme (warehouse, big data Spark/HDFS, orchestration, API, front) et pour la tester.

> Vues détaillées par brique : `docs/hdfs_spark_fr.md` (Spark/HDFS),
> `docs/airflow_pipeline_fr.md` (orchestration), `docs/data_flow.md` (modèles dbt),
> `docs/guide_fr.md` (architecture globale). README racine : `../README.md`.

---

## 0. Prérequis

| Outil | Usage |
|-------|-------|
| **Docker** + **Docker Compose** | Postgres/PostGIS, cluster Spark+HDFS, (Airflow) |
| **Python 3.11+** | loaders d'ingestion + dbt (dans un `.venv`) |
| **Node.js 20+** + **npm** | backend NestJS + frontend Next.js |
| **Bash** | les scripts `scripts/*.sh` (sous Windows : **Git Bash**) |

> **Windows** : lancer les `*.sh` depuis **Git Bash**. Les scripts exportent déjà
> `MSYS_NO_PATHCONV=1` pour ne pas réécrire les chemins conteneur (`/lake`, `/docker-...`).

### Ports utilisés

| Port | Service |
|------|---------|
| `5432` | Postgres/PostGIS (warehouse `homepedia`) |
| `9870` / `9864` | HDFS NameNode UI / DataNode UI |
| `8080` / `8081` | Spark master UI / worker UI *(et Airflow UI si lancé — conflit, voir §4)* |
| `3001` | Backend NestJS (Swagger sur `/docs`) |
| `3000` | Frontend Next.js |

---

## 1. Démarrage rapide (le chemin le plus court)

De quoi avoir la stack applicative complète avec les **données d'exemple**
(`tests/fixtures`, 26 communes) — idéal pour développer backend/frontend.

```bash
# 1) Data platform : warehouse + données d'exemple + dbt
cd data_platform
./scripts/bootstrap_venv.sh          # 1re fois seulement (.venv + requirements + dbt)
./scripts/postgres_up.sh             # Postgres/PostGIS (attend le "ready")
./scripts/load_sample_demo.sh        # charge les fixtures → raw_* puis dbt deps/run/test

# 2) Backend NestJS
cd ../backend
cp .env.example .env
npm install
./scripts/run.sh                     # http://localhost:3001  (Swagger : /docs)

# 3) Frontend Next.js
cd ../frontend
cp .env.example .env.local
npm install
./scripts/run_dev.sh                 # http://localhost:3000
```

> `bootstrap_venv.sh` n'est nécessaire qu'une fois (ou après un changement de
> `requirements*.txt`). Ensuite, `postgres_up.sh` suffit pour redémarrer.

---

## 2. Data platform (warehouse Postgres + dbt)

Deux bases sur la **même** instance PostGIS : `homepedia` (dev/prod) et
`homepedia_test` (tests, créée automatiquement par `postgres_up.sh`).

### Cycle de vie du warehouse

```bash
cd data_platform
./scripts/postgres_up.sh             # démarre le conteneur, attend pg_isready
./scripts/postgres_down.sh           # arrête le conteneur
```

### Charger les données

```bash
# Données d'EXEMPLE (fixtures) + dbt — pour le dev local
./scripts/load_sample_demo.sh

# Données de PRODUCTION (URLs publiques par défaut) + dbt refresh
./scripts/postgres_up.sh
./scripts/load_all_default.sh
#   options : DVF_MAX_ROWS=100000  BPE_TYPEQU_FILTER=C101,C102,…  SKIP_DBT=1
```

> `load_all_default.sh` charge désormais **toutes** les sources avec leurs URLs
> par défaut, y compris les 6 nouvelles (taux crédit BCE, taxe foncière, QPV,
> RP-CSP, délinquance, codes postaux).

Chargement d'**une** source à la main (chaque loader accepte `url` / `file` / `sample` ;
`--help` sur chacun) :

```bash
./scripts/load_dvf.sh      url --url 'https://…/full.csv.gz' --truncate --max-rows 100000
./scripts/load_cog.sh      url --url 'https://www.insee.fr/…/v_commune_2026.csv' --truncate
./scripts/load_bpe.sh      url --url 'https://www.insee.fr/…/BPE24.zip' --truncate --millesime 2024
./scripts/load_filosofi.sh url-v2 --url 'https://www.insee.fr/…/FILOSOFI_CC_csv.zip' --truncate
```

Les **6 nouvelles sources** (taux crédit BCE, taxe foncière, QPV, RP-CSP,
délinquance, codes postaux) disposent chacune de leur loader, avec les mêmes
sous-commandes `url` / `file` / `sample` :

```bash
# Taux crédit immobilier — BCE (série MIR France, mensuel) → raw_interest_rate
./scripts/load_rates.sh          url --url 'https://data-api.ecb.europa.eu/service/data/MIR/M.FR.B.A2C.A.R.A.2250.EUR.N?format=csvdata&detail=dataonly' --truncate

# Taxe foncière — DGFiP → raw_taxe_fonciere
./scripts/load_taxe_fonciere.sh  url --url 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/fiscalite-locale-des-particuliers/exports/csv?…' --truncate

# QPV — ANCT → raw_qpv
./scripts/load_qpv.sh            url --url 'https://static.data.gouv.fr/resources/quartiers-prioritaires-de-la-politique-de-la-ville-qpv/…/listeqp2024-cog2024.csv' --truncate

# RP catégories socioprofessionnelles (CSP) — INSEE → raw_rp_csp
./scripts/load_rp_csp.sh         url --url 'https://www.insee.fr/fr/statistiques/fichier/8268843/base-ic-activite-residents-2021_csv.zip' --truncate

# Délinquance communale — SSMSI → raw_delinquance
./scripts/load_delinquance.sh    url --url 'https://static.data.gouv.fr/resources/bases-statistiques-communale-…delinquance…/….csv.gz' --truncate

# Codes postaux — La Poste/Etalab → raw_code_postal
./scripts/load_codes_postaux.sh  url --url 'https://datanova.laposte.fr/data-fair/api/v1/datasets/laposte-hexasmal/raw' --truncate
```

### Faire tourner dbt

```bash
./scripts/dbt.sh deps                # installe les packages dbt
./scripts/dbt.sh run                 # construit raw_* → stg_* → … → app_*  (base homepedia)
./scripts/dbt.sh test                # tests dbt sur la base dev
```

---

## 3. Big Data — cluster HDFS + Spark

Couche de nettoyage distribué : HDFS = lac de fichiers bruts, Spark = moteur qui écrit
du Parquet propre dans `/lake/curated`. Détails : `docs/hdfs_spark_fr.md`.

```bash
cd data_platform
./scripts/hadoop_up.sh               # démarre le cluster + crée l'arbo /lake dans HDFS
./scripts/hdfs_put_raw.sh            # dépose les 4 CSV d'exemple dans /lake/raw
./scripts/spark_clean.sh             # spark-submit run_all.py → /lake/curated
```

Variantes utiles :

```bash
./scripts/hdfs_put_raw.sh dvf /chemin/vers/dvf_2024.csv   # déposer un fichier réel
./scripts/spark_clean.sh dvf                              # ne relancer qu'une étape
./scripts/spark_clean.sh analyse_commune                 # relancer la jointure finale (aperçu)

# inspecter le résultat dans HDFS
docker exec homepedia-namenode hdfs dfs -ls -R /lake/curated

# arrêter (— --wipe pour effacer aussi les volumes HDFS)
./scripts/hadoop_down.sh
./scripts/hadoop_down.sh --wipe
```

UIs : HDFS <http://localhost:9870>, Spark master <http://localhost:8080>,
worker <http://localhost:8081>. Ajouter des workers :
`docker compose -f spark/docker-compose.yml up -d --scale spark-worker=3`.

### Mode local (sans cluster)

```bash
export SPARK_MASTER=local[*]
export LAKE_ROOT=file:///chemin/absolu/vers/lake   # CSV sous lake/raw/<source>/
spark-submit spark/run_all.py
```

---

## 4. Orchestration Airflow *(optionnel)*

Planifie les ingestions + le refresh dbt. Détails et schémas : `docs/airflow_pipeline_fr.md`.

> Les DAGs de domaine sont maintenant **5** — `homepedia_referentiels` (COG,
> BPE, **codes postaux**), `homepedia_logement`, `homepedia_demo` (Filosofi,
> **QPV**, **RP-CSP**), `homepedia_emprunt` (**taux crédit BCE**, **taxe
> foncière**, schedule `0 6 1 * *`) et `homepedia_cadre_vie` (**délinquance**,
> schedule `0 7 1 * *`) — plus le DAG terminal `gold_refresh`. Les 6 nouvelles
> sources y sont câblées ; chacune suit `check_source → load_* → trigger_gold_refresh`.
> Les URLs sont centralisées dans le dict `SOURCES` de
> `data_platform/airflow/dags/homepedia.py`.

> ⚠️ Dans ce checkout, la stack Airflow (`docker-compose.yml`, `Dockerfile`,
> `.env.example`) **n'est pas présente** (seul un `dags/.gitkeep`). Les commandes
> ci-dessous supposent la branche qui livre `data_platform/airflow/`. Le warehouse
> `homepedia` doit tourner **avant** Airflow.
>
> ⚠️ L'UI Airflow écoute aussi sur **:8080** → conflit avec le Spark master. Ne pas
> lancer les deux clusters en même temps, ou remapper le port.

```bash
cd data_platform
./scripts/postgres_up.sh             # le warehouse homepedia d'abord

cd airflow
cp .env.example .env                 # sous Linux : renseigner AIRFLOW_UID=$(id -u)
docker compose up -d --build         # 1er build : installe loaders + dbt

# UI : http://localhost:8080  (admin / admin par défaut)
docker compose exec airflow-scheduler airflow dags list
docker compose exec airflow-scheduler airflow dags trigger homepedia_referentiels
docker compose down                  # arrêter (-v pour effacer la base de métadonnées)
```

---

## 5. Backend (NestJS)

```bash
cd backend
cp .env.example .env
npm install
./scripts/run.sh                     # http://localhost:3001  — Swagger : /docs
```

---

## 6. Frontend (Next.js)

```bash
cd frontend
cp .env.example .env.local
npm install
./scripts/run_dev.sh                 # http://localhost:3000
./scripts/build.sh                   # build de production
```

---

## 7. Tests

```bash
# Data platform (base isolée homepedia_test — ne touche pas les données dev)
cd data_platform
./scripts/postgres_up.sh             # garantit l'existence de homepedia_test
./scripts/ingestion_test.sh          # pytest des loaders
./scripts/dbt_test.sh                # tests dbt sur homepedia_test
./scripts/test.sh                    # pipeline complet : ingestion + dbt run + dbt test

# Backend
cd ../backend && ./scripts/test.sh

# Frontend
cd ../frontend && ./scripts/test.sh && ./scripts/lint.sh
```

---

## 8. Tout arrêter

```bash
cd data_platform
./scripts/postgres_down.sh           # warehouse
./scripts/hadoop_down.sh             # cluster Spark/HDFS  (--wipe pour purger HDFS)
# Airflow (si lancé) :
cd airflow && docker compose down
# Backend / frontend : Ctrl-C dans leurs terminaux respectifs
```

---

## 9. Récapitulatif — l'ordre de lancement

```
Prérequis (Docker, Python, Node)
        │
        ▼
bootstrap_venv.sh ──▶ postgres_up.sh ──▶ load_sample_demo.sh   (warehouse + dbt)
        │                                        │
        │  (big data, optionnel)                 ▼
        └─▶ hadoop_up.sh ▶ hdfs_put_raw.sh ▶ spark_clean.sh
                                                 │
                                                 ▼
                          backend (run.sh :3001) + frontend (run_dev.sh :3000)
```
