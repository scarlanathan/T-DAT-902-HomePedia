# HOMEPEDIA — Réponse aux retours pédagogiques

Ce document répond **point par point** aux remarques et recommandations de l'enseignant, en
s'appuyant sur l'état **réel et actuel** du projet (le code, l'architecture et le board Jira).

> Documents liés : problématique et sources `docs/guide_fr.md` ; flux de données
> `docs/data_flow.md` ; big data `docs/hdfs_spark_fr.md`.

---

## 0. Mise à jour de l'avancement (le constat de départ a évolué)

Le retour notait « *pas encore de réflexion côté back, architecture ou BDD* ». C'était vrai en
début de phase ; ce n'est **plus le cas**. À ce jour le **chemin produit principal est debout** de
bout en bout :

```
INSEE / data.gouv → ingestion Python → HDFS + Spark → Postgres/PostGIS → dbt → API NestJS → front React
```

| Brique | État |
|--------|------|
| Architecture | Définie et documentée (`docs/guide_fr.md`, `docs/data_flow.md`) |
| BDD | **PostgreSQL + PostGIS** en place (dev + test), schémas `raw_*`, contraintes, index |
| Back | **NestJS** : modules locations, map, stats, transactions, equipment, health (avec tests) |
| Front | **React / Next.js** branché sur l'API réelle (carte, cartes d'indicateurs, tendances) |
| Big data | **HDFS + Spark** : lac brut + jobs de nettoyage distribués (validés sur cluster) |
| Modélisation | **dbt** : staging → core → marts (dont `app_opportunity_score`) |
| Orchestration | **Airflow** : 5 DAGs domaine + `gold_refresh` (dont les nouveaux `homepedia_emprunt` et `homepedia_cadre_vie`) |

L'objectif final — **pipeline automatisé en production** — reste la cible. L'**orchestration
(Airflow)** est désormais câblée (voir §9) ; la **configuration de déploiement en ligne** est prête
(`docker-compose.prod.yml`, `docs/deploiement_fr.md`) et il reste à l'**exécuter sur le cloud**.

---

## 1. « Construire d'abord un jeu de données, puis bâtir le front dessus »

✅ **Fait dans cet ordre.** On a d'abord constitué le jeu de données avant de coder le front :

1. **Ingestion** des sources INSEE / data.gouv → tables `raw_*` Postgres (loaders versionnés :
   `data_platform/ingestion/{dvf,insee,filosofi,bpe}/`).
2. **Nettoyage/normalisation** : Spark (lac) + dbt (entrepôt) → marts exploitables.
3. **Exposition** : l'API NestJS sert ces marts.
4. **Front** : React consomme l'API — il a été (re)câblé sur les **vraies données** (ticket HOM-81),
   plus aucune donnée factice.

Le front n'a donc jamais dicté l'existence des données : il s'appuie sur un jeu déjà constitué et testé.

---

## 2. « Définir la problématique avant tout — quelle histoire raconter ? »

✅ **Problématique arrêtée** (`docs/guide_fr.md` §1.2) :

> **Optimisation du choix de résidence — comment concilier capacité d'emprunt réelle et
> indicateurs de mixité sociale pour identifier les meilleures opportunités locales ?**

**L'histoire** : « Pour mon budget réel, *où* puis-je acheter, et ces endroits sont-ils
socialement équilibrés et bien équipés ? » On dépasse le simple prix/m² pour livrer un
**score d'opportunité par commune**. Elle se décompose en briques, toutes jointes sur le
**code commune INSEE** :

- **A — Capacité d'emprunt** : revenu local (Filosofi) + **taux réel BCE** (série MIR) → capital
  empruntable (`borrowing_capacity_eur`), confronté au prix/m² (DVF) via `price_to_capacity_ratio`.
- **B — Mixité sociale** : déciles de revenus, taux de pauvreté, ratio interdécile (Filosofi),
  enrichie de la **diversité CSP** (indice de Simpson, RP-CSP INSEE) et de la présence de **QPV** (ANCT).
- **C — Socle géographique** : référentiel communes/dép./régions (COG INSEE).
- **D — Qualité de vie / services** : densité d'équipements (BPE) et **sécurité** (délinquance SSMSI).

Ce fil conducteur se matérialise dans le mart **`app_opportunity_score`** (ticket HOM-79).

### 2.1 Mise à jour — le score est désormais alimenté par de vraies données

Les composantes qui reposaient sur des hypothèses sont maintenant **branchées sur des sources
réelles**, ce qui recentre chaque indicateur sur la problématique (et écarte les données inutiles) :

