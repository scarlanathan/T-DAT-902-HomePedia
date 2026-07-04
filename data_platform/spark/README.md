# Spark + HDFS - the Big Data cleaning layer

This is the **lake & compute** stage of the architecture in `docs/guide_fr.md` (§3):

```
ingestion → HDFS (immutable raw files) → Spark (clean at scale) → Postgres raw_* → dbt → API
                 ▲                          ▲
            this folder ─────────────────────
```

HDFS keeps the source files exactly as published (replayable history); Spark reads them
in parallel, cleans/normalises/aggregates, and writes typed **Parquet** back to the lake.
The transform-service then loads those curated outputs into Postgres - Spark does the
heavy, distributed work so SQL/dbt downstream stays simple.

## What runs here

| Job | Reads (`/lake/raw`) | Writes (`/lake/curated`) | Role in the problem (`guide_fr.md` §1.2) |
|-----|---------------------|--------------------------|------------------------------------------|
| `jobs/clean_dvf.py` | `dvf/` geo-DVF transactions | `dvf/` (partitioned by department) | Brique A - price/m² per sale |
| `jobs/clean_filosofi.py` | `filosofi/` INSEE income | `filosofi/` | Brique A income + Brique B social mix |
| `jobs/clean_cog.py` | `cog/` INSEE communes | `cog/` | Brique C - geographic spine (`dim_location`) |
| `jobs/clean_bpe.py` | `bpe/` INSEE facilities | `bpe/` | Brique D proxy - amenity density per commune |
| `jobs/analyse_commune.py` | the four curated outputs | `app_commune_overview/` | joins everything: *how many m² can a median local afford?* |

`run_all.py` runs them in order (cleaning first, the join last).

### How each job cleans (the "why")

- **DVF** - keeps only `Vente` of `Maison`/`Appartement` (the only rows with a real
  price/m²), casts the all-TEXT columns, computes `price_m2`, drops impossible prices
  (`<100` / `>30000` €/m² - symbolic €1 sales and data-entry errors), and de-duplicates
  the same sale repeated across parcelles.
- **FiLoSoFi** - semicolon CSV whose columns carry a year suffix (`MED21`…), detected at
  runtime; French decimal commas and statistical-secrecy tokens (`s`/`ns`/`nd`) become
  proper doubles/nulls; computes the D9/D1 interdecile ratio.
- **COG** - keeps real communes (`TYPECOM=COM`, dropping municipal arrondissements),
  zero-pads codes so joins are exact, exposes commune → department → region.
- **BPE** - derives the commune from `DCIRIS[:5]`, classifies `TYPEQU` into families
  (école/collège/lycée/santé/commerce/sport) and counts them per commune.

Shared cleaning helpers live in `utils/transforms.py`; the SparkSession factory and lake
path conventions in `utils/session.py` and `utils/lake.py`.

## The cluster (`docker-compose.yml`)

| Service | UI | Purpose |
|---------|----|---------|
| `namenode` | http://localhost:9870 | HDFS master (`hdfs://namenode:9000`) |
| `datanode` | http://localhost:9864 | HDFS block storage |
| `spark-master` | http://localhost:8080 | Spark standalone master (`spark://…:7077`) |
| `spark-worker` | http://localhost:8081 | Spark executor (2 cores / 2 GB) |

Config is in `hadoop.env` (replication 1, since dev has a single datanode). The Spark
containers mount this folder read-only at `/opt/homepedia`, so a job edit needs no rebuild.

## Run it (dev, with the sample fixtures)

```bash
cd data_platform
./scripts/hadoop_up.sh        # start cluster + create /lake dirs in HDFS
./scripts/hdfs_put_raw.sh     # land the 4 sample CSVs into /lake/raw
./scripts/spark_clean.sh      # spark-submit run_all.py → /lake/curated
```

Inspect results:

```bash
docker exec homepedia-namenode hdfs dfs -ls -R /lake/curated
./scripts/spark_clean.sh analyse_commune     # re-run just the join (prints a preview)
```

Tear down: `./scripts/hadoop_down.sh` (add `--wipe` to drop the HDFS volumes).

### Real (national) files

Same flow, pointing `hdfs_put_raw.sh` at a downloaded file instead of the fixture:

```bash
./scripts/hdfs_put_raw.sh dvf /path/to/dvf_2024.csv
./scripts/spark_clean.sh dvf
```

The job logic is identical - the only difference is that Spark now fans the work across
the worker(s). Add workers by scaling the service: `docker compose -f spark/docker-compose.yml up -d --scale spark-worker=3`.

## Local (no cluster) mode

For iterating on transform logic without Docker, point the lake at a local folder:

```bash
export SPARK_MASTER=local[*]
export LAKE_ROOT=file:///abs/path/to/lake     # put raw CSVs under lake/raw/<source>/
spark-submit spark/run_all.py
```

(Requires a local PySpark + a Java 8/11/17 runtime; the docker route avoids version pinning.)

## Where this sits vs. the existing loaders

The `ingestion/*/load_raw_*.py` scripts still load Postgres `raw_*` directly - fine for
small dev runs. This Spark layer is the **scalable** path the guide calls for: at national
volume (DVF ≈ several GB/year), cleaning happens distributed in Spark and the curated
Parquet is what gets loaded, instead of streaming a giant CSV row-by-row into Postgres.
