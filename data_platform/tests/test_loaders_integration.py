from __future__ import annotations

import zipfile
from pathlib import Path

import pytest

from conftest import (
    FIXTURES,
    INGESTION_ROOT,
    run_loader,
    table_count,
)


@pytest.fixture
def loader_db(require_postgres: str):
    return require_postgres


class TestDvfIntegration:
    EXPECTED_ROWS = 312

    def test_load_fixture_truncates_and_inserts(self, loader_db: str, db_conn):
        result = run_loader(
            "dvf/load_raw_dvf.py",
            loader_db,
            extra_args=[
                "--file",
                str(FIXTURES / "dvf_sample.csv"),
                "--truncate",
            ],
        )
        assert result.returncode == 0, result.stderr
        assert f"Loaded {self.EXPECTED_ROWS} rows" in result.stdout
        assert table_count(db_conn, "raw_dvf_transaction") == self.EXPECTED_ROWS

    def test_load_is_idempotent_with_truncate(self, loader_db: str, db_conn):
        args = ["--file", str(FIXTURES / "dvf_sample.csv"), "--truncate"]
        assert run_loader("dvf/load_raw_dvf.py", loader_db, extra_args=args).returncode == 0
        assert run_loader("dvf/load_raw_dvf.py", loader_db, extra_args=args).returncode == 0
        assert table_count(db_conn, "raw_dvf_transaction") == self.EXPECTED_ROWS

    def test_max_rows_limits_inserted_rows(self, loader_db: str, db_conn):
        result = run_loader(
            "dvf/load_raw_dvf.py",
            loader_db,
            extra_args=[
                "--file",
                str(FIXTURES / "dvf_sample.csv"),
                "--truncate",
                "--max-rows",
                "1",
            ],
        )
        assert result.returncode == 0, result.stderr
        assert table_count(db_conn, "raw_dvf_transaction") == 1

    def test_row_content(self, loader_db: str, db_conn):
        run_loader(
            "dvf/load_raw_dvf.py",
            loader_db,
            extra_args=["--file", str(FIXTURES / "dvf_sample.csv"), "--truncate"],
        )
        row = db_conn.execute(
            "SELECT id_mutation, code_commune, nom_commune "
            "FROM raw_dvf_transaction WHERE id_mutation = %s",
            ("demo-1",),
        ).fetchone()
        assert row is not None
        assert row[1] == "01001"
        assert row[2] == "L'Abergement-Clémenciat"


class TestCogIntegration:
    def test_load_commune_fixture(self, loader_db: str, db_conn):
        result = run_loader(
            "insee/load_raw_cog.py",
            loader_db,
            extra_args=[
                "--file",
                str(FIXTURES / "cog_commune_sample.csv"),
                "--truncate",
            ],
        )
        assert result.returncode == 0, result.stderr
        assert "raw_insee_cog_commune" in result.stdout
        assert table_count(db_conn, "raw_insee_cog_commune") == 26

    def test_load_departement_fixture(self, loader_db: str, db_conn):
        result = run_loader(
            "insee/load_raw_cog.py",
            loader_db,
            extra_args=[
                "--file",
                str(FIXTURES / "cog_departement_sample.csv"),
                "--truncate",
            ],
        )
        assert result.returncode == 0, result.stderr
        assert "raw_insee_cog_departement" in result.stdout
        assert table_count(db_conn, "raw_insee_cog_departement") == 14

    def test_load_region_fixture(self, loader_db: str, db_conn):
        result = run_loader(
            "insee/load_raw_cog.py",
            loader_db,
            extra_args=[
                "--file",
                str(FIXTURES / "cog_region_sample.csv"),
                "--truncate",
            ],
        )
        assert result.returncode == 0, result.stderr
        assert "raw_insee_cog_region" in result.stdout
        assert table_count(db_conn, "raw_insee_cog_region") == 12

    def test_millesime_from_filename(self, loader_db: str, db_conn, tmp_path: Path):
        path = tmp_path / "v_commune_2024.csv"
        path.write_text(
            (FIXTURES / "cog_commune_sample.csv").read_text(encoding="utf-8"),
            encoding="utf-8",
        )
        run_loader(
            "insee/load_raw_cog.py",
            loader_db,
            extra_args=["--file", str(path), "--truncate", "--max-rows", "1"],
        )
        row = db_conn.execute(
            "SELECT millesime FROM raw_insee_cog_commune LIMIT 1"
        ).fetchone()
        assert row is not None
        assert row[0] == 2024


