# HOMEPEDIA — Récapitulatif des travaux réalisés

Ce document résume l'ensemble des travaux menés sur cette session : **récupération et
intégration de 6 nouvelles sources de données**, **recâblage du mart de score**, **features
frontend** (dont 4 bonus), **résolution du merge `main`**, et **préparation du déploiement**.

Problématique cible : *« Comment concilier capacité d'emprunt réelle et indicateurs de
mixité sociale pour identifier les meilleures opportunités locales ? »*

---

## 1. Nouvelles sources de données (data engineering)

Le mart `app_opportunity_score` comportait des colonnes **bouchonnées** (`CAST(NULL AS …)`)
ou une hypothèse **codée en dur** (taux à 3,5 %). On a récupéré la **vraie donnée publique**
pour chacune, avec le même patron que l'existant : loader Python + `schema.sql` + script
shell + chaîne dbt (`staging → core`).

| Source | Producteur | Répertoire ingestion | Table `raw_*` | Modèles dbt | Comble |
|---|---|---|---|---|---|
| **Taux crédit immobilier** | BCE (série MIR France) | `ingestion/rates/` | `raw_interest_rate` | `stg_rates__interest_rate` → `normalized_interest_rate_monthly` | 🔴 capacité d'emprunt réelle |
| **Taxe foncière** | DGFiP | `ingestion/fiscalite/` | `raw_taxe_fonciere` | `stg_taxe_fonciere` → `normalized_taxe_fonciere_commune` | 🔴 charges récurrentes |
| **QPV** | ANCT | `ingestion/qpv/` | `raw_qpv` | `stg_qpv` → `normalized_qpv_commune` | 🟠 mixité sociale |
| **RP — CSP** | INSEE | `ingestion/rp/` | `raw_rp_csp` | `stg_rp__csp` → `normalized_rp_csp_commune` | 🟠 mixité (diversité CSP) |
| **Délinquance** | SSMSI | `ingestion/securite/` | `raw_delinquance` | `stg_delinquance` → `normalized_delinquance_commune` | 🟡 sécurité |
| **Codes postaux** | La Poste / Etalab | `ingestion/laposte/` | `raw_code_postal` | `stg_codes_postaux` → `dim_commune_postal` | 🔎 recherche (bonus) |

Provenance et URLs exactes : [`data_platform/data/raw/SOURCES.md`](../data_platform/data/raw/SOURCES.md).

**Scripts d'exécution** (sous-commandes `url` / `file` / `sample`) :
`load_rates.sh`, `load_taxe_fonciere.sh`, `load_qpv.sh`, `load_rp_csp.sh`,
`load_delinquance.sh`, `load_codes_postaux.sh` — tous dans `data_platform/scripts/`.

**Fixtures de test** tirées de la vraie donnée : `data_platform/tests/fixtures/*_sample.csv`.

**Intégration pipeline** :
- `scripts/_common.sh` — schémas raw des 6 sources appliqués au bootstrap.
- `dbt/models/staging/_sources.yml` — 6 nouvelles sources déclarées.
- `scripts/load_all_default.sh` — URLs par défaut + appels loaders avant l'étape dbt.
- **Airflow** — les 6 sources sont câblées dans les DAGs de domaine (`homepedia_demo`,
  `homepedia_referentiels`, + nouveaux `homepedia_emprunt` et `homepedia_cadre_vie`) via
  `dags/homepedia.py` (`SOURCES`) et `dags/dag_*.py`. Voir [`airflow_pipeline_fr.md`](airflow_pipeline_fr.md).

---

## 2. Recâblage du mart `app_opportunity_score`

Les colonnes stub sont désormais **alimentées par de la vraie donnée** :

| Colonne | Avant | Après |
|---|---|---|
| `assumed_interest_rate` | `0.035` en dur | **taux mensuel réel BCE** (fallback var) |
| `borrowing_capacity_eur` | `NULL` | **calculé** : mensualité soutenable (revenu médian × DTI / 12) capitalisée sur la durée au taux réel |
| `price_to_capacity_ratio` | `NULL` | **calculé** : prix médian de vente ÷ capacité |
| `qpv_share` | `NULL` | **nb de QPV** par commune |
| `safety_index` | `NULL` | **indice de sécurité** (percentile inverse du taux de délinquance) |
| `social_mix_score` | revenu + pauvreté | **+ diversité CSP (Simpson) + présence QPV** |
| `quality_of_life_score` | densité équipements | **+ sécurité** (BPE ⊕ délinquance) |
| `property_tax_rate_pct` *(nouvelle)* | — | taux global taxe foncière bâti |
| `csp_diversity_index` *(nouvelle)* | — | indice de diversité socioprofessionnelle |

