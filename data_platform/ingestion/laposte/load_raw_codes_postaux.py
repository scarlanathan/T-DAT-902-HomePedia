#!/usr/bin/env python3
"""
Load La Poste "Base officielle des codes postaux" into raw_code_postal.

Default source (data.gouv / La Poste datanova):
  https://datanova.laposte.fr/data-fair/api/v1/datasets/laposte-hexasmal/raw

CSV is ';'-delimited, latin-1, with a header whose first column is prefixed by '#'
(#Code_commune_INSEE;Nom_de_la_commune;Code_postal;Libelle_d_acheminement;Ligne_5).
One row per (commune, postal code); feeds the dim_commune_postal lookup used for
search-by-postal-code.

Environment:
  DATABASE_URL  PostgreSQL connection URI (preferred)
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
from typing import BinaryIO, Iterable, TextIO

import psycopg
from dotenv import load_dotenv

# Normalised source header (lower-case, '#' stripped) -> raw column.
FIELD_MAP = {
    "code_commune_insee": "code_commune",
    "nom_de_la_commune": "nom_commune",
    "code_postal": "code_postal",
    "libelle_d_acheminement": "libelle_acheminement",
    "ligne_5": "ligne_5",
}

ORDERED_COLS = [
    "code_commune",
    "nom_commune",
    "code_postal",
    "libelle_acheminement",
    "ligne_5",
]

INSERT_SQL = """
INSERT INTO raw_code_postal (
    source_file, source_row_number,
    code_commune, nom_commune, code_postal, libelle_acheminement, ligne_5
) VALUES (
    %s, %s,
    %s, %s, %s, %s, %s
)
"""


def _norm(key: str) -> str:
    return (key or "").lstrip("﻿").lstrip("#").strip().lower()


def _open_csv_stream(
    path: Path | None,
    url: str | None,
    encoding: str,
    delimiter: str,
) -> tuple[str, csv.DictReader, TextIO]:
    if path and url:
        raise ValueError("Pass only one of --file or --url")

    if path:
        p = path.expanduser().resolve()
        label = str(p)
        if p.suffix == ".gz":
            raw = gzip.open(p, "rt", encoding=encoding, newline="")
        else:
            raw = p.open("r", encoding=encoding, newline="")
        return label, csv.DictReader(raw, delimiter=delimiter), raw

    if not url:
        raise ValueError("Either --file or --url is required")

    req = urllib.request.Request(url, headers={"User-Agent": "HomepediaCodePostalLoader/1.0"})
    resp = urllib.request.urlopen(req, timeout=180)
    body: BinaryIO = resp
    if url.endswith(".gz"):
        gz = gzip.GzipFile(fileobj=body)
        text = io.TextIOWrapper(gz, encoding=encoding, newline="")
    else:
        text = io.TextIOWrapper(body, encoding=encoding, newline="")
    return url, csv.DictReader(text, delimiter=delimiter), text


def _get(row: dict[str, str], src_name: str) -> str | None:
    for key in row:
        if _norm(key) == src_name:
            v = row.get(key)
            if v is None or v.strip() == "":
                return None
            return v.strip()
    return None


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
                present = {_norm(k) for k in row.keys()}
                missing = {"code_commune_insee", "code_postal"} - present
                if missing:
                    raise ValueError(
                        f"CSV missing expected columns: {sorted(missing)}. "
                        "Use the La Poste base officielle des codes postaux (see module doc)."
                    )
                header_checked = True

            values = {dst: _get(row, src) for src, dst in FIELD_MAP.items()}
            buffer.append(
                (source_label, row_num, *(values[c] for c in ORDERED_COLS))
            )
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
    parser = argparse.ArgumentParser(description="Load La Poste postal codes into raw_code_postal")
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL"))
    parser.add_argument("--file", type=Path, help="Local CSV or CSV.gz path")
    parser.add_argument(
        "--url",
        default=os.environ.get("CODE_POSTAL_URL"),
        help="Remote CSV URL (or set CODE_POSTAL_URL)",
    )
    parser.add_argument("--encoding", default="latin-1", help="CSV encoding (default: latin-1)")
    parser.add_argument("--delimiter", default=";", help="CSV delimiter (default: ;)")
    parser.add_argument("--max-rows", type=int, default=None)
    parser.add_argument(
        "--truncate",
        action="store_true",
        help="DELETE all rows from raw_code_postal before load",
    )
    parser.add_argument("--batch-size", type=int, default=2000)
    parser.add_argument(
        "--schema-file",
        type=Path,
        default=Path(__file__).resolve().parent / "schema.sql",
    )
    args = parser.parse_args()

    if not args.database_url:
        print("Missing DATABASE_URL or --database-url", file=sys.stderr)
        return 1
    if not args.file and not args.url:
        print("Provide --file or --url (or set CODE_POSTAL_URL)", file=sys.stderr)
        return 1

    text_io: TextIO | None = None
    try:
        label, reader, text_io = _open_csv_stream(
            args.file, args.url, args.encoding, args.delimiter
        )
        with psycopg.connect(args.database_url) as conn:
            ensure_schema(conn, args.schema_file)
            if args.truncate:
                conn.execute("TRUNCATE TABLE raw_code_postal RESTART IDENTITY")
                conn.commit()
            inserted = load_rows(conn, label, reader, args.max_rows, args.batch_size)
        print(f"Loaded {inserted} rows into raw_code_postal from {label}")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    finally:
        if text_io is not None:
            text_io.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