- **Capacité d'emprunt** : le taux réel **BCE** (série MIR) remplace la constante `0.035` codée en
  dur ; `borrowing_capacity_eur` et `price_to_capacity_ratio` sont calculés à partir de ce taux.
- **Taxe foncière** (DGFiP) : nouvelle colonne `property_tax_rate_pct` pour le coût réel de détention.
- **Mixité** : `social_mix_score` intègre la **diversité CSP** (indice de Simpson,
  `csp_diversity_index`) et la présence de **QPV**.
- **Sécurité** : `quality_of_life_score` intègre la **délinquance SSMSI**.
- *Réserve honnête* : `transit_accessibility` (GTFS) reste `NULL` tant que la source n'est pas câblée.

### 2.2 Justification logique et scientifique du calcul des scores

Chaque composante repose sur une formule **explicite et documentée** (voir `docs/scores_explain_fr.md`
et `docs/indicateurs.md`) :

- **Capacité d'emprunt** = capital dont l'**annuité au taux réel BCE** (série MIR) est couverte par
  le revenu local (formule d'annuité d'un prêt amortissable), puis rapportée au prix/m² DVF.
- **Diversité CSP** = **indice de Simpson** \(1 - \sum p_i^2\) sur les parts de catégories
  socioprofessionnelles (RP-CSP INSEE) : 0 = commune homogène, →1 = forte mixité.
- **Sécurité** = **percentile inverse** du taux de délinquance SSMSI (une commune moins exposée que
  la moyenne obtient un meilleur score).

Les indicateurs sont ainsi **traçables et reproductibles** plutôt que fixés arbitrairement.

---

## 3. « Orienter la réflexion depuis l'usage front — quelles données afficher ? »

✅ Chaque **vue front** est adossée à une donnée précise et à la problématique :

| Vue / composant front | Donnée affichée | Source |
|-----------------------|-----------------|--------|
| **Carte choroplèthe** (`FranceMap`) | prix/m² par commune | DVF → `fact_transaction` |
| **Score d'opportunité** (`OpportunityScoreCards`) | m² accessibles / score | `app_opportunity_score` |
| **Indicateurs sociaux** (`SocialStatCards`) | revenu médian, pauvreté, interdécile | Filosofi |
| **Équipements** (`EquipmentStatCards`) | densité écoles/santé/commerces | BPE |
| **Tendances** (`PriceTrendChart`) | évolution des prix dans le temps | DVF |
| **Détail commune** (`CommuneDetailPanel`) | fiche synthèse | marts `app_*` |

On part bien de **« qu'est-ce qu'on veut montrer à l'utilisateur ? »**, puis on remonte vers la donnée.

---

## 4. « Chaque graphique utile — moins de graphiques, plus de pertinence »

✅ **Sélection volontairement resserrée**, chaque visuel sert l'idée principale (au mon budget, où acheter, est-ce équilibré ?) :

| Visuel retenu | Pourquoi il sert l'histoire |
|---------------|------------------------------|
| Carte choroplèthe prix/m² | la lecture spatiale du « où c'est cher / abordable » |
| Score d'opportunité (m² accessibles) | la **réponse directe** à la capacité d'emprunt |
| Cartes d'indicateurs sociaux | qualifie l'**équilibre** d'un territoire (mixité) |
| Courbe de tendance | replace le prix dans une dynamique (sur/sous-évaluation) |

