# Orchestration des ingestions avec Airflow (HOM-22)

Ce document explique **ce qu'est Airflow**, **comment il fonctionne**, et **la pipeline
mise en place** pour Homepedia : la planification automatique des jobs d'ingestion
(DVF, COG, BPE, FiLoSoFi) suivie du rafraîchissement dbt.

> **Mise à jour — sources élargies.** Six sources supplémentaires ont été intégrées à la
> couche d'ingestion (loader + `schema.sql` + script `load_*.sh` + modèles dbt) et à
> `scripts/load_all_default.sh` : **taux crédit immobilier (BCE)**, **taxe foncière (DGFiP)**,
> **QPV (ANCT)**, **RP-CSP (INSEE)**, **délinquance (SSMSI)**, **codes postaux (La Poste)**.
> Elles sont désormais **câblées** dans les DAGs de domaine (voir §4). Détail complet :
> [`travaux_realises_fr.md`](travaux_realises_fr.md).

> Code : [`data_platform/airflow/`](../data_platform/airflow/) · Guide opérationnel court :
> [`data_platform/airflow/README.md`](../data_platform/airflow/README.md)

---

## 1. Pourquoi un orchestrateur ?

Aujourd'hui, charger les données se fait **à la main** :

```bash
./scripts/load_cog.sh url --url '.../v_commune_2026.csv' --truncate
./scripts/load_dvf.sh url --url '.../full.csv.gz' --truncate
./scripts/dbt.sh run
```

Ça marche, mais il faut :
- se souvenir de **l'ordre** (charger les données *avant* de lancer dbt),
- le **relancer** régulièrement (les sources INSEE/data.gouv sont mises à jour),
- **surveiller** les échecs (un téléchargement qui casse, une source indisponible),
- **rejouer** seulement l'étape qui a échoué.

Un orchestrateur automatise tout ça. On décrit **quoi faire**, **dans quel ordre**,
**à quelle fréquence**, et il s'occupe de l'exécution, des dépendances, des
relances et de l'historique.

---

## 2. Airflow en 5 concepts

Apache Airflow est l'orchestrateur de référence. On y décrit des workflows **en
Python**. Cinq notions suffisent pour comprendre notre pipeline :

| Concept | C'est quoi | Chez nous |
|---|---|---|
| **DAG** | *Directed Acyclic Graph* : un workflow = un graphe de tâches sans cycle. | `homepedia_referentiels`, `homepedia_logement`, … |
| **Task** | Une étape du DAG (un nœud du graphe). | `load_cog_commune`, `dbt_run`, … |
| **Operator** | Le *type* d'une tâche : ce qu'elle exécute. | `BashOperator` (lance un script), `PythonOperator` (lance une fonction), `TriggerDagRunOperator` (déclenche un autre DAG). |
| **Scheduler** | Le processus qui lit les DAGs, décide quoi lancer et quand, en respectant les dépendances. | conteneur `airflow-scheduler` |
| **Executor** | Le composant qui exécute réellement les tâches. | `LocalExecutor` (tâches en sous-processus sur la même machine) |

### Dépendances et planning

- Les **dépendances** s'écrivent avec `>>` : `a >> b` signifie « b démarre quand a
  a réussi ». Une tâche n'est lancée que si **toutes** ses tâches amont ont réussi.
- Le **planning** (`schedule`) est un cron : `"0 3 1 * *"` = « à 03 h 00, le 1er de
  chaque mois ». `schedule=None` = uniquement déclenché manuellement ou par un
  autre DAG.

### Cycle de vie d'une tâche

```
none → scheduled → queued → running → success
                                    ↘ failed → up_for_retry → running → … (retries)
```

