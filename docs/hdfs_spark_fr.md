# HDFS & Spark — comment ça marche, à quoi ça sert, et le code associé

Document de référence pour le maillon **Big Data** de HOMEPEDIA : le lac de fichiers
**HDFS** et le moteur de traitement distribué **Spark (PySpark)**. Il explique les concepts,
leur rôle dans le projet, puis détaille **tout le code** (`data_platform/spark/` + scripts).

> Vue complémentaire côté entrepôt : `docs/data_flow.md`. Vue architecture globale : `docs/guide_fr.md` §3.
> README opérationnel court : `data_platform/spark/README.md`.

---

## 1. Où se situe ce maillon

```
sources → ingestion → HDFS /lake/raw  → Spark → HDFS /lake/curated → Postgres raw_* → dbt → API → front
          (Python)    (fichiers          (nettoyage  (Parquet typé)
                       immuables)         à l'échelle)
        └──────────────────────── CE DOCUMENT ────────────────────────┘
```

- **HDFS** = le **lac** : il stocke les fichiers sources tels quels (immuables, rejouables).
- **Spark** = le **moteur** : il lit ces fichiers en parallèle, les nettoie/normalise/agrège,
  et réécrit du **Parquet** propre dans le lac.

Pourquoi ce maillon existe : à pleine volumétrie (DVF ≈ plusieurs Go/an), on ne peut pas charger
un CSV ligne par ligne dans Postgres. On fait le gros œuvre **distribué** dans Spark, et seul le
résultat compact et propre part vers Postgres.

---

## 2. HDFS — le système de fichiers distribué

### 2.1 À quoi ça sert
**HDFS (Hadoop Distributed File System)** stocke de **très gros fichiers** en les répartissant sur
plusieurs machines, avec tolérance aux pannes. Ce n'est **pas** une base de données : on n'y fait
pas de requêtes, on y **dépose et on lit des fichiers**. Ici il joue le rôle de **lac brut** :
historique fidèle des données sources, rejouable et auditable.

### 2.2 Concepts clés

| Concept | Rôle |
|---------|------|
| **NameNode** | Le « chef » : il connaît l'arborescence (`/lake/raw/...`) et **où** sont les blocs de chaque fichier. Point d'entrée (`hdfs://namenode:9000`). |
| **DataNode** | Les « ouvriers » : ils stockent réellement les **blocs** de données sur disque. |
| **Bloc** | Un fichier est découpé en blocs (128 Mo par défaut) répartis sur les DataNodes. |
| **Réplication** | Chaque bloc est copié N fois (3 en prod) pour survivre à une panne disque. Ici **N=1** (un seul DataNode en dev — voir `hadoop.env`). |
| **Safe mode** | Au démarrage, le NameNode est en lecture seule le temps de recenser les blocs ; nos scripts attendent qu'il en sorte. |

### 2.3 Comment on l'utilise ici

Deux zones sous une racine unique (`LAKE_ROOT = hdfs://namenode:9000/lake`) :

```
/lake/raw/<source>/      ← fichiers sources tels que publiés (dvf, cog, filosofi, bpe)
/lake/curated/<dataset>/ ← Parquet nettoyé écrit par Spark
```

