#!/usr/bin/env python3
"""
Load the ANCT QPV 2024 list into raw_qpv.

Default source: data.gouv.fr QPV dataset, CSV `listeqp2024-cog2024.csv`:
  https://static.data.gouv.fr/resources/quartiers-prioritaires-de-la-politique-de-la-ville-qpv/20260116-110350/listeqp2024-cog2024.csv

CSV is ';'-delimited, UTF-8 (BOM), with trailing empty columns that are ignored.
One row per quartier prioritaire; `insee_com` is the host commune, used downstream
to count QPV per commune (proxy for the social-mix / priority-neighbourhood share).

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

FIELDS = [
    "code_qp",
    "lib_qp",
    "insee_reg",
    "lib_reg",
    "insee_dep",
    "lib_dep",
    "insee_com",
    "lib_com",
    "siren_epci",
    "lib_epci",
]

INSERT_SQL = """
INSERT INTO raw_qpv (
    source_file, source_row_number,
    code_qp, lib_qp, insee_reg, lib_reg, insee_dep, lib_dep,
    insee_com, lib_com, siren_epci, lib_epci
) VALUES (
    %s, %s,
    %s, %s, %s, %s, %s, %s,
    %s, %s, %s, %s
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

    req = urllib.request.Request(url, headers={"User-Agent": "HomepediaQPVLoader/1.0"})
    resp = urllib.request.urlopen(req, timeout=120)
    body: BinaryIO = resp
    if url.endswith(".gz"):
        gz = gzip.GzipFile(fileobj=body)
        text = io.TextIOWrapper(gz, encoding=encoding, newline="")
    else:
        text = io.TextIOWrapper(body, encoding=encoding, newline="")
    return url, csv.DictReader(text, delimiter=delimiter), text


def _get(row: dict[str, str], name: str) -> str | None:
    for key in row:
        if (key or "").lstrip("﻿").strip().lower() == name:
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
                if "insee_com" not in present or "code_qp" not in present:
                    raise ValueError(
                        f"CSV missing QPV columns (code_qp, insee_com); got: {sorted(present)}"
                    )
                header_checked = True

            buffer.append(
                (source_label, row_num, *(_get(row, f) for f in FIELDS))
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
    parser = argparse.ArgumentParser(description="Load ANCT QPV list into raw_qpv")
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL"))
    parser.add_argument("--file", type=Path, help="Local CSV or CSV.gz path")
    parser.add_argument(
        "--url",
        default=os.environ.get("QPV_URL"),
        help="Remote CSV URL (or set QPV_URL)",
    )
    parser.add_argument("--encoding", default="utf-8-sig", help="CSV encoding (default: utf-8-sig)")
    parser.add_argument("--delimiter", default=";", help="CSV delimiter (default: ;)")
    parser.add_argument("--max-rows", type=int, default=None)
    parser.add_argument(
        "--truncate",
        action="store_true",
        help="DELETE all rows from raw_qpv before load",
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
        print("Provide --file or --url (or set QPV_URL)", file=sys.stderr)
        return 1

    text_io: TextIO | None = None
    try:
        label, reader, text_io = _open_csv_stream(
            args.file, args.url, args.encoding, args.delimiter
        )
        with psycopg.connect(args.database_url) as conn:
            ensure_schema(conn, args.schema_file)
            if args.truncate:
                conn.execute("TRUNCATE TABLE raw_qpv RESTART IDENTITY")
                conn.commit()
            inserted = load_rows(conn, label, reader, args.max_rows, args.batch_size)
        print(f"Loaded {inserted} rows into raw_qpv from {label}")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    finally:
        if text_io is not None:
            text_io.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
