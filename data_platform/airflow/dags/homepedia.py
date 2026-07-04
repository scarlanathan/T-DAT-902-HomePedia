"""Shared configuration and helpers for Homepedia ingestion DAGs (HOM-22).

The DAGs orchestrate the *existing* data_platform loaders (``scripts/load_*.sh``)
and the dbt gold refresh (``scripts/dbt.sh``). The ``data_platform`` repo is
mounted read-write at :data:`DATA_PLATFORM_ROOT` inside the Airflow workers, and
the loaders / dbt read their ``POSTGRES_*`` connection from the environment
(injected by ``docker-compose.yml``). This keeps a single source of truth: the
scheduler is a thin wrapper around the same scripts used for manual loads.

This module is intentionally *not* a DAG file — it only exposes constants and
helpers imported by ``dag_*.py``.
"""
from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.request
from datetime import timedelta

import pendulum
from airflow.operators.bash import BashOperator
from airflow.operators.python import PythonOperator

log = logging.getLogger(__name__)

# --- Paths (mounted inside the Airflow container, see docker-compose.yml) -----
DATA_PLATFORM_ROOT = os.environ.get(
    "DATA_PLATFORM_ROOT", "/opt/homepedia/data_platform"
)
SCRIPTS_DIR = f"{DATA_PLATFORM_ROOT}/scripts"

# Shared by all domain DAGs.
TZ = pendulum.timezone("Europe/Paris")
START_DATE = pendulum.datetime(2024, 1, 1, tz="Europe/Paris")

GOLD_REFRESH_DAG_ID = "homepedia_gold_refresh"

DEFAULT_ARGS = {
    "owner": "homepedia",
    "depends_on_past": False,
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
    "execution_timeout": timedelta(hours=3),
    "on_failure_callback": None,  # set below once the callback is defined
}


# --- Default public source URLs (mirror scripts/load_all_default.sh) ----------
# Every value is overridable via an environment variable so the same DAGs run
# against a trial subset (e.g. DVF_MAX_ROWS) or a new millésime without edits.
# NB: an empty env value falls back to the default (docker-compose passes unset
# overrides as ""), so `os.environ.get(k) or default`, not `get(k, default)`.
def _env(key: str, default: str) -> str:
    return os.environ.get(key, "").strip() or default


SOURCES = {
    "DVF_CSV_URL": _env(
        "DVF_CSV_URL",
        "https://files.data.gouv.fr/geo-dvf/latest/csv/2025/full.csv.gz",
    ),
    "COG_COMMUNE_URL": _env(
        "COG_COMMUNE_URL",
        "https://www.insee.fr/fr/statistiques/fichier/8740222/v_commune_2026.csv",
    ),
    "COG_DEPARTEMENT_URL": _env(
        "COG_DEPARTEMENT_URL",
        "https://www.insee.fr/fr/statistiques/fichier/8740222/v_departement_2026.csv",
    ),
    "COG_REGION_URL": _env(
        "COG_REGION_URL",
        "https://www.insee.fr/fr/statistiques/fichier/8740222/v_region_2026.csv",
    ),
    "BPE_URL": _env(
        "BPE_URL",
        "https://www.insee.fr/fr/statistiques/fichier/8217525/BPE24.zip",
    ),
    "BPE_MILLESIME": _env("BPE_MILLESIME", "2024"),
    "FILOSOFI_COMMUNE_URL": _env(
        "FILOSOFI_COMMUNE_URL",
        "https://www.insee.fr/fr/statistiques/fichier/8984752/FILOSOFI_CC_csv.zip",
    ),
    "FILOSOFI_IRIS_URL": _env(
        "FILOSOFI_IRIS_URL",
        "https://www.insee.fr/fr/statistiques/fichier/8229323/BASE_TD_FILO_IRIS_2021_DISP_CSV.zip",
    ),
    # Capacité d'emprunt: taux crédit immobilier (BCE MIR) + taxe foncière (DGFiP).
    "RATES_CSV_URL": _env(
        "RATES_CSV_URL",
        "https://data-api.ecb.europa.eu/service/data/MIR/M.FR.B.A2C.A.R.A.2250.EUR.N?format=csvdata&detail=dataonly",
    ),
    "TAXE_FONCIERE_URL": _env(
        "TAXE_FONCIERE_URL",
        "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/fiscalite-locale-des-particuliers/exports/csv?select=insee_com,com,libcom,dep,exercice,e12vote,taux_global_tfb&use_labels=false&delimiter=;",
    ),
    # Mixité sociale: QPV (ANCT) + RP catégories socioprofessionnelles (INSEE).
    "QPV_URL": _env(
        "QPV_URL",
        "https://static.data.gouv.fr/resources/quartiers-prioritaires-de-la-politique-de-la-ville-qpv/20260116-110350/listeqp2024-cog2024.csv",
    ),
    "RP_CSP_URL": _env(
        "RP_CSP_URL",
        "https://www.insee.fr/fr/statistiques/fichier/8268843/base-ic-activite-residents-2021_csv.zip",
    ),
    # Cadre de vie: délinquance communale (SSMSI).
    "DELINQUANCE_URL": _env(
        "DELINQUANCE_URL",
        "https://static.data.gouv.fr/resources/bases-statistiques-communale-departementale-et-regionale-de-la-delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales/20260326-124144/donnee-data.gouv-2025-geographie2025-produit-le2026-02-03.csv.gz",
    ),
    # Référentiel: codes postaux (La Poste / Etalab).
    "CODE_POSTAL_URL": _env(
        "CODE_POSTAL_URL",
        "https://datanova.laposte.fr/data-fair/api/v1/datasets/laposte-hexasmal/raw",
    ),
}