Exemples de commandes HDFS (s'exécutent dans le conteneur namenode) :
```bash
hdfs dfs -mkdir -p /lake/raw/dvf          # créer un dossier
hdfs dfs -put fichier.csv /lake/raw/dvf/  # déposer un fichier
hdfs dfs -ls -R /lake/curated             # lister récursivement
hdfs dfs -cat /lake/raw/dvf/dvf_sample.csv | head
```

---

## 3. Spark — le moteur de traitement distribué

### 3.1 À quoi ça sert
**Apache Spark** exécute des traitements de données **en parallèle** sur plusieurs machines (ou
plusieurs cœurs). On écrit le code une fois (en Python via **PySpark**) ; Spark le découpe en
tâches et les distribue. Idéal pour nettoyer/agréger des volumes que Python seul ne tiendrait pas.

### 3.2 Architecture d'exécution

| Composant | Rôle |
|-----------|------|
| **Driver** | Le programme principal (notre `run_all.py`) : construit le plan, déclenche les calculs, collecte les résultats. |
| **Master** (standalone) | Le répartiteur du cluster (`spark://spark-master:7077`) : il connaît les workers disponibles. |
| **Worker** | Une machine du cluster qui héberge des executors. |
| **Executor** | Le processus qui exécute réellement les **tâches** sur une portion des données (une *partition*). |
| **Partition** | Un morceau du jeu de données traité par une tâche. Le parallélisme = nombre de partitions traitées simultanément. |

### 3.3 DataFrame, évaluation paresseuse, transformations vs actions

On manipule des **DataFrame** (tables distribuées avec un schéma). Deux types d'opérations :

- **Transformations** (`select`, `where`, `withColumn`, `groupBy`, `join`…) : **paresseuses** —
  elles ne calculent rien, elles construisent un **plan**.
- **Actions** (`write`, `count`, `show`, `collect`) : déclenchent **réellement** l'exécution de
  tout le plan accumulé.

Conséquence : dans nos jobs, tout le `select/where/withColumn` ne s'exécute qu'au moment du
`.write.parquet(...)`. Spark optimise le plan complet (moteur **Catalyst**) avant de lancer.

### 3.4 Pourquoi Spark plutôt que du Python pur
- **Volume** : il *spille* sur disque et distribue, là où pandas charge tout en RAM.
- **Parallélisme** : N partitions traitées en même temps par les executors.
- **Optimisation** : Catalyst réordonne filtres/projections ; lecture **Parquet** colonne par colonne.
- **Portabilité** : le même code tourne en `local[*]` (1 machine) ou sur un cluster de N workers.

---

## 4. Le cluster en docker

Fichier : **`data_platform/spark/docker-compose.yml`** + config **`hadoop.env`**.

| Service | Image | UI | Rôle |
|---------|-------|----|------|
| `namenode` | bde2020/hadoop-namenode | http://localhost:9870 | Maître HDFS (`hdfs://namenode:9000`) |
| `datanode` | bde2020/hadoop-datanode | http://localhost:9864 | Stockage des blocs |
| `spark-master` | bde2020/spark-master | http://localhost:8080 | Répartiteur Spark (`:7077`) |
| `spark-worker` | bde2020/spark-worker | http://localhost:8081 | Executor (2 cœurs / 2 Go) |

Le dossier `data_platform/spark/` est **monté en lecture seule** dans les conteneurs Spark à
`/opt/homepedia`, donc modifier un job ne nécessite **aucun rebuild**.

`hadoop.env` (extrait) — chaque variable devient une propriété de config Hadoop :
```ini
CORE_CONF_fs_defaultFS=hdfs://namenode:9000   # adresse du NameNode
HDFS_CONF_dfs_replication=1                    # 1 seule copie (un seul datanode en dev)
HDFS_CONF_dfs_permissions_enabled=false        # pas de gestion de droits en dev
```

---

## 5. Le code des jobs (`data_platform/spark/`)

### 5.1 Arborescence
```
spark/
├── docker-compose.yml   # le cluster HDFS + Spark
├── hadoop.env           # config Hadoop/HDFS
├── run_all.py           # orchestre tous les jobs
├── utils/
│   ├── session.py       # fabrique de SparkSession (portable cluster/local)
│   ├── lake.py          # conventions de chemins du lac (raw/curated)
│   └── transforms.py    # helpers de nettoyage (décimales FR, codes INSEE…)
└── jobs/
    ├── clean_dvf.py        # transactions DVF → prix/m²
    ├── clean_filosofi.py   # revenus/déciles INSEE
    ├── clean_cog.py        # référentiel communes (dim_location)
    ├── clean_bpe.py        # équipements → densité par commune
    └── analyse_commune.py  # jointure finale (capacité d'emprunt vs prix)
```

### 5.2 `utils/session.py` — la SparkSession
Point d'entrée de tout job Spark. Rendu **portable** par variables d'environnement :
- `SPARK_MASTER` : `spark://spark-master:7077` (cluster) ou `local[*]` (dev sans cluster).
- `SPARK_SHUFFLE_PARTITIONS` : parallélisme des `groupBy`/`join` (8 par défaut — nos volumes
  communaux ne justifient pas les 200 partitions par défaut de Spark).
```python
def build_session(app_name):
    builder = SparkSession.builder.appName(app_name)
    master = os.environ.get("SPARK_MASTER")
    if master:
        builder = builder.master(master)
    builder = builder.config("spark.sql.shuffle.partitions",
                             os.environ.get("SPARK_SHUFFLE_PARTITIONS", "8"))
    builder = builder.config("spark.sql.parquet.compression.codec", "snappy")
    return builder.getOrCreate()
```

### 5.3 `utils/lake.py` — les chemins du lac
Centralise la racine et les deux zones, pilotables par `LAKE_ROOT` (HDFS ou `file://` en local) :
```python
LAKE_ROOT = os.environ.get("LAKE_ROOT", "hdfs://namenode:9000/lake")
def raw_path(source, *parts):  -> "<LAKE_ROOT>/raw/<source>/..."
def curated_path(dataset):     -> "<LAKE_ROOT>/curated/<dataset>"
```

### 5.4 `utils/transforms.py` — le nettoyage mutualisé
L'open data français a des pièges récurrents : **virgules décimales** (`8,2`), **espaces
milliers**, et **tokens de secret statistique** (`s`, `ns`, `nd`) qui veulent dire « pas de valeur ».
Ces helpers centralisent le traitement :
- `blank_to_null(col)` : vide / token → `NULL` réel.
- `to_double(col, comma_decimal=False)` : parse un nombre (gère `1 234,56` → `1234.56`).
- `to_int(col)` : entier tolérant (`.0` final, tokens).
- `clean_insee_code(col, width=5)` : trim + zéro-padding (les communes de l'Ain perdent leur `0` initial).

> Important : ces helpers utilisent uniquement `pyspark.sql.functions` (pas d'UDF Python), donc
> tout s'exécute dans le moteur natif (Catalyst) — rapide et distribuable sans surcoût.

### 5.5 `jobs/clean_dvf.py` — le job le plus représentatif
Entrée : CSV DVF (une ligne par ligne de vente notariée). Sortie : Parquet partitionné par
département. Le cœur (`clean()`) enchaîne des **transformations** :
```python
typed = (df.select(
            F.to_date("date_mutation").alias("date_mutation"),
            to_double(F.col("valeur_fonciere")).alias("valeur_fonciere"),
            clean_insee_code(F.col("code_commune")).alias("code_commune"),
            F.col("type_local"),
            to_double(F.col("surface_reelle_bati")).alias("surface_reelle_bati"),
            ...)
         .where(F.col("nature_mutation") == "Vente")          # uniquement des ventes
         .where(F.col("type_local").isin("Maison","Appartement"))  # du bâti (prix/m² a un sens)
         .where(F.col("valeur_fonciere") > 0)
         .where(F.col("surface_reelle_bati") > 0))

priced = typed.withColumn("price_m2",
            F.round(F.col("valeur_fonciere") / F.col("surface_reelle_bati"), 2)
         ).where(F.col("price_m2").between(100, 30000))        # retrait des aberrations

deduped = priced.dropDuplicates(                               # une mutation éclatée sur
    ["id_mutation","code_commune","type_local",                # plusieurs parcelles = 1 vente
     "valeur_fonciere","surface_reelle_bati"])
```
Puis l'**action** finale écrit le résultat (et déclenche tout le calcul) :
```python
cleaned.write.mode("overwrite").partitionBy("code_departement").parquet(out)
```
Le **partitionnement par département** crée des sous-dossiers `code_departement=01/`, `=75/`… ce qui
permet aux lectures en aval de ne lire qu'un département sans scanner tout le jeu.

### 5.6 Les 3 autres jobs de nettoyage (résumé)

| Job | Ce qu'il fait |
|-----|----------------|
| `clean_filosofi.py` | CSV `;`. **Détecte le suffixe d'année au runtime** (`MED21` → millésime 2021) pour marcher sur n'importe quel millésime. Extrait revenu médian, taux de pauvreté, déciles D1/D9, calcule le ratio interdécile D9/D1. Gère virgules décimales + secret statistique. |
| `clean_cog.py` | Garde les **vraies communes** (`TYPECOM = COM`, exclut les arrondissements municipaux). Normalise les codes. Devient le socle `dim_location` (commune → département → région). |
| `clean_bpe.py` | Déduit la commune de `DCIRIS[:5]`. Classe chaque `TYPEQU` en **famille** (école/collège/lycée/santé/commerce/sport) puis **agrège** : un `groupBy().pivot().count()` donne une ligne par commune avec un compteur par famille (proxy de densité d'équipements). |

### 5.7 `jobs/analyse_commune.py` — la jointure finale (la problématique)
Lit les 4 Parquet curated et répond à la **Brique A** : *combien de m² un ménage médian peut-il
s'offrir ?* Modèle d'emprunt transparent (formule d'annuité, taux/durée paramétrables par env) :
```python
monthly_payment = (revenu_annuel / 12) * DEBT_RATIO          # 35 % d'effort max (HCSF)
capital         = monthly_payment * (1 - (1+r)^-n) / r       # r = taux mensuel, n = nb mensualités
affordable_m2   = capital / median_price_m2
```
La jointure prend **COG comme colonne vertébrale** (toutes les communes apparaissent), puis greffe
le prix médian (DVF), les revenus (Filosofi) et la densité d'équipements (BPE) :
```python
overview = (cog.join(price,    "code_commune", "left")
               .join(filosofi, "code_commune", "left")
               .join(bpe,      "code_commune", "left"))
```
Sortie : `/lake/curated/app_commune_overview` (une ligne par commune, prête pour Postgres `app_*`).

### 5.8 `run_all.py` — l'orchestrateur
Enchaîne les jobs dans l'ordre de dépendance (nettoyages d'abord, analyse en dernier car elle joint
les sorties). Chaque étape gère sa propre SparkSession, donc une panne est facile à localiser.
```python
STEPS = [("cog", clean_cog), ("dvf", clean_dvf), ("filosofi", clean_filosofi),
         ("bpe", clean_bpe), ("analyse_commune", analyse_commune)]
# `spark-submit run_all.py`            → tout
# `spark-submit run_all.py dvf`        → une seule étape
```

---

## 6. Les scripts d'exécution (`data_platform/scripts/`)

| Script | Ce qu'il fait |
|--------|----------------|
| `hadoop_up.sh` | `docker compose up -d` le cluster, attend la sortie du safe mode, crée l'arbo `/lake` dans HDFS. |
| `hdfs_put_raw.sh` | Dépose les fichiers sources dans `/lake/raw/<source>/`. Stream via **stdin** (`hdfs -put -`) pour éviter les soucis de chemin Windows. Sans argument : dépose les 4 fixtures. |
| `spark_clean.sh` | `docker exec` un `spark-submit run_all.py` dans le conteneur master, avec `LAKE_ROOT=hdfs://namenode:9000/lake`. Accepte un sous-ensemble d'étapes. |
| `hadoop_down.sh` | Arrête le cluster (`--wipe` pour effacer aussi les volumes HDFS). |

> Détail Windows : les scripts exportent `MSYS_NO_PATHCONV=1` pour empêcher Git Bash de réécrire
> les chemins conteneur `/lake` en `C:\...`.

---

## 7. Exécuter le pipeline pas à pas

```bash
cd data_platform
./scripts/hadoop_up.sh        # 1. démarre le cluster + crée /lake dans HDFS
./scripts/hdfs_put_raw.sh     # 2. dépose les 4 CSV échantillons dans /lake/raw
./scripts/spark_clean.sh      # 3. spark-submit run_all.py → /lake/curated
```

Ce qui se passe à l'étape 3 (sortie réelle validée sur les fixtures) :
```
===== [cog] =====              wrote 15 communes  -> /lake/curated/cog
===== [dvf] =====              wrote 312 rows      -> /lake/curated/dvf (partitionné par département)
===== [filosofi] =====         wrote 26 communes  -> /lake/curated/filosofi
===== [bpe] =====              wrote 26 communes  -> /lake/curated/bpe
===== [analyse_commune] =====  wrote 15 communes  -> /lake/curated/app_commune_overview
```
Aperçu de la jointure finale (m² accessibles à un ménage médian) :
```
+------------+--------------------------+---------------+----------+-------------+
|code_commune|nom_commune               |median_price_m2|med_income|affordable_m2|
+------------+--------------------------+---------------+----------+-------------+
|01367       |Saint-Julien-sur-Reyssouze|1115.76        |10640.0   |58.7         |
|01001       |L'Abergement-Clémenciat   |1442.03        |11300.0   |48.2         |
|76540       |Rouen                     |2759.49        |14160.0   |31.6         |
|13055       |Marseille                 |4065.86        |16360.0   |24.7         |
+------------+--------------------------+---------------+----------+-------------+
```

---

## 8. Inspecter / vérifier

- **HDFS** : http://localhost:9870 (onglet *Utilities → Browse the file system*), ou
  `docker exec homepedia-namenode hdfs dfs -ls -R /lake/curated`.
- **Spark** : http://localhost:8080 (master, jobs en cours), http://localhost:8081 (worker).
- Une sortie Parquet réussie contient un fichier `_SUCCESS` + des `part-*.snappy.parquet`. Le DVF
  montre des sous-dossiers `code_departement=01/`, `=75/`… (le partitionnement).

---

## 9. Mode local (sans cluster)

Pour itérer sur la logique sans Docker, on pointe le lac sur un dossier local :
```bash
export SPARK_MASTER=local[*]
export LAKE_ROOT=file:///chemin/vers/lake   # mettre les CSV sous lake/raw/<source>/
spark-submit spark/run_all.py
```
Le **même code** tourne : seul le `LAKE_ROOT` et le master changent (d'où l'intérêt de `session.py`
et `lake.py`). Nécessite PySpark + un Java 8/11/17 local ; le chemin docker évite ce calage de versions.

---

## 10. Récapitulatif — quel fichier fait quoi

| Fichier | Rôle |
|---------|------|
| `spark/docker-compose.yml` | Définit le cluster HDFS + Spark (4 services). |
| `spark/hadoop.env` | Config Hadoop/HDFS (adresse NameNode, réplication=1…). |
| `spark/utils/session.py` | Crée la SparkSession (portable cluster/local). |
| `spark/utils/lake.py` | Conventions de chemins `/lake/raw` et `/lake/curated`. |
| `spark/utils/transforms.py` | Helpers de nettoyage (décimales FR, codes INSEE, nulls). |
| `spark/jobs/clean_*.py` | Un job de nettoyage par source (raw CSV → Parquet curated). |
| `spark/jobs/analyse_commune.py` | Jointure des 4 sorties → score d'opportunité par commune. |
| `spark/run_all.py` | Orchestre les jobs dans l'ordre. |
| `scripts/hadoop_up.sh` / `hadoop_down.sh` | Démarre / arrête le cluster. |
| `scripts/hdfs_put_raw.sh` | Dépose les fichiers sources dans HDFS. |
| `scripts/spark_clean.sh` | Soumet le pipeline au cluster. |

---

## 11. Glossaire express

- **HDFS** : système de fichiers distribué (stockage), pas un moteur de requêtes.
- **NameNode / DataNode** : maître (métadonnées) / ouvriers (blocs).
- **Spark** : moteur de calcul distribué ; on écrit en **PySpark**.
- **Driver / Executor** : programme principal / processus qui exécute les tâches.
- **DataFrame** : table distribuée avec schéma.
- **Transformation / Action** : plan paresseux / déclenchement du calcul.
- **Partition** : morceau d'un DataFrame traité par une tâche (unité de parallélisme).
- **Parquet** : format colonne compressé, format de sortie de la zone *curated*.
- **Catalyst** : l'optimiseur de plans de Spark SQL.