class TestBpeIntegration:
    EXPECTED_ROWS = 208

    def test_load_csv_fixture(self, loader_db: str, db_conn):
        result = run_loader(
            "bpe/load_raw_bpe.py",
            loader_db,
            extra_args=[
                "--file",
                str(FIXTURES / "bpe_sample.csv"),
                "--truncate",
            ],
        )
        assert result.returncode == 0, result.stderr
        assert table_count(db_conn, "raw_bpe_equipement") == self.EXPECTED_ROWS

    def test_typequ_filter(self, loader_db: str, db_conn):
        result = run_loader(
            "bpe/load_raw_bpe.py",
            loader_db,
            extra_args=[
                "--file",
                str(FIXTURES / "bpe_sample.csv"),
                "--truncate",
                "--typequ-filter",
                "C101,C102",
            ],
        )
        assert result.returncode == 0, result.stderr
        assert table_count(db_conn, "raw_bpe_equipement") == 52
        types = {
            r[0]
            for r in db_conn.execute(
                "SELECT DISTINCT typequ FROM raw_bpe_equipement"
            ).fetchall()
        }
        assert types == {"C101", "C102"}

    def test_load_from_zip(self, loader_db: str, db_conn, tmp_path: Path):
        zip_path = tmp_path / "bpe_2022_ensemble_xy_csv.zip"
        with zipfile.ZipFile(zip_path, "w") as zf:
            zf.writestr(
                "bpe22.csv",
                (FIXTURES / "bpe_sample.csv").read_text(encoding="utf-8"),
            )
        result = run_loader(
            "bpe/load_raw_bpe.py",
            loader_db,
            extra_args=["--file", str(zip_path), "--truncate"],
        )
        assert result.returncode == 0, result.stderr
        assert table_count(db_conn, "raw_bpe_equipement") == self.EXPECTED_ROWS
        row = db_conn.execute(
            "SELECT millesime FROM raw_bpe_equipement LIMIT 1"
        ).fetchone()
        assert row is not None
        assert row[0] == 2022


class TestFilosofiIntegration:
    COMMUNE_ROWS = 26
    IRIS_ROWS = 52

    @pytest.fixture(autouse=True)
    def _clean_filosofi_table(self, clean_filosofi):
        return clean_filosofi

    def test_load_commune_fixture(self, loader_db: str, db_conn):
        result = run_loader(
            "filosofi/load_raw_filosofi.py",
            loader_db,
            extra_args=[
                "--file",
                str(FIXTURES / "filosofi_sample.csv"),
                "--truncate",
            ],
        )
        assert result.returncode == 0, result.stderr
        assert "kind=commune" in result.stdout
        assert "millesime=2021" in result.stdout
        assert table_count(db_conn, "raw_filosofi") == self.COMMUNE_ROWS

    def test_truncate_scoped_by_millesime_and_kind(self, loader_db: str, db_conn):
        args = ["--file", str(FIXTURES / "filosofi_sample.csv"), "--truncate"]
        assert run_loader("filosofi/load_raw_filosofi.py", loader_db, extra_args=args).returncode == 0
        assert run_loader("filosofi/load_raw_filosofi.py", loader_db, extra_args=args).returncode == 0
        assert table_count(db_conn, "raw_filosofi") == self.COMMUNE_ROWS

    def test_load_iris_fixture(self, loader_db: str, db_conn):
        result = run_loader(
            "filosofi/load_raw_filosofi.py",
            loader_db,
            extra_args=[
                "--file",
                str(FIXTURES / "filosofi_iris_sample.csv"),
                "--truncate",
            ],
        )
        assert result.returncode == 0, result.stderr
        assert "kind=iris" in result.stdout
        assert table_count(db_conn, "raw_filosofi") == self.IRIS_ROWS
        row = db_conn.execute(
            "SELECT codgeo, kind FROM raw_filosofi WHERE kind = 'iris' LIMIT 1"
        ).fetchone()
        assert row is not None
        assert row[0] == "010010001"
        assert row[1] == "iris"

    def test_med_value_stored(self, loader_db: str, db_conn):
        run_loader(
            "filosofi/load_raw_filosofi.py",
            loader_db,
            extra_args=[
                "--file",
                str(FIXTURES / "filosofi_sample.csv"),
                "--truncate",
            ],
        )
        row = db_conn.execute(
            "SELECT med, tp60 FROM raw_filosofi WHERE codgeo = %s",
            ("75056",),
        ).fetchone()
        assert row is not None
        assert row[0] == "32200"
        assert row[1] == "10.0"

    def test_load_v2_fixture(self, loader_db: str, db_conn):
        result = run_loader(
            "filosofi/load_raw_filosofi.py",
            loader_db,
            extra_args=[
                "--file",
                str(FIXTURES / "filosofi_v2_sample.csv"),
                "--format",
                "v2",
                "--truncate",
            ],
        )
        assert result.returncode == 0, result.stderr
        assert "format=v2" in result.stdout
        assert "millesime=2023" in result.stdout
        assert table_count(db_conn, "raw_filosofi") == 2
        row = db_conn.execute(
            "SELECT med, tp60, millesime FROM raw_filosofi WHERE codgeo = %s",
            ("01001",),
        ).fetchone()
        assert row == ("18500", "11.5", 2023)

    def test_wide_and_v2_history_coexist(self, loader_db: str, db_conn):
        assert (
            run_loader(
                "filosofi/load_raw_filosofi.py",
                loader_db,
                extra_args=[
                    "--file",
                    str(FIXTURES / "filosofi_sample.csv"),
                    "--format",
                    "wide",
                    "--truncate",
                ],
            ).returncode
            == 0
        )
        assert (
            run_loader(
                "filosofi/load_raw_filosofi.py",
                loader_db,
                extra_args=[
                    "--file",
                    str(FIXTURES / "filosofi_v2_sample.csv"),
                    "--format",
                    "v2",
                    "--truncate",
                ],
            ).returncode
            == 0
        )
        assert table_count(db_conn, "raw_filosofi") == self.COMMUNE_ROWS + 2
        row = db_conn.execute(
            "SELECT millesime, med FROM raw_filosofi WHERE codgeo = %s ORDER BY millesime",
            ("01001",),
        ).fetchall()
        assert len(row) == 2
        assert row[0][0] == 2021
        assert row[1][0] == 2023