# Optional trial cap on DVF rows (the national file is ~5M rows / ~500 MB).
DVF_MAX_ROWS = os.environ.get("DVF_MAX_ROWS", "").strip()
# Optional BPE equipment-type filter (proximity equipments only).
BPE_TYPEQU_FILTER = os.environ.get("BPE_TYPEQU_FILTER", "").strip()


def _slack_notify(message: str) -> None:
    """Best-effort Slack notification (no-op if SLACK_WEBHOOK_URL is unset)."""
    webhook = os.environ.get("SLACK_WEBHOOK_URL", "").strip()
    if not webhook:
        return
    try:
        payload = json.dumps({"text": message}).encode("utf-8")
        req = urllib.request.Request(
            webhook, data=payload, headers={"Content-Type": "application/json"}
        )
        urllib.request.urlopen(req, timeout=10)  # noqa: S310 (trusted webhook)
    except Exception as exc:  # pragma: no cover - notification must never break a run
        log.warning("Slack notification failed: %s", exc)


def on_failure_callback(context) -> None:
    """Log the failure and forward it to Slack when configured."""
    ti = context.get("task_instance")
    dag_id = context.get("dag").dag_id if context.get("dag") else "?"
    task_id = ti.task_id if ti else "?"
    log_url = getattr(ti, "log_url", "") if ti else ""
    msg = f":red_circle: Homepedia ingestion failed — `{dag_id}.{task_id}`\n{log_url}"
    log.error(msg)
    _slack_notify(msg)


DEFAULT_ARGS["on_failure_callback"] = on_failure_callback


def check_source_available(url: str, **_) -> str:
    """Verify a source URL is reachable before pulling it (HOM-22 freshness gate).

    Mirrors the README "HttpSensor → HEAD 200" pattern using only the stdlib so
    no extra Airflow provider/connection is required. Some INSEE/data.gouv hosts
    reject HEAD (405) or bare GETs (403); those are treated as "available" since
    the loader itself will surface a real download error. Only genuine
    not-found / server / network failures abort the run.
    """
    try:
        req = urllib.request.Request(url, method="HEAD")
        with urllib.request.urlopen(req, timeout=30) as resp:  # noqa: S310
            status = resp.status
            log.info("HEAD %s -> %s", url, status)
            return f"available ({status})"
    except urllib.error.HTTPError as exc:
        if exc.code in (403, 405, 501):  # method/agent quirks, not a real outage
            log.warning("HEAD %s -> %s (tolerated, loader will fetch)", url, exc.code)
            return f"tolerated ({exc.code})"
        raise
    except urllib.error.URLError as exc:
        raise RuntimeError(f"source unreachable: {url} ({exc})") from exc


def check_task(task_id: str, url: str) -> PythonOperator:
    """Build the freshness/availability check task for a source URL."""
    return PythonOperator(
        task_id=task_id,
        python_callable=check_source_available,
        op_kwargs={"url": url},
    )


def load_task(task_id: str, script: str, args: list[str]) -> BashOperator:
    """Build a BashOperator that runs an existing ``scripts/load_*.sh`` loader.

    The script inherits the worker environment (``POSTGRES_*`` etc.), so the same
    code path as a manual ``./scripts/load_*.sh`` run is exercised.
    """
    quoted = " ".join(_shell_quote(a) for a in args)
    bash_command = f"bash {SCRIPTS_DIR}/{script} {quoted}".strip()
    return BashOperator(task_id=task_id, bash_command=bash_command)


def _shell_quote(value: str) -> str:
    """Minimal single-quote shell escaping for loader arguments."""
    return "'" + value.replace("'", "'\"'\"'") + "'"