**Écartés** (par discipline) : graphiques « parce qu'on peut » sans lien avec la décision d'achat
(camemberts décoratifs, multiplication d'histogrammes redondants). Règle d'équipe : *un visuel = une
question de l'utilisateur*.

---

## 5. « La scalabilité au cœur — s'orienter big data »

✅ **C'est l'axe structurant.** Le maillon big data est en place (`docs/hdfs_spark_fr.md`) :

- **HDFS** comme lac de fichiers : les sources atterrissent telles quelles, immuables et rejouables.
- **Spark (PySpark)** pour le nettoyage **distribué** : un job par source, écriture en **Parquet**
  (DVF **partitionné par département** pour des lectures sélectives).
- Conçu pour la **montée en charge** : le même code tourne en `local[*]` (1 machine) ou sur un
  cluster de N workers ; à pleine volumétrie (DVF ≈ plusieurs Go/an), le gros œuvre reste distribué
  et seul le résultat compact part vers Postgres.

Le choix big data n'est donc pas décoratif : il répond explicitement au critère de scalabilité.

---

## 6. « Choix des BDD libre tant qu'il est justifié »

✅ **Choix justifiés par l'usage** :

| Stockage | Pourquoi |
|----------|----------|
| **PostgreSQL + PostGIS** (principal) | Données **relationnelles** (jointures multi-sources sur le code INSEE) **et géospatiales** (polygones, prédicats spatiaux pour la carte). Un seul moteur couvre les deux → simplicité et cohérence. C'est la **source de vérité**. |
| **HDFS** (lac) | Stockage fichier brut, scalable, rejouable — *pas* une base requêtable, mais l'historique d'entrée du pipeline. |
| **OpenSearch** (prévu) | Recherche plein-texte / autocomplétion ville-adresse, **dérivé** des marts (projection lecture). |
| **NoSQL** (à l'étude, HOM-24) | Évalué pour des accès clé-valeur/documents ; à retenir seulement si un besoin le justifie. |

Principe retenu : **Postgres = vérité**, le reste = projections optimisées pour un usage précis.

---

## 7. « Rédiger un rapport de 3 à 5 pages sur la problématique pour commenter les graphiques »

📝 **Livrable à produire** — plan proposé (3–5 pages) :

1. **Problématique & histoire** (½ p.) — la question, pour qui, quelle décision on éclaire.
2. **Données & méthode** (1 p.) — sources INSEE/data.gouv, ramener tout à la commune (clé INSEE),
   capacité d'emprunt (formule d'annuité), indicateurs de mixité ; limites (secret statistique, millésimes).
3. **Lecture des graphiques** (1,5–2 p.) — pour **chaque** visuel : ce qu'il montre, comment le lire,
   ce qu'on en conclut, et son lien à la décision d'achat.
4. **Résultats & opportunités** (½–1 p.) — exemples de communes « bonnes opportunités » (prix bas vs
   capacité d'emprunt, bon équilibre social), cas contrastés.
5. **Scalabilité & suite** (½ p.) — architecture big data, automatisation visée, pistes (NLP avis, etc.).

> Je peux **rédiger ce rapport complet** à partir des résultats réels du pipeline (ex. classement
> des m² accessibles déjà calculé par `analyse_commune`). Dis-moi si tu veux que je le produise.

---

## 8. « Se renseigner sur : Polars, PySpark, dbt »

✅ Synthèse comparative et **positionnement dans notre stack** :

| Outil | C'est quoi | Force | Limite | Où chez nous |
|-------|-----------|-------|--------|--------------|
| **Polars** | Lib DataFrame en Rust (API *lazy*), mono-machine | Très **rapide**, mémoire efficace, remplace avantageusement pandas | **Non distribué** (une machine ; mode streaming pour > RAM) | Candidat pour le **transform-service** / ingestions légères (plus rapide que pandas) |
| **PySpark** | Spark en Python, calcul **distribué** | **Scalable** horizontalement (cluster), optimiseur Catalyst, lecture Parquet | Surcoût de démarrage ; overkill sur petits volumes | **Nettoyage du lac** (HDFS → Parquet curated) — notre maillon big data |
| **dbt** | Transformations **SQL** versionnées sur l'entrepôt | Tests, **docs**, lineage, modularité staging→core→marts | SQL only (pas de calcul lourd ni d'API externe) | **Modélisation Postgres** : `stg_* → normalized_* → dim_*/fact_*/app_*` |

**Notre arbitrage** : *PySpark* pour le gros nettoyage distribué (scalabilité), *dbt* pour la
modélisation SQL testée et documentée, *Polars* comme accélérateur côté Python mono-machine
(ingestion / service de transformation) là où Spark serait disproportionné. Les trois sont
**complémentaires**, pas concurrents : ils interviennent à des étages différents du pipeline.

### 8.1 Zoom sur Polars — à quoi ça sert et où l'utiliser chez nous

**À quoi ça sert.** Polars est une bibliothèque de **DataFrame écrite en Rust** :
- **Très rapide** : multi-thread natif, exécution *columnar*, et un **mode *lazy*** (`scan_*` → `collect`)
  qui optimise la requête avant de l'exécuter (pushdown des filtres/colonnes).
- **Mémoire efficace** (format Apache Arrow), avec un **mode *streaming*** capable de traiter des
  fichiers **plus gros que la RAM**.
- **Lit/écrit nativement** CSV, **Parquet**, JSON, et se connecte aux bases
  (`read_database` / `write_database`).
- **Mono-machine** : aucun cluster à gérer, démarrage **instantané** (≠ Spark qui doit lancer
  driver + executors).

En clair : la puissance « type pandas » mais **5–20× plus rapide** et plus sobre en mémoire, sans
l'overhead d'un cluster — l'outil idéal pour les volumes qui **tiennent sur une machine**
(jusqu'à quelques Go).

**Où l'utiliser concrètement dans HOMEPEDIA :**

| Point d'usage | Aujourd'hui | Avec Polars |
|---------------|-------------|-------------|
| **Loaders d'ingestion** (`data_platform/ingestion/*/load_raw_*.py`) | boucle `csv` + `executemany` ligne à ligne (lent) | `pl.read_csv()` / `scan_csv` *lazy* → typage & nettoyage **vectorisés** → `write_database()` ou COPY. Bien plus rapide sur un fichier national. |
| **Service de transformation** (`data_platform/transform-service/`, aujourd'hui vide) | — | Lit le **Parquet *curated*** produit par Spark (`pl.read_parquet`), applique les règles **mono-machine** (parsing fin, géocodage, normalisation par règles) puis charge `raw_*` Postgres. **C'est l'usage le plus naturel** : Spark fait le gros volume, Polars fait la logique « pas adaptée au SQL » à l'échelle d'une machine. |
| **Contrôles qualité / exploration** (`data_platform/notebooks/`) | — | Profilage rapide d'un dataset, vérifs avant/après nettoyage, prototypage d'une transfo avant de la porter en Spark ou dbt. |
| **Petits agrégats de dev / tests** | Spark (lourd à démarrer) | Polars pour itérer **en secondes** sur un échantillon, sans monter le cluster HDFS/Spark. |

**Règle de bascule Polars ↔ PySpark :**
- **Polars** tant que la donnée **tient sur une machine** (≲ quelques Go) et qu'on veut vitesse +
  simplicité : ingestion, **service de transformation**, dev/exploration.
- **PySpark** dès qu'il faut **distribuer** : volume national multi-Go, jointures à grande échelle,
  exécution sur cluster.
- **Pont naturel** : les deux parlent **Parquet / Arrow** → Spark écrit le *curated*, Polars le
  relit sans friction (et inversement).

> En résumé : Polars ne **remplace pas** Spark, il **complète** la chaîne côté mono-machine —
> typiquement pour **accélérer l'ingestion** et incarner le **service de transformation**
> `curated (Parquet) → raw_* (Postgres)`.

---

## 9. Ce qu'il reste pour atteindre « pipeline automatisé en production »

| Chantier | Ticket | État |
|----------|--------|------|
| **Orchestration** (Airflow : ingestion → HDFS → Spark → dbt) | HOM-22 | ✅ 5 DAGs domaine + `gold_refresh`, dont les nouveaux `homepedia_emprunt` et `homepedia_cadre_vie` |
| Agrégations Spark avancées, séries temporelles de prix | HOM-38, HOM-39 | en cours |
| Vues / tables matérialisées pour l'app | HOM-41 | en cours |
| Déploiement cloud | HOM-67 | ⚙️ config prête (`backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.prod.yml`, `docs/deploiement_fr.md`) ; **exécution** sur le cloud à faire par l'équipe (accès requis) |
| Tests d'intégration bout-en-bout + docs livrables | HOM-69, HOM-70/71/72 | en cours |
| (Bonus) Analyse de texte / NLP sur avis de villes | épopée HOM-8 | à faire |

### 9.1 Bonus demandés — désormais réalisés

Plusieurs bonus attendus sont maintenant en place côté front et déploiement :

- **Carrousel thématique** : navigation par thème sur la page d'accueil.
- **Tour guidé (onboarding)** : parcours de découverte pour un nouvel utilisateur.
- **Mises à jour en temps réel** : auto-refresh (30 s) des données affichées.
- **Configuration de déploiement en ligne** : `docker-compose.prod.yml` + `docs/deploiement_fr.md`
  (Dockerfiles backend et frontend) ; il ne reste que l'exécution sur un hébergeur cloud.

S'y ajoute le composant **`AffordabilityCard`** qui expose directement la capacité d'emprunt réelle
issue du mart enrichi.

---

## 10. Inventaire des datasets : présents vs à implémenter

### 10.1 Datasets **présents** dans le projet

Chacun a sa chaîne complète : loader d'ingestion → job Spark de nettoyage → modèle dbt.

| Dataset | Source | Contenu | Granularité | Brique | Statut |
|---------|--------|---------|-------------|--------|--------|
| **DVF** | Etalab / data.gouv | prix de vente, surface, type de bien | transaction → commune | A | ✅ `load_raw_dvf` · `clean_dvf` · `fact_transaction` |
| **COG INSEE** | INSEE | communes / départements / régions | commune | C | ✅ `load_raw_cog` · `clean_cog` · `dim_location` |
| **Filosofi** | INSEE | revenu médian, déciles, taux de pauvreté | commune + IRIS | A & B | ✅ `load_raw_filosofi` · `clean_filosofi` |
| **BPE** | INSEE | équipements (écoles, santé, commerces…) | commune (via IRIS) | D (proxy) | ✅ `load_raw_bpe` · `clean_bpe` |
| **Géométries** | IGN / france-geojson | polygones commune / département / région | par niveau | C | ✅ `prepare_geojson` (GeoJSON servis au front) |
| **Taux de crédit** | BCE (série MIR) | taux réel pour la capacité d'emprunt (remplace `0.035`) | national / mois | A | ✅ loader + dbt staging→core + DAG `homepedia_emprunt` |
| **Taxe foncière** | DGFiP | coût réel de détention (`property_tax_rate_pct`) | commune | A | ✅ loader + dbt + DAG `homepedia_cadre_vie` |
| **QPV** | ANCT | quartiers prioritaires (mixité) | commune | B | ✅ loader + dbt + DAG `homepedia_cadre_vie` |
| **RP-CSP** | INSEE | catégories socioprofessionnelles → diversité (Simpson) | commune | B | ✅ loader + dbt + DAG `homepedia_demo` (étendu) |
| **Délinquance** | SSMSI | sécurité (percentile inverse) | commune | D | ✅ loader + dbt + DAG `homepedia_cadre_vie` |
| **Codes postaux** | La Poste | correspondance code postal ↔ commune | commune | C | ✅ loader + dbt + DAG `homepedia_referentiels` (étendu) |

→ Ces datasets alimentent déjà le mart **`app_opportunity_score`** et la carte choroplèthe. Les
**6 nouvelles sources** ci-dessus sont câblées **bout-en-bout** (loader → dbt staging→core → Airflow).

### 10.2 Datasets **à implémenter** (pour compléter la problématique)

| Dataset | Source | Apport | Granularité | Brique | Statut |
|---------|--------|--------|-------------|--------|--------|
| **Recensement — diplôme** | INSEE | niveau de diplôme (le volet **CSP** est désormais intégré, cf. §10.1) | commune | B | ❌ (CSP fait) |
| **RPLS** | SDES | part de logements locatifs sociaux | commune | B | ❌ |
| **IPS** | Éducation nationale | mixité scolaire (indice de position sociale) | établissement → commune | B | ❌ |
| **Admin Express (géométrie PostGIS)** | IGN | polygones précis stockés en base pour requêtes spatiales | commune | C | ⚠️ partiel — GeoJSON simplifié en place, géométrie **PostGIS** en base pas encore |
| **CBS (bruit transport)** | CEREMA / data.gouv | indices Lden/Lnight (route, fer, air) | polygones / dép. | D | ❌ |
| **POI OpenStreetMap** | Geofabrik | densité bars/restos/écoles (animation vs calme) | spatial → commune | D | ❌ (BPE sert de proxy partiel) |
| **SIRENE** | INSEE | débits de boissons (NAF 56.30Z) | commune | D | ❌ |

> *Bruitparif* (bruit festif) reste **écarté** : mesuré uniquement à Paris, non exploitable pour un scoring national (voir `docs/guide_fr.md` §1.2 Brique D).

### 10.3 Enrichissements ultérieurs (hors problématique cœur)

Sources « envisagées » du `guide_fr.md` §1.1, à considérer plus tard si le temps le permet :
**DPE/ADEME** (énergie), **DARES / France Travail** (chômage), **Atmo** (qualité de l'air),
**CORINE Land Cover** (occupation des sols), **ARCEP** (couverture internet), **SNCF/GTFS**
(accessibilité gares), **annonces** (crawl, « marché actuel »).

---

## En résumé

Les recommandations de l'enseignant sont **adressées** : jeu de données d'abord, problématique
claire, front piloté par l'usage, visuels resserrés et utiles, scalabilité big data au cœur, choix
de BDD justifiés, et veille faite sur Polars/PySpark/dbt. Les **indicateurs** sont désormais
alimentés par de **vraies données** (taux réel BCE, taxe foncière, mixité QPV + diversité CSP,
sécurité SSMSI) avec des **formules justifiées** (`docs/scores_explain_fr.md`, `docs/indicateurs.md`),
l'**orchestration Airflow** est câblée (6 nouvelles sources bout-en-bout) et les **bonus** (carrousel,
tour guidé, temps réel) sont livrés. Le reste à faire est surtout la **mise en production** effective
sur le cloud (la configuration `docker-compose.prod.yml` est prête).