Un **run** (exécution datée d'un DAG) regroupe les états de toutes ses tâches.

---

## 3. Architecture déployée

On lance Airflow avec **Docker Compose**, en **LocalExecutor** (simple, mono-machine,
idéal pour le projet). 4 services :

```
data_platform/airflow/docker-compose.yml
├── airflow-meta        Postgres dédié aux métadonnées d'Airflow (état des runs)
├── airflow-init        migration de la base + création de l'utilisateur admin (one-shot)
├── airflow-scheduler   lit les DAGs, planifie et EXÉCUTE les tâches (LocalExecutor)
└── airflow-webserver   l'UI web sur http://localhost:8080
```

> ⚠️ **Deux bases Postgres distinctes, à ne pas confondre :**
> - `airflow-meta` → métadonnées **d'Airflow** (qui a tourné, quand, statut).
> - `homepedia` → le **warehouse** métier (où atterrissent les données). Airflow
>   n'y touche que via les loaders ; il ne stocke aucune métadonnée dedans.

### Schéma global

```
                          ┌─────────────────────────────────────────┐
                          │              AIRFLOW (Docker)            │
   ┌───────────┐          │  ┌────────────┐      ┌───────────────┐  │
   │  Web UI    │◀────────┼──│ webserver  │      │  airflow-meta │  │
   │  :8080     │          │  └────────────┘      │  (Postgres)   │  │
   └───────────┘          │  ┌────────────┐──────▶└───────────────┘  │
                          │  │ scheduler  │  lit/écrit l'état         │
                          │  │+LocalExec. │                           │
                          │  └─────┬──────┘                           │
                          └────────┼──────────────────────────────────┘
                                   │ exécute (BashOperator)
                                   │  bash scripts/load_*.sh / dbt.sh
                                   ▼
        ┌──────────────────────────────────────────────────────────┐
        │   data_platform (monté dans le conteneur en lecture/écrit) │
        │   ingestion/*/load_raw_*.py   ·   dbt/                      │
        └───────────────────────┬────────────────────────────────────┘
                                 │ psycopg / dbt
                                 ▼
                       ┌───────────────────┐      téléchargements HTTPS
                       │  Postgres homepedia│◀──── INSEE / data.gouv
                       │   (le warehouse)   │
                       └───────────────────┘
```

### Image Docker ([`Dockerfile`](../data_platform/airflow/Dockerfile))

L'image officielle Airflow est étendue avec :
- `git` + `curl` (dbt clone ses packages ; les loaders téléchargent en HTTPS) ;
- les dépendances des loaders (`psycopg`, `python-dotenv`) dans l'environnement
  Python d'Airflow ;
- **dbt dans un venv isolé** (`/home/airflow/dbt-venv`) pour ne pas entrer en
  conflit avec les versions épinglées par Airflow. Seul le binaire `dbt` est
  exposé sur le `PATH` (via un symlink) : `python3` reste l'interpréteur Airflow.

### Connexion au warehouse

Le conteneur Airflow et le warehouse `homepedia` sont **deux stacks Docker
indépendantes**. Airflow joint le warehouse par `host.docker.internal:5432`
(le port publié par `data_platform/docker-compose.yml` sur l'hôte). La config
(`POSTGRES_HOST`, `POSTGRES_USER`, …) est injectée en variables d'environnement,
exactement celles que lisent déjà `_common.sh` et `profiles.yml`.

---

## 4. La pipeline

**Principe directeur : Airflow ne ré-implémente rien.** C'est une fine couche de
planification au-dessus des scripts existants (`scripts/load_*.sh`, `scripts/dbt.sh`).
La logique d'ingestion reste à un seul endroit. Si un loader évolue, le DAG en
profite sans modification.

### Les DAGs (6 domaines + 1 terminal)

| DAG | Planning | Charge | Tables `raw_*` |
|---|---|---|---|
| `homepedia_referentiels` | `0 3 1 * *` (mensuel) | COG commune / dpt / région **+ codes postaux (La Poste)** | `raw_insee_cog_*`, `raw_code_postal` |
| `homepedia_logement` | `0 4 1 * *` (mensuel) | geo-DVF | `raw_dvf_transaction` |
| `homepedia_demo` | `0 5 1 * *` (mensuel) | BPE + FiLoSoFi **+ QPV (ANCT) + RP-CSP (INSEE)** | `raw_bpe_equipement`, `raw_filosofi`, `raw_qpv`, `raw_rp_csp` |
| `homepedia_emprunt` | `0 6 1 * *` (mensuel) | **taux crédit (BCE) + taxe foncière (DGFiP)** | `raw_interest_rate`, `raw_taxe_fonciere` |
| `homepedia_cadre_vie` | `0 7 1 * *` (mensuel) | **délinquance (SSMSI)** | `raw_delinquance` |
| `homepedia_gold_refresh` | déclenché | `dbt deps && dbt run && dbt test` | construit `stg_* → app_*` |

### Sources et DAG cible

Les 6 sources ajoutées sont **câblées** : chacune s'attache à son DAG de domaine par un couple
`check_source → load_*` (fichiers `dags/dag_*.py`), en amont du `trigger_gold_refresh`.

| Source | Script | Table `raw_*` | DAG | Cadence producteur |
|---|---|---|---|---|
| Taux crédit immobilier (BCE) | `load_rates.sh` | `raw_interest_rate` | `homepedia_emprunt` | mensuelle |
| Taxe foncière (DGFiP) | `load_taxe_fonciere.sh` | `raw_taxe_fonciere` | `homepedia_emprunt` | annuelle |
| QPV (ANCT) | `load_qpv.sh` | `raw_qpv` | `homepedia_demo` | irrégulière |
| RP-CSP (INSEE) | `load_rp_csp.sh` | `raw_rp_csp` | `homepedia_demo` | annuelle |
| Délinquance (SSMSI) | `load_delinquance.sh` | `raw_delinquance` | `homepedia_cadre_vie` | annuelle |
| Codes postaux (La Poste) | `load_codes_postaux.sh` | `raw_code_postal` | `homepedia_referentiels` | trimestrielle |

Les URLs par défaut de ces sources sont centralisées dans `dags/homepedia.py` (dict `SOURCES`),
surchargeables par variable d'environnement — même contrat que `scripts/load_all_default.sh`.

### Le motif commun à chaque DAG domaine

```
  check_source (HEAD)  ──▶  load_*  ──▶  trigger_gold_refresh
       │                      │                  │
  vérifie que l'URL      réutilise          déclenche le DAG
  est disponible         scripts/load_*.sh  homepedia_gold_refresh
  (HttpSensor-like)
```

1. **`check_source`** (`PythonOperator`) : un `HEAD` HTTP vérifie que la source
   est disponible avant de tirer le fichier (motif « HttpSensor → HEAD 200 »).
   Les hôtes INSEE qui refusent `HEAD` (403/405) sont tolérés — le loader lèvera
   une vraie erreur de téléchargement si besoin. Seuls les 404/5xx/réseau coupent.
2. **`load_*`** (`BashOperator`) : lance le script `scripts/load_*.sh` existant,
   qui télécharge le fichier et le charge dans `raw_*` via le loader Python.
3. **`trigger_gold_refresh`** (`TriggerDagRunOperator`) : déclenche le DAG dbt.

### Le DAG terminal `homepedia_gold_refresh`

```
   dbt_deps  ──▶  dbt_run  ──▶  dbt_test
```

`schedule=None` + `max_active_runs=1` : il ne tourne que lorsqu'il est déclenché,
et **un seul à la fois**. Conséquence : si plusieurs ingestions tombent dans la
même fenêtre, leurs déclenchements se **sérialisent** au lieu de se marcher dessus.

### Schéma de bout en bout

```
  referentiels        logement       demo              emprunt         cadre_vie
  (COG + codes        (DVF)          (BPE + FiLoSoFi   (taux BCE +     (délinquance)
   postaux)                           + QPV + RP-CSP)   taxe foncière)
       │                 │               │                 │               │
       └─────────────────┴───────────────┼─────────────────┴───────────────┘
                                          ▼  trigger
                          ┌─────────────────────────────┐
                          │   homepedia_gold_refresh     │
                          │   dbt deps → run → test       │
                          │   raw_* → stg_* → … → app_*   │
                          └─────────────────────────────┘
```

C'est exactement l'architecture *medallion* du projet (`raw → stg → normalized →
dim/fact → app_*`), mais déclenchée automatiquement.

### Paramétrage

Tout est surchargeable par variable d'environnement (fichier `.env`), sans toucher
au code des DAGs :
- **URLs sources** : `DVF_CSV_URL`, `COG_COMMUNE_URL`, `BPE_URL`, … (défauts =
  ceux de `scripts/load_all_default.sh`). Une valeur vide retombe sur le défaut.
- **`DVF_MAX_ROWS`** : plafonne l'ingestion DVF (le fichier national fait ~500 Mo /
  ~5 M lignes) — utile en dev. Le `.env.example` le fixe à `100000`.
- **`BPE_TYPEQU_FILTER`** : ne garde que certains types d'équipements.
- **`SLACK_WEBHOOK_URL`** : si défini, chaque échec de tâche envoie une notification.

---

## 5. Utilisation

Le warehouse doit tourner **avant** Airflow :

```bash
cd data_platform
./scripts/postgres_up.sh                 # le warehouse homepedia

cd airflow
cp .env.example .env                      # config (AIRFLOW_UID sur Linux : id -u)
docker compose up -d --build              # 1er build : installe loaders + dbt
```

- **UI** : <http://localhost:8080> (`admin` / `admin` par défaut).
- Les DAGs arrivent **en pause** : il faut les activer (toggle dans l'UI, ou
  `airflow dags unpause <dag_id>`) pour qu'ils suivent leur planning.
- **Déclencher à la main** : bouton ▶ dans l'UI, ou
  `docker compose exec airflow-scheduler airflow dags trigger homepedia_referentiels`.

### Commandes utiles

```bash
cd data_platform/airflow

# Lister les DAGs et repérer les erreurs d'import
docker compose exec airflow-scheduler airflow dags list
docker compose exec airflow-scheduler airflow dags list-import-errors

# Tester une tâche isolée, en réel, SANS le scheduler (exécution in-process)
docker compose exec airflow-scheduler airflow tasks test homepedia_referentiels load_cog_commune 2026-06-01

# Suivre un run
docker compose exec airflow-scheduler airflow dags list-runs -d homepedia_referentiels

# Arrêter (ajouter -v pour effacer aussi la base de métadonnées)
docker compose down
```

> `airflow tasks test` est idéal pour déboguer : il exécute la vraie tâche
> (téléchargement + écriture warehouse) en ignorant le scheduler et l'historique.

---

## 6. Vérification réalisée

Le DAG `homepedia_referentiels` a été exécuté **de bout en bout via le scheduler**,
contre les URLs INSEE réelles. Résultat : les 5 tâches en `success` et les données
dans le warehouse —

| Table | Lignes |
|---|---|
| `raw_insee_cog_commune` | 37 496 |
| `raw_insee_cog_departement` | 101 |
| `raw_insee_cog_region` | 18 |

Trois points de friction ont été corrigés au passage :
1. **URL vide** : un override d'environnement vide écrasait l'URL par défaut →
   helper de *fallback*.
2. **CRLF** : les `.sh` checkout-és en CRLF sous Windows cassaient `set -o pipefail`
   dans le conteneur Linux → `.gitattributes` force LF sur les scripts.
3. **PATH dbt** : le venv dbt masquait l'interpréteur Python d'Airflow (perte de
   `psycopg`) → seul le binaire `dbt` est exposé.

---

## 7. Limites & prochaines étapes

- **LocalExecutor / mono-machine** : adapté au dev. En prod → CeleryExecutor ou
  KubernetesExecutor, et secrets externalisés.
- **`--truncate` + rechargement complet** : pas encore de *watermarking*. La suite
  (décrite dans le README racine) : table `pipeline_state` (ETag/Last-Modified)
  pour **sauter** les fichiers inchangés, modèles dbt `incremental`, et alertes
  `dbt source freshness`. Le `check_source` (HEAD) en est la première brique.
- **Sources sans loader** (RPLS, Sit@del2, DPE, transports GTFS, annuaire éducation, FINESS…) :
  elles se brancheront ici dès qu'un `load_*.sh` correspondant existera, en ajoutant une tâche
  dans le DAG du domaine concerné (`homepedia_logement` ou `homepedia_cadre_vie`). Les 6
  sources récemment ajoutées (taux, taxe, QPV, RP-CSP, délinquance, codes postaux) sont déjà
  câblées (§4).
- **Notifications** : seul Slack est câblé (via webhook) ; e-mail/`on_failure`
  plus fins possibles.
