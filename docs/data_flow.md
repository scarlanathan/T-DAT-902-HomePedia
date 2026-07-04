# Flux de données et couches de l'entrepôt

Ce document décrit le **découpage cible en couches** des données structurées dans PostgreSQL (en aval du lac). Chaque couche a un rôle unique ; les noms utilisent des préfixes en **snake_case** pour que la responsabilité de chacune soit évidente.

## En amont de l'entrepôt : le lac (HDFS) et Spark

Les couches ci-dessous démarrent à `raw_*` — la première forme **relationnelle**. En amont se trouvent le **lac de fichiers** et le nettoyage distribué qui l'alimentent (`docs/guide_fr.md` §3) :

```
sources → ingestion → HDFS /lake/raw  → Spark → HDFS /lake/curated → Postgres raw_*
          (Python)    (fichiers          (nettoyage  (Parquet typé)      (chargement)
                       immuables,         à l'échelle)
                       rejouables)
```

| Étape | Où | Rôle |
|-------|-----|------|
| Atterrissage | **HDFS** `/lake/raw/<source>/` | Fichiers sources à l'octet près tels que publiés ; historique immuable, rejouable/auditable. Non interrogé par l'app. |
| Nettoyage | **Spark** (jobs PySpark, un par source) | Parsing, cast, déduplication, filtrage, normalisation et agrégation à l'échelle. |
| Curated | **HDFS** `/lake/curated/<dataset>/` | **Parquet** nettoyé et typé (ex. DVF partitionné par département). Chargé dans Postgres `raw_*` par le service de transformation. |

Pourquoi un étage lac + Spark séparé plutôt que charger le CSV directement dans Postgres : à
l'échelle nationale (DVF ≈ plusieurs Go/an), le gros du travail de parsing/déduplication/agrégation
s'exécute **de façon distribuée** dans Spark, si bien que ce qui atterrit dans `raw_*` est déjà
compact et propre, et les fichiers d'origine restent rejouables si une règle de nettoyage change.
Les jobs, le cluster et les commandes d'exécution : `data_platform/spark/README.md`.

> Les petits chargements de dev peuvent toujours aller directement dans Postgres `raw_*` via les
> loaders `ingestion/*/load_raw_*.py` ; le chemin HDFS→Spark est la voie scalable pour les
> traitements à pleine volumétrie.

## Couches (de haut en bas)

| Couche | Préfixe | Rôle |
|--------|---------|------|
| Application / serving | `app_*` | Tables au format API/UI : agrégats, lectures dénormalisées, matérialisées si utile. Contrats stables pour NestJS. |
| Modèle dimensionnel | `dim_*`, `fact_*` | Schéma en étoile : **grain** déclaré par fait ; dimensions (ex. localisation, date, bien). |
| Core / conforme | `normalized_*` | Déduplication, clés de substitution, règles métier, jointures entre sources. |
| Staging (optionnel) | `stg_*` | Renommages, casts, nettoyage léger ; toujours une ligne par ligne brute. |
| Raw | `raw_*` | Première forme relationnelle issue de l'ingestion / du service de transformation ; conserve les colonnes sources + les métadonnées de chargement (`ingested_at`, `source_file`, etc.). |

**Flux (entrepôt) :** `raw_*` → `stg_*` → `normalized_*` → `dim_*` / `fact_*` → `app_*`

**Flux complet (lac → entrepôt) :** `HDFS /lake/raw` → `Spark` → `HDFS /lake/curated` → `raw_*` → `stg_*` → `normalized_*` → `dim_*` / `fact_*` → `app_*`

## Exemple (DVF → synthèse par ville)

| Couche | Table d'exemple | Note |
|--------|-----------------|------|
| Lac — raw | `hdfs:/lake/raw/dvf/*.csv` | CSV source tel que publié (immuable) |
| Lac — curated | `hdfs:/lake/curated/dvf/` | Parquet nettoyé par Spark, partitionné par département |
| Raw | `raw_dvf_transaction` | Tel qu'atterri + traçabilité |
| Staging | `stg_dvf__transaction` | Typé, nettoyé |
| Core | `normalized_dvf_transaction` (ou `normalized_sale`) | Grain + déduplication + mesures |
| Dimension | `dim_location` | Cible de jointure pour tous les faits rattachés à un territoire |
| Fait | `fact_transaction` | Une ligne par **vente** au grain documenté |
| App | `app_city_housing_summary` | Métriques pré-agrégées pour l'API |

## Sources intégrées (traçabilité par couche)

Toutes les sources suivent le même flux `raw_* → stg_* → normalized_* → (dim/fact) → app_*`.
Récapitulatif des tables par source (au-delà de DVF détaillé ci-dessus) :

| Source | `raw_*` | `stg_*` | `normalized_*` / `dim_*` | Sert dans |
|---|---|---|---|---|
| COG (INSEE) | `raw_insee_cog_*` | `stg_cog__*` | `normalized_cog_*` → `dim_location/departement/region` | référentiel de jointure |
| BPE (INSEE) | `raw_bpe_equipement` | `stg_bpe__equipement` | `normalized_bpe_equipement` → `fact_equipment` | `app_city_equipment_summary` |
| FiLoSoFi (INSEE) | `raw_filosofi` | `stg_filosofi__indicator` | `normalized_filosofi_commune/iris` | `app_city_social_summary`, `app_iris_social_summary` |
| **Taux crédit (BCE)** | `raw_interest_rate` | `stg_rates__interest_rate` | `normalized_interest_rate_monthly` | `app_opportunity_score` (capacité d'emprunt) |
| **Taxe foncière (DGFiP)** | `raw_taxe_fonciere` | `stg_taxe_fonciere` | `normalized_taxe_fonciere_commune` | `app_opportunity_score` (charges) |
| **QPV (ANCT)** | `raw_qpv` | `stg_qpv` | `normalized_qpv_commune` | `app_opportunity_score` (mixité) |
| **RP-CSP (INSEE)** | `raw_rp_csp` | `stg_rp__csp` | `normalized_rp_csp_commune` | `app_opportunity_score` (diversité CSP) |
| **Délinquance (SSMSI)** | `raw_delinquance` | `stg_delinquance` | `normalized_delinquance_commune` | `app_opportunity_score` (sécurité) |
| **Codes postaux (La Poste)** | `raw_code_postal` | `stg_codes_postaux` | `dim_commune_postal` | recherche par code postal |

> Le mart transversal `app_opportunity_score` (grain commune × mois) **combine** DVF, FiLoSoFi,
> BPE, taux BCE, taxe foncière, QPV, RP-CSP et délinquance en un score composite pondérable.
> Détail du calcul : [`scores_explain_fr.md`](scores_explain_fr.md) et
> [`travaux_realises_fr.md`](travaux_realises_fr.md).

## Habitudes de conception

- Documenter le **grain** sur chaque `fact_*` (ex. une ligne par vente notariée).
- Garder le **temps** cohérent (`dim_date` ou colonnes de date explicites) pour les tendances.
- Ajouter des **tests** aux frontières (ex. clés uniques sur `normalized_*`, FK not-null sur les faits).

L'indexation OpenSearch reste **après** les marts : un modèle de publication dédié (ex. `mart_search_*`) alimenté par la même couche dimensionnelle, synchronisé en batch — voir `guide.md` §3.
