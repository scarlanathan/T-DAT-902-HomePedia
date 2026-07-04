#!/usr/bin/env python3
"""
Load geo-DVF CSV (gzip or plain) into raw_dvf_transaction.

Default public file (large ~500MB compressed): set DVF_CSV_URL or pass --url/--file.
For local development use tests/fixtures/dvf_sample.csv with --file.

Environment:
  DATABASE_URL  PostgreSQL connection URI (preferred), e.g. postgresql://user:pass@localhost:5432/homepedia
"""

from __future__ import annotations

import argparse
import csv
import gzip
import io
import os
import sys
import urllib.request
from pathlib import Path
from typing import BinaryIO, Iterable, Iterator, TextIO

import psycopg
from dotenv import load_dotenv

# Expected header (geo-DVF national export, 2025). Loader maps rows by column name.
EXPECTED_FIELDS = [
    "id_mutation",
    "date_mutation",
    "numero_disposition",
    "nature_mutation",
    "valeur_fonciere",
    "adresse_numero",
    "adresse_suffixe",
    "adresse_nom_voie",
    "adresse_code_voie",
    "code_postal",
    "code_commune",
    "nom_commune",
    "code_departement",
    "ancien_code_commune",
    "ancien_nom_commune",
    "id_parcelle",
    "ancien_id_parcelle",
    "numero_volume",
    "lot1_numero",
    "lot1_surface_carrez",
    "lot2_numero",
    "lot2_surface_carrez",
    "lot3_numero",
    "lot3_surface_carrez",
    "lot4_numero",
    "lot4_surface_carrez",
    "lot5_numero",
    "lot5_surface_carrez",
    "nombre_lots",
    "code_type_local",
    "type_local",
    "surface_reelle_bati",
    "nombre_pieces_principales",
    "code_nature_culture",
    "nature_culture",
    "code_nature_culture_speciale",
    "nature_culture_speciale",
    "surface_terrain",
    "longitude",
    "latitude",
]

INSERT_SQL = """
INSERT INTO raw_dvf_transaction (
    source_file, source_row_number,
    id_mutation, date_mutation, numero_disposition, nature_mutation, valeur_fonciere,
    adresse_numero, adresse_suffixe, adresse_nom_voie, adresse_code_voie,
    code_postal, code_commune, nom_commune, code_departement,
    ancien_code_commune, ancien_nom_commune,
    id_parcelle, ancien_id_parcelle, numero_volume,
    lot1_numero, lot1_surface_carrez, lot2_numero, lot2_surface_carrez,
    lot3_numero, lot3_surface_carrez, lot4_numero, lot4_surface_carrez,
    lot5_numero, lot5_surface_carrez,
    nombre_lots, code_type_local, type_local, surface_reelle_bati, nombre_pieces_principales,
    code_nature_culture, nature_culture, code_nature_culture_speciale, nature_culture_speciale,
    surface_terrain, longitude, latitude
) VALUES (
    %s, %s,
    %s, %s, %s, %s, %s,
    %s, %s, %s, %s,
    %s, %s, %s, %s,
    %s, %s,
    %s, %s, %s,
    %s, %s, %s, %s,
    %s, %s, %s, %s,
    %s, %s,
    %s, %s, %s, %s, %s,
    %s, %s, %s, %s,
    %s, %s, %s
)
"""


def _open_csv_stream(
    path: Path | None,
    url: str | None,
) -> tuple[str, Iterator[dict[str, str]], TextIO]:
    """Return (label, row iterator, text_io to close if needed)."""
    if path and url:
        raise ValueError("Pass only one of --file or --url")

    if path:
        p = path.expanduser().resolve()
        label = str(p)
        if p.suffix == ".gz":
            raw = gzip.open(p, "rt", encoding="utf-8", newline="")
            reader = csv.DictReader(raw)
            return label, reader, raw
        raw = p.open("r", encoding="utf-8", newline="")
        reader = csv.DictReader(raw)
        return label, reader, raw

    if not url:
        raise ValueError("Either --file or --url is required")

    req = urllib.request.Request(url, headers={"User-Agent": "HomepediaDVFLoader/1.0"})
    resp = urllib.request.urlopen(req, timeout=120)
    body: BinaryIO = resp
    if url.endswith(".gz") or url.endswith(".csv.gz"):
        gz = gzip.GzipFile(fileobj=body)
        text = io.TextIOWrapper(gz, encoding="utf-8", newline="")
        reader = csv.DictReader(text)
        return url, reader, text

    text = io.TextIOWrapper(body, encoding="utf-8", newline="")
    reader = csv.DictReader(text)
    return url, reader, text


