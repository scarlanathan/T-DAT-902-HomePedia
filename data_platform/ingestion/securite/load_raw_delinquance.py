#!/usr/bin/env python3
"""
Load SSMSI communal recorded-crime statistics into raw_delinquance.

Default source: data.gouv.fr communal delinquency base (compressed CSV):
  https://static.data.gouv.fr/resources/bases-statistiques-communale-departementale-et-regionale-de-la-delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales/20260326-124144/donnee-data.gouv-2025-geographie2025-produit-le2026-02-03.csv.gz

The CSV is ';'-delimited, quoted, with French decimals and 'NA' for suppressed
values. Grain = commune × year × indicator. Only the geography, year, indicator,
count and rate columns are landed; casting/normalisation happens in dbt staging.

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

# Accept both the current (CODGEO_2025) and historical (CODGEO) geography column.
GEO_ALIASES = ("CODGEO_2025", "CODGEO", "CODGEO_2024", "CODGEO_2023")

INSERT_SQL = """
INSERT INTO raw_delinquance (
    source_file, source_row_number,
    codgeo, annee, indicateur, unite_de_compte, nombre, taux_pour_mille, est_diffuse
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

    req = urllib.request.Request(url, headers={"User-Agent": "HomepediaDelinquanceLoader/1.0"})
    resp = urllib.request.urlopen(req, timeout=300)
    body: BinaryIO = resp
    if url.endswith(".gz"):
        gz = gzip.GzipFile(fileobj=body)
        text = io.TextIOWrapper(gz, encoding=encoding, newline="")
    else:
        text = io.TextIOWrapper(body, encoding=encoding, newline="")
    return url, csv.DictReader(text, delimiter=delimiter), text


def _get(row: dict[str, str], *names: str) -> str | None:
    lookup = {(k or "").strip().upper(): k for k in row}
    for name in names:
        key = lookup.get(name.upper())
        if key is not None:
            v = row.get(key)
            if v is None:
                return None
            v = v.strip()
            # Keep 'NA' as NULL at the raw layer? No — keep raw text; dbt handles it.
            return v if v != "" else None
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
                present = {(k or "").strip().upper() for k in row.keys()}
                if not any(a in present for a in (n.upper() for n in GEO_ALIASES)):
                    raise ValueError(
                        f"CSV missing a CODGEO column ({GEO_ALIASES}); got: {sorted(present)}"
                    )
                if "INDICATEUR" not in present:
                    raise ValueError(f"CSV missing 'indicateur'; got: {sorted(present)}")
                header_checked = True

            buffer.append(
                (
                    source_label,
                    row_num,
                    _get(row, *GEO_ALIASES),
                    _get(row, "annee"),
                    _get(row, "indicateur"),
                    _get(row, "unite_de_compte"),
                    _get(row, "nombre"),
                    _get(row, "taux_pour_mille"),
                    _get(row, "est_diffuse"),
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
    parser = argparse.ArgumentParser(description="Load SSMSI delinquency into raw_delinquance")
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL"))
    parser.add_argument("--file", type=Path, help="Local CSV or CSV.gz path")
    parser.add_argument(
        "--url",
        default=os.environ.get("DELINQUANCE_URL"),
        help="Remote CSV/CSV.gz URL (or set DELINQUANCE_URL)",
    )
    parser.add_argument("--encoding", default="utf-8", help="CSV encoding (default: utf-8)")
    parser.add_argument("--delimiter", default=";", help="CSV delimiter (default: ;)")
    parser.add_argument("--max-rows", type=int, default=None)
    parser.add_argument(
        "--truncate",
        action="store_true",
        help="DELETE all rows from raw_delinquance before load",
    )
    parser.add_argument("--batch-size", type=int, default=5000)
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
        print("Provide --file or --url (or set DELINQUANCE_URL)", file=sys.stderr)
        return 1

    text_io: TextIO | None = None
    try:
        label, reader, text_io = _open_csv_stream(
            args.file, args.url, args.encoding, args.delimiter
        )
        with psycopg.connect(args.database_url) as conn:
            ensure_schema(conn, args.schema_file)
            if args.truncate:
                conn.execute("TRUNCATE TABLE raw_delinquance RESTART IDENTITY")
                conn.commit()
            inserted = load_rows(conn, label, reader, args.max_rows, args.batch_size)
        print(f"Loaded {inserted} rows into raw_delinquance from {label}")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    finally:
        if text_io is not None:
            text_io.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
