from __future__ import annotations

import importlib.util
import os
import subprocess
from pathlib import Path
from typing import Any

import psycopg
import pytest

DATA_PLATFORM_ROOT = Path(__file__).resolve().parents[1]
INGESTION_ROOT = DATA_PLATFORM_ROOT / "ingestion"
FIXTURES = DATA_PLATFORM_ROOT / "tests" / "fixtures"
SCRIPTS = DATA_PLATFORM_ROOT / "scripts"

DEFAULT_DEV_DATABASE_URL = "postgresql://homepedia:homepedia@localhost:5432/homepedia"
DEFAULT_TEST_DATABASE_URL = (
    "postgresql://homepedia:homepedia@localhost:5432/homepedia_test"
)


def import_loader(relative_path: str) -> Any:
    path = INGESTION_ROOT / relative_path
    module_name = path.stem
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot import loader from {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def postgres_available(database_url: str) -> bool:
    try:
        with psycopg.connect(database_url, connect_timeout=3) as conn:
            conn.execute("SELECT 1")
        return True
    except Exception:
        return False


def run_loader(
    loader_path: str,
    database_url: str,
    *,
    extra_args: list[str] | None = None,
) -> subprocess.CompletedProcess[str]:
    cmd = [
        "python3",
        str(INGESTION_ROOT / loader_path),
        "--database-url",
        database_url,
        *(extra_args or []),
    ]
    return subprocess.run(
        cmd,
        cwd=DATA_PLATFORM_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )


def run_load_script(
    script_name: str,
    *args: str,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    merged = os.environ.copy()
    merged["DATABASE_URL"] = merged.get(
        "TEST_DATABASE_URL",
        merged.get("DATABASE_URL", DEFAULT_TEST_DATABASE_URL),
    )
    merged["POSTGRES_DB"] = merged.get("POSTGRES_TEST_DB", "homepedia_test")
    if env:
        merged.update(env)
    return subprocess.run(
        [str(SCRIPTS / script_name), *args],
        cwd=DATA_PLATFORM_ROOT,
        capture_output=True,
        text=True,
        check=False,
        env=merged,
    )


def table_count(conn: psycopg.Connection, table: str) -> int:
    row = conn.execute(f"SELECT COUNT(*)::int FROM {table}").fetchone()
    return int(row[0]) if row else 0


@pytest.fixture(scope="session")
def data_platform_root() -> Path:
    return DATA_PLATFORM_ROOT


@pytest.fixture(scope="session")
def fixtures_dir() -> Path:
    return FIXTURES


@pytest.fixture(scope="session")
def database_url() -> str:
    return os.environ.get("TEST_DATABASE_URL", DEFAULT_TEST_DATABASE_URL)


@pytest.fixture(scope="session")
def require_postgres(database_url: str) -> str:
    if not postgres_available(database_url):
        pytest.skip(f"Postgres not reachable at {database_url}")
    return database_url


@pytest.fixture
def db_conn(require_postgres: str):
    with psycopg.connect(require_postgres) as conn:
        yield conn


@pytest.fixture
def clean_filosofi(db_conn):
    exists = db_conn.execute(
        "SELECT to_regclass('public.raw_filosofi') IS NOT NULL"
    ).fetchone()
    if exists and exists[0]:
        db_conn.execute("TRUNCATE TABLE raw_filosofi RESTART IDENTITY")
        db_conn.commit()


@pytest.fixture(scope="session")
def dvf_loader():
    return import_loader("dvf/load_raw_dvf.py")


@pytest.fixture(scope="session")
def cog_loader():
    return import_loader("insee/load_raw_cog.py")


@pytest.fixture(scope="session")
def bpe_loader():
    return import_loader("bpe/load_raw_bpe.py")


@pytest.fixture(scope="session")
def filosofi_loader():
    return import_loader("filosofi/load_raw_filosofi.py")
