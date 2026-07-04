from __future__ import annotations

import os
import stat

import pytest

from conftest import FIXTURES, SCRIPTS, run_load_script, table_count


LOAD_SCRIPTS = [
    "load_dvf.sh",
    "load_cog.sh",
    "load_bpe.sh",
    "load_filosofi.sh",
]


class TestLoadScriptHelp:
    @pytest.mark.parametrize("script", LOAD_SCRIPTS)
    def test_help_exits_zero(self, script: str):
        result = run_load_script(script, "--help")
        assert result.returncode == 0
        assert "Usage:" in result.stdout


class TestLoadScriptExecutable:
    @pytest.mark.parametrize("script", LOAD_SCRIPTS)
    def test_script_is_executable(self, script: str):
        mode = os.stat(SCRIPTS / script).st_mode
        assert mode & stat.S_IXUSR


class TestLoadScriptFileSubcommand:
    def test_load_dvf_file(self, require_postgres: str, db_conn):
        result = run_load_script(
            "load_dvf.sh",
            "file",
            "tests/fixtures/dvf_sample.csv",
            "--truncate",
        )
        assert result.returncode == 0, result.stderr
        assert table_count(db_conn, "raw_dvf_transaction") == 312

    def test_load_cog_file(self, require_postgres: str, db_conn):
        result = run_load_script(
            "load_cog.sh",
            "file",
            "tests/fixtures/cog_commune_sample.csv",
            "--truncate",
        )
        assert result.returncode == 0, result.stderr
        assert table_count(db_conn, "raw_insee_cog_commune") == 26

    def test_load_bpe_file(self, require_postgres: str, db_conn):
        result = run_load_script(
            "load_bpe.sh",
            "file",
            "tests/fixtures/bpe_sample.csv",
            "--truncate",
        )
        assert result.returncode == 0, result.stderr
        assert table_count(db_conn, "raw_bpe_equipement") == 208

    def test_load_filosofi_file(self, require_postgres: str, db_conn, clean_filosofi):
        result = run_load_script(
            "load_filosofi.sh",
            "file",
            "tests/fixtures/filosofi_sample.csv",
            "--truncate",
        )
        assert result.returncode == 0, result.stderr
        assert table_count(db_conn, "raw_filosofi") == 26


class TestLoadScriptDefaultSample:
    @pytest.mark.parametrize(
        ("script", "table", "expected_rows"),
        [
            ("load_dvf.sh", "raw_dvf_transaction", 312),
            ("load_cog.sh", "raw_insee_cog_commune", 26),
            ("load_bpe.sh", "raw_bpe_equipement", 208),
            ("load_filosofi.sh", "raw_filosofi", 78),
        ],
    )
    def test_default_sample_load(
        self,
        require_postgres: str,
        db_conn,
        script: str,
        table: str,
        expected_rows: int,
        clean_filosofi,
    ):
        if script == "load_filosofi.sh":
            clean_filosofi
        result = run_load_script(script, "sample")
        assert result.returncode == 0, result.stderr
        assert table_count(db_conn, table) == expected_rows

    def test_sample_files_exist(self):
        expected = [
            "dvf_sample.csv",
            "cog_commune_sample.csv",
            "cog_departement_sample.csv",
            "cog_region_sample.csv",
            "bpe_sample.csv",
            "filosofi_sample.csv",
            "filosofi_iris_sample.csv",
            "filosofi_v2_sample.csv",
        ]
        for name in expected:
            assert (FIXTURES / name).is_file(), name


class TestLoadScriptErrors:
    def test_file_subcommand_requires_path(self):
        result = run_load_script("load_dvf.sh", "file")
        assert result.returncode == 1
        assert "error:" in result.stderr

    def test_cog_requires_subcommand(self):
        result = run_load_script("load_cog.sh")
        assert result.returncode == 1
        assert "requires a subcommand" in result.stderr

    def test_filosofi_requires_subcommand(self):
        result = run_load_script("load_filosofi.sh")
        assert result.returncode == 1
        assert "requires a subcommand" in result.stderr

    def test_dvf_requires_subcommand(self):
        result = run_load_script("load_dvf.sh")
        assert result.returncode == 1
        assert "requires a subcommand" in result.stderr

    def test_bpe_requires_subcommand(self):
        result = run_load_script("load_bpe.sh")
        assert result.returncode == 1
        assert "requires a subcommand" in result.stderr
