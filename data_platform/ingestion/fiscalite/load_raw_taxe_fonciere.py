#!/usr/bin/env python3
"""
Load DGFiP taxe foncière rates into raw_taxe_fonciere.

Default source: data.economie.gouv.fr dataset `fiscalite-locale-des-particuliers`,
CSV export selecting the commune-level built-property tax rate columns:

  https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/fiscalite-locale-des-particuliers/exports/csv?select=insee_com,com,libcom,dep,exercice,e12vote,taux_global_tfb&use_labels=false&delimiter=;

CSV is ';'-delimited, UTF-8 (BOM). One row per commune × exercice (year). The loader
maps by column name so the export column order is not significant.

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

# Source column name -> raw_taxe_fonciere column.
FIELD_MAP = {
    "insee_com": "insee_com",
    "com": "com",
    "libcom": "libcom",
    "dep": "dep",
    "exercice": "exercice",
    "e12vote": "part_communale_tfpb",
    "taux_global_tfb": "taux_global_tfb",
}

INSERT_SQL = """
INSERT INTO raw_taxe_fonciere (
    source_file, source_row_number,
    insee_com, com, libcom, dep, exercice, part_communale_tfpb, taux_global_tfb
) VALUES (
    %s, %s,
    %s, %s, %s, %s, %s, %s, %s
)
"""


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

    req = urllib.request.Request(url, headers={"User-Agent": "HomepediaTaxeFonciereLoader/1.0"})
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
        if (key or "").lstrip("﻿").strip().lower() == src_name:
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
                present = {(k or "").lstrip("﻿").strip().lower() for k in row.keys()}
                if "insee_com" not in present:
                    raise ValueError(
                        f"CSV missing 'insee_com' column; got: {sorted(present)}. "
                        "Use the fiscalite-locale-des-particuliers export (see module doc)."
                    )
                header_checked = True

            buffer.append(
                (
                    source_label,
                    row_num,
                    _get(row, "insee_com"),
                    _get(row, "com"),
                    _get(row, "libcom"),
                    _get(row, "dep"),
                    _get(row, "exercice"),
                    _get(row, "e12vote"),
                    _get(row, "taux_global_tfb"),
                )
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
    parser = argparse.ArgumentParser(description="Load DGFiP taxe foncière into raw_taxe_fonciere")
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL"))
    parser.add_argument("--file", type=Path, help="Local CSV or CSV.gz path")
    parser.add_argument(
        "--url",
        default=os.environ.get("TAXE_FONCIERE_URL"),
        help="Remote CSV URL (or set TAXE_FONCIERE_URL)",
    )
    parser.add_argument("--encoding", default="utf-8-sig", help="CSV encoding (default: utf-8-sig)")
    parser.add_argument("--delimiter", default=";", help="CSV delimiter (default: ;)")
    parser.add_argument("--max-rows", type=int, default=None)
    parser.add_argument(
        "--truncate",
        action="store_true",
        help="DELETE all rows from raw_taxe_fonciere before load",
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
        print("Provide --file or --url (or set TAXE_FONCIERE_URL)", file=sys.stderr)
        return 1

    text_io: TextIO | None = None
    try:
        label, reader, text_io = _open_csv_stream(
            args.file, args.url, args.encoding, args.delimiter
        )
        with psycopg.connect(args.database_url) as conn:
            ensure_schema(conn, args.schema_file)
            if args.truncate:
                conn.execute("TRUNCATE TABLE raw_taxe_fonciere RESTART IDENTITY")
                conn.commit()
            inserted = load_rows(conn, label, reader, args.max_rows, args.batch_size)
        print(f"Loaded {inserted} rows into raw_taxe_fonciere from {label}")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    finally:
        if text_io is not None:
            text_io.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
