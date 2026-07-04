from __future__ import annotations

import csv
import io
import zipfile
from pathlib import Path

import pytest

from conftest import FIXTURES


class TestDvfUnit:
    def test_row_tuple_maps_expected_fields(self, dvf_loader):
        row = {
            "id_mutation": "2020-1",
            "date_mutation": "2020-07-01",
            "numero_disposition": "000001",
            "nature_mutation": "Vente",
            "valeur_fonciere": "31234.16",
            "adresse_numero": "",
            "adresse_suffixe": "",
            "adresse_nom_voie": "SAINT JULIEN",
            "adresse_code_voie": "B064",
            "code_postal": "01560",
            "code_commune": "01367",
            "nom_commune": "Saint-Julien-sur-Reyssouze",
            "code_departement": "01",
            "ancien_code_commune": "",
            "ancien_nom_commune": "",
            "id_parcelle": "013670000A0008",
            "ancien_id_parcelle": "",
            "numero_volume": "",
            "lot1_numero": "",
            "lot1_surface_carrez": "",
            "lot2_numero": "",
            "lot2_surface_carrez": "",
            "lot3_numero": "",
            "lot3_surface_carrez": "",
            "lot4_numero": "",
            "lot4_surface_carrez": "",
            "lot5_numero": "",
            "lot5_surface_carrez": "",
            "nombre_lots": "0",
            "code_type_local": "",
            "type_local": "",
            "surface_reelle_bati": "",
            "nombre_pieces_principales": "",
            "code_nature_culture": "AB",
            "nature_culture": "terrains a bâtir",
            "code_nature_culture_speciale": "",
            "nature_culture_speciale": "",
            "surface_terrain": "1192",
            "longitude": "5.109255",
            "latitude": "46.403019",
        }
        tup = dvf_loader._row_tuple("/tmp/sample.csv", 1, row)
        assert tup[0] == "/tmp/sample.csv"
        assert tup[1] == 1
        assert tup[2] == "2020-1"
        assert tup[12] == "01367"
        assert tup[41] == "46.403019"

    def test_open_csv_stream_reads_fixture(self, dvf_loader):
        path = FIXTURES / "dvf_sample.csv"
        label, reader, handle = dvf_loader._open_csv_stream(path, None)
        try:
            rows = list(reader)
            assert label.endswith("dvf_sample.csv")
            assert len(rows) == 312
            assert rows[0]["code_commune"] == "01001"
        finally:
            handle.close()

    def test_open_csv_stream_rejects_both_sources(self, dvf_loader):
        with pytest.raises(ValueError, match="only one"):
            dvf_loader._open_csv_stream(Path("/tmp/a.csv"), "https://example.com/a.csv")


class TestCogUnit:
    def test_detect_kind_commune(self, cog_loader):
        fields = list(cog_loader.KIND_FIELDS["commune"])
        assert cog_loader.detect_kind(fields) == "commune"

    def test_detect_kind_departement(self, cog_loader):
        fields = list(cog_loader.KIND_FIELDS["departement"])
        assert cog_loader.detect_kind(fields) == "departement"

    def test_detect_kind_region(self, cog_loader):
        fields = list(cog_loader.KIND_FIELDS["region"])
        assert cog_loader.detect_kind(fields) == "region"

    def test_detect_kind_unknown_raises(self, cog_loader):
        with pytest.raises(ValueError, match="Unable to detect"):
            cog_loader.detect_kind(["FOO", "BAR"])

    def test_guess_millesime_from_filename(self, cog_loader):
        assert cog_loader.guess_millesime("/data/v_commune_2024.csv", None) == 2024
        assert cog_loader.guess_millesime("sample.csv", None) is None
        assert cog_loader.guess_millesime("sample.csv", 2023) == 2023

    def test_row_tuple_commune(self, cog_loader):
        row = {k: k.lower() for k in cog_loader.KIND_FIELDS["commune"]}
        row["COM"] = "75056"
        tup = cog_loader._row_tuple("commune", "/tmp/cog.csv", 2, 2024, row)
        assert tup[0] == "/tmp/cog.csv"
        assert tup[1] == 2
        assert tup[2] == 2024
        assert "75056" in tup


class TestBpeUnit:
    def test_guess_millesime_from_filename(self, bpe_loader):
        assert bpe_loader.guess_millesime("bpe_2022_ensemble_xy.csv", None) == 2022
        assert bpe_loader.guess_millesime("BPE24.zip", None) == 2024
        assert bpe_loader.guess_millesime("bpe_sample.csv", None) is None

    def test_row_tuple_maps_columns(self, bpe_loader):
        row = {
            "AN": "2022",
            "DCIRIS": "750560101",
            "DEP": "75",
            "REG": "11",
            "TYPEQU": "C101",
            "LAMBERT_X": "652381.2",
            "LAMBERT_Y": "6862145.8",
            "QUALITE_XY": "Bonne",
        }
        tup = bpe_loader._row_tuple("/tmp/bpe.csv", 1, 2022, row)
        assert tup[3] == "2022"
        assert tup[7] == "C101"
        assert tup[10] == "Bonne"

    def test_open_csv_stream_reads_semicolon_fixture(self, bpe_loader):
        path = FIXTURES / "bpe_sample.csv"
        label, reader, handle = bpe_loader._open_csv_stream(path, None, "utf-8", ";")
        try:
            rows = list(reader)
            assert len(rows) == 208
            assert rows[0]["TYPEQU"] == "C101"
        finally:
            handle.close()

    def test_open_local_zip_extracts_csv(self, bpe_loader, tmp_path: Path):
        csv_body = (
            "AN;DCIRIS;DEP;REG;TYPEQU;LAMBERT_X;LAMBERT_Y;QUALITE_XY\n"
            "2022;750560101;75;11;C101;1;2;Bonne\n"
        )
        zip_path = tmp_path / "bpe_sample.zip"
        with zipfile.ZipFile(zip_path, "w") as zf:
            zf.writestr("bpe22.csv", csv_body)

        reader, handle = bpe_loader._open_local(zip_path, "utf-8", ";")
        try:
            rows = list(reader)
            assert len(rows) == 1
            assert rows[0]["TYPEQU"] == "C101"
        finally:
            handle.close()