def _row_tuple(source_file: str, row_num: int, row: dict[str, str]) -> tuple:
    def g(key: str) -> str | None:
        v = row.get(key)
        if v is None or v == "":
            return None
        return v

    return (
        source_file,
        row_num,
        *(g(k) for k in EXPECTED_FIELDS),
    )


def ensure_schema(conn: psycopg.Connection, schema_path: Path) -> None:
    sql = schema_path.read_text(encoding="utf-8")
    for stmt in (s.strip() for s in sql.split(";")):
        if stmt:
            conn.execute(stmt)
    conn.commit()


def load_rows(
    conn: psycopg.Connection,
    source_label: str,
    rows: Iterable[dict[str, str]],
    max_rows: int | None,
    batch_size: int,
) -> int:
    header_checked = False
    buffer: list[tuple] = []
    total = 0
    row_num = 0

    with conn.cursor() as cur:
        for row in rows:
            row_num += 1
            if not header_checked:
                missing = [f for f in EXPECTED_FIELDS if f not in row]
                if missing:
                    raise ValueError(
                        f"CSV missing expected columns: {missing}. "
                        "Use geo-DVF export from data.gouv (see README)."
                    )
                header_checked = True

            buffer.append(_row_tuple(source_label, row_num, row))
            if len(buffer) >= batch_size:
                cur.executemany(INSERT_SQL, buffer)
                total += len(buffer)
                buffer.clear()

            if max_rows is not None and row_num >= max_rows:
                break

        if buffer:
            cur.executemany(INSERT_SQL, buffer)
            total += len(buffer)

    conn.commit()
    return total


def main() -> int:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Load DVF CSV into raw_dvf_transaction")
    parser.add_argument(
        "--database-url",
        default=os.environ.get("DATABASE_URL"),
        help="PostgreSQL URI (or set DATABASE_URL)",
    )
    parser.add_argument(
        "--file",
        type=Path,
        help="Local CSV or CSV.gz path",
    )
    parser.add_argument(
        "--url",
        default=os.environ.get("DVF_CSV_URL"),
        help="Remote CSV or CSV.gz URL (or set DVF_CSV_URL)",
    )
    parser.add_argument(
        "--max-rows",
        type=int,
        default=None,
        help="Stop after N data rows (excluding header); for dev sampling",
    )
    parser.add_argument(
        "--truncate",
        action="store_true",
        help="DELETE all rows from raw_dvf_transaction before load",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=2000,
    )
    parser.add_argument(
        "--schema-file",
        type=Path,
        default=Path(__file__).resolve().parent / "schema.sql",
        help="Path to schema.sql (CREATE TABLE)",
    )
    args = parser.parse_args()

    if not args.database_url:
        print("Missing DATABASE_URL or --database-url", file=sys.stderr)
        return 1

    if not args.file and not args.url:
        print("Provide --file or --url (or set DVF_CSV_URL)", file=sys.stderr)
        return 1

    text_io: TextIO | None = None
    try:
        label, reader, text_io = _open_csv_stream(args.file, args.url)
        with psycopg.connect(args.database_url) as conn:
            ensure_schema(conn, args.schema_file)
            if args.truncate:
                conn.execute("TRUNCATE TABLE raw_dvf_transaction RESTART IDENTITY")
                conn.commit()
            inserted = load_rows(conn, label, reader, args.max_rows, args.batch_size)
        print(f"Loaded {inserted} rows into raw_dvf_transaction from {label}")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    finally:
        if text_io is not None:
            text_io.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