Documentation dbt mise à jour dans `dbt/models/marts/schema.yml`.

**Reste à faire** : `transit_accessibility` (GTFS) — non récupéré (source nationale
fragmentée), voir §7.

---

## 3. Frontend

### Bloc « Accessibilité » (`components/AffordabilityCard.tsx`)
Cœur de la problématique : ratio prix/capacité + verdict clair (« Accessible / Tendu / Peu
accessible »), capacité d'emprunt **au taux réel**, prix médian, taxe foncière. Câblé dans
`HomeDashboard`, plomberie backend exposée (`stats.service`/`stats.controller`) + type front.

### Bonus livrés
| Bonus | Fichiers | Détail |
|---|---|---|
| **Carrousel thématique** | `ThematicCarousel.tsx`, `lib/themes.ts` | Raccourcis 🌊 Bord de mer / ⛰️ Montagne / 🏙️ Métropoles / 🎓 Étudiantes / 🌴 Outre-mer |
| **Tour guidé** (HOM-56) | `GuidedTour.tsx` | Onboarding sans dépendance externe, ancres `data-tour`, i18n, rejouable |
| **Temps réel** (HOM-66) | `LiveRefreshControl.tsx` | Toggle *Live* : auto-refresh 30 s de la commune sélectionnée |
| **Déploiement** (HOM-67) | Dockerfiles + compose | voir §6 |

i18n : nouvelles sections `themes` / `tour` / `live` ajoutées en **`en.ts` + `fr.ts`**.

### Recherche par code postal (HOM-85)
Déjà implémentée par l'équipe en amont (colonne `code_postal` sur `dim_location`) : cette
implémentation a été **conservée** lors du merge. La source **La Poste** ajoutée reste
disponible comme mapping exhaustif commune ↔ codes postaux (`dim_commune_postal`).

---

## 4. Intégration de `main` (merge)

`origin/main` avait **34 commits d'avance** (login, i18n FR/EN, dark/light mode, ranking,
DROM-COM, Spark/Airflow, recherche postale). Travaux réalisés :
- Stash → fast-forward → réapplication du travail.
- **5 conflits résolus** : recherche postale → version amont ; `AffordabilityCard` + colonnes
  score conservées ; `HomeDashboard` fusionné (structure amont + nos ajouts).
- Dépendances du login amont installées (`jsonwebtoken`, `cookie-parser`, `bcryptjs`).

---

## 5. Déploiement en ligne (config prête)

`backend/Dockerfile`, `frontend/Dockerfile` (multi-stage), `.dockerignore`,
**`docker-compose.prod.yml`** (Postgres/PostGIS + API + front), guide
**[`docs/deploiement_fr.md`](deploiement_fr.md)**. Exécution du déploiement = à faire par
l'équipe (accès cloud/domaine requis).

---

## 6. Vérifications réalisées

- `dbt parse` : **exit 0** (6 nouvelles sources + modèles amont dans le graphe).
- `backend tsc --noEmit` : **exit 0**.
- Frontend : composants ajoutés **typecheck clean** (les erreurs restantes sont le baseline
  amont : i18n littéral, types générés `.next`).
- **Extraction sur données réelles** validée pour chaque loader (champs clés non nuls).
- `py_compile` (loaders) + `bash -n` (scripts) OK.

---

## 7. Reste à faire

- **GTFS / `transit_accessibility`** : source nationale fragmentée (≈ centaines de flux par
  AOM) — à ingérer séparément ou à approximer via la BPE (arrêts/gares déjà chargés).
- **Exécution réelle** : lancer Postgres + `load_all_default.sh` + `dbt run`/`dbt test` pour
  matérialiser les tables (non fait ici, Docker éteint).
- **Commit** : l'ensemble est en *working tree*, non commité.