class TestFilosofiUnit:
    def test_detect_kind_commune(self, filosofi_loader):
        fields = ["CODGEO", "LIBGEO", "MED21", "TP6021"]
        assert filosofi_loader.detect_kind(fields) == "commune"

    def test_detect_kind_iris(self, filosofi_loader):
        fields = ["IRIS", "LIBGEO", "MED21", "TP6021"]
        assert filosofi_loader.detect_kind(fields) == "iris"

    def test_detect_year_suffix(self, filosofi_loader):
        fields = ["CODGEO", "LIBGEO", "MED21", "TP6021", "D921"]
        assert filosofi_loader.detect_year_suffix(fields) == "21"

    def test_guess_millesime_from_filename(self, filosofi_loader):
        assert filosofi_loader.guess_millesime("cc_filosofi_2021_COM.zip", None) == 2021
        assert filosofi_loader.guess_millesime("filosofi_sample.csv", None) is None

    def test_resolve_millesime_from_suffix_when_filename_has_no_year(self, filosofi_loader):
        suffix = filosofi_loader.detect_year_suffix(["CODGEO", "MED21"])
        millesime = filosofi_loader.guess_millesime("filosofi_sample.csv", None)
        if millesime is None:
            millesime = 2000 + int(suffix)
        assert millesime == 2021

    def test_row_tuple_normalizes_french_decimal_comma(self, filosofi_loader):
        row = {
            "IRIS": "751010101",
            "LIBGEO": "Paris - Zone 1",
            "MED21": "28500",
            "TP6021": "19,0",
            "RD21": "8,5",
        }
        tup = filosofi_loader._row_tuple(
            "iris", "/tmp/filo.csv", 1, 2021, "21", row
        )
        assert tup[6] == "19.0"
        assert tup[17] == "8.5"

    def test_row_tuple_strips_suffix_and_null_sentinels(self, filosofi_loader):
        row = {
            "CODGEO": "75056",
            "LIBGEO": "Paris",
            "MED21": "28500",
            "TP6021": "12.5",
            "D121": "s",
            "D221": "8500",
            "D321": "12000",
            "D421": "15500",
            "D521": "19500",
            "D621": "24000",
            "D721": "30000",
            "D821": "38000",
            "D921": "48000",
            "RD21": "8.5",
            "PACT21": "75.2",
            "PTSA21": "82.1",
            "PCHO21": "3.2",
            "PBEN21": "8.5",
            "PPEN21": "4.1",
            "PPAT21": "1.8",
            "PCAF21": "5.3",
            "PLOG21": "1.0",
        }
        tup = filosofi_loader._row_tuple(
            "commune", "/tmp/filo.csv", 1, 2021, "21", row
        )
        assert tup[4] == "75056"
        assert tup[6] == "12.5"   # tp60
        assert tup[7] == "28500"  # med
        assert tup[8] is None     # d1: D121 = "s" → null

    def test_row_tuple_treats_so_as_null(self, filosofi_loader):
        row = {
            "IRIS": "751010101",
            "LIBGEO": "Paris - Zone 1",
            "MED21": "28500",
            "RD21": "so",
        }
        tup = filosofi_loader._row_tuple(
            "iris", "/tmp/filo.csv", 1, 2021, "21", row
        )
        assert tup[17] is None  # rd

    def test_open_csv_stream_reads_fixture(self, filosofi_loader):
        path = FIXTURES / "filosofi_sample.csv"
        label, reader, handle = filosofi_loader._open_csv_stream(
            path, None, "utf-8", ";", None
        )
        try:
            rows = list(reader)
            assert len(rows) == 26
            assert rows[0]["CODGEO"] == "01001"
        finally:
            handle.close()

    def test_detect_format_wide_and_v2(self, filosofi_loader):
        assert filosofi_loader.detect_format(["CODGEO", "MED21"]) == "wide"
        assert filosofi_loader.detect_format(["IRIS", "MED21"]) == "wide"
        assert filosofi_loader.detect_format(
            ["FILOSOFI_MEASURE", "GEO", "GEO_OBJECT", "TIME_PERIOD", "OBS_VALUE"]
        ) == "v2"

    def test_v2_rows_to_tuples_pivots_measures(self, filosofi_loader):
        path = FIXTURES / "filosofi_v2_sample.csv"
        _, reader, handle = filosofi_loader._open_csv_stream(path, None, "utf-8", ";", "v2")
        try:
            tuples = filosofi_loader._v2_rows_to_tuples("filosofi_v2_sample.csv", reader, None)
        finally:
            handle.close()
        assert len(tuples) == 2
        by_geo = {t[4]: t for t in tuples}
        paris_adj = by_geo["01001"]
        assert paris_adj[2] == 2023
        assert paris_adj[3] == "commune"
        assert paris_adj[6] == "11.5"   # tp60
        assert paris_adj[7] == "18500"  # med
        assert paris_adj[8] == "9000"   # d1
        assert paris_adj[16] == "32000" # d9
        assert paris_adj[17] == "3.2"   # rd
        assert paris_adj[18] == "68.0"  # pact
