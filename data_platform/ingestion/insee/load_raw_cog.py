#!/usr/bin/env python3
"""
Load INSEE COG (Code Officiel Géographique) CSV into raw_insee_cog_* tables.

INSEE publishes three CSV files per millésime (commune / département / région):
  https://www.insee.fr/fr/statistiques/fichier/7766585/v_commune_<YYYY>.csv
  https://www.insee.fr/fr/statistiques/fichier/7766585/v_departement_<YYYY>.csv
  https://www.insee.fr/fr/statistiques/fichier/7766585/v_region_<YYYY>.csv

The loader auto-detects which file it received from the CSV header and routes
to the matching table. Pass --kind to force when the header is ambiguous.

Environment:
  DATABASE_URL  PostgreSQL connection URI (preferred)
"""

from __future__ import annotations

import argparse
import csv
import gzip
import io
import os
import re
import sys
import urllib.request
from pathlib import Path
from typing import BinaryIO, Iterable, Iterator, TextIO

import psycopg
from dotenv import load_dotenv


# Header columns per kind. Match against the CSV header (case-insensitive).
KIND_FIELDS: dict[str, list[str]] = {
    "commune": [
        "TYPECOM", "COM", "REG", "DEP", "CTCD", "ARR",
        "TNCC", "NCC", "NCCENR", "LIBELLE", "CAN", "COMPARENT",
    ],
    "departement": [
        "DEP", "REG", "CHEFLIEU", "TNCC", "NCC", "NCCENR", "LIBELLE",
    ],
    "region": [
        "REG", "CHEFLIEU", "TNCC", "NCC", "NCCENR", "LIBELLE",
    ],
}

KIND_TABLE: dict[str, str] = {
    "commune":     "raw_insee_cog_commune",
    "departement": "raw_insee_cog_departement",
    "region":      "raw_insee_cog_region",
}

INSERT_SQL: dict[str, str] = {
    "commune": """
INSERT INTO raw_insee_cog_commune (
    source_file, source_row_number, millesime,
    typecom, com, reg, dep, ctcd, arr,
    tncc, ncc, nccenr, libelle, can, comparent
) VALUES (
    %s, %s, %s,
    %s, %s, %s, %s, %s, %s,
    %s, %s, %s, %s, %s, %s
)
""",
    "departement": """
INSERT INTO raw_insee_cog_departement (
    source_file, source_row_number, millesime,
    dep, reg, cheflieu, tncc, ncc, nccenr, libelle
) VALUES (
    %s, %s, %s,
    %s, %s, %s, %s, %s, %s, %s
)
""",
    "region": """
INSERT INTO raw_insee_cog_region (
    source_file, source_row_number, millesime,
    reg, cheflieu, tncc, ncc, nccenr, libelle
) VALUES (
    %s, %s, %s,
    %s, %s, %s, %s, %s, %s
)
""",
}


def detect_kind(fieldnames: list[str]) -> str:
    upper = {f.upper() for f in fieldnames}
    # commune has TYPECOM + COM (most specific)
    if {"TYPECOM", "COM"}.issubset(upper):
        return "commune"
    # departement has DEP + REG + CHEFLIEU (no TYPECOM, no COM)
    if {"DEP", "CHEFLIEU"}.issubset(upper) and "TYPECOM" not in upper:
        return "departement"
    # region has REG + CHEFLIEU but no DEP
    if {"REG", "CHEFLIEU"}.issubset(upper) and "DEP" not in upper:
        return "region"
    raise ValueError(
        f"Unable to detect COG file kind from header: {fieldnames}. "
        "Use --kind {commune,departement,region}."
    )


_MILLESIME_RE = re.compile(r"(\d{4})")


def guess_millesime(label: str, override: int | None) -> int | None:
    if override is not None:
        return override
    # Look at the basename only - avoid matching unrelated digits in a URL path
    name = os.path.basename(label)
    m = _MILLESIME_RE.search(name)
    if m:
        year = int(m.group(1))
        if 1990 <= year <= 2100:
            return year
    return None


def _open_csv_stream(
    path: Path | None,
    url: str | None,
    encoding: str,
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
        reader = csv.DictReader(raw)
        return label, reader, raw

    if not url:
        raise ValueError("Either --file or --url is required")

    req = urllib.request.Request(url, headers={"User-Agent": "HomepediaCOGLoader/1.0"})
    resp = urllib.request.urlopen(req, timeout=120)
    body: BinaryIO = resp
    if url.endswith(".gz"):
        gz = gzip.GzipFile(fileobj=body)
        text = io.TextIOWrapper(gz, encoding=encoding, newline="")
    else:
        text = io.TextIOWrapper(body, encoding=encoding, newline="")
    reader = csv.DictReader(text)
    return url, reader, text


def _row_tuple(
    kind: str,
    source_file: str,
    row_num: int,
    millesime: int | None,
    row: dict[str, str],
) -> tuple:
    def g(key: str) -> str | None:
        # CSV header may be upper-case; try exact then upper
        v = row.get(key)
        if v is None:
            v = row.get(key.upper())
        if v is None or v == "":
            return None
        return v

    return (
        source_file,
        row_num,
        millesime,
        *(g(k) for k in KIND_FIELDS[kind]),
    )


def ensure_schema(conn: psycopg.Connection, schema_path: Path) -> None:
    sql = schema_path.read_text(encoding="utf-8")
    for stmt in (s.strip() for s in sql.split(";")):
        if stmt:
            conn.execute(stmt)
    conn.commit()


def load_rows(
    conn: psycopg.Connection,
    kind: str,
    source_label: str,
    millesime: int | None,
    rows: Iterable[dict[str, str]],
    max_rows: int | None,
    batch_size: int,
) -> int:
    insert_sql = INSERT_SQL[kind]
    expected = {f.upper() for f in KIND_FIELDS[kind]}
    header_checked = False
    buffer: list[tuple] = []
    total = 0
    row_num = 0

    with conn.cursor() as cur:
        for row in rows:
            row_num += 1
            if not header_checked:
                present = {(k or "").upper() for k in row.keys()}
                missing = expected - present
                if missing:
                    raise ValueError(
                        f"CSV missing expected columns for kind={kind}: {sorted(missing)}"
                    )
                header_checked = True

            buffer.append(_row_tuple(kind, source_label, row_num, millesime, row))
            if len(buffer) >= batch_size:
                cur.executemany(insert_sql, buffer)
                total += len(buffer)
                buffer.clear()

            if max_rows is not None and row_num >= max_rows:
                break

        if buffer:
            cur.executemany(insert_sql, buffer)
            total += len(buffer)

    conn.commit()
    return total


def main() -> int:
    load_dotenv()
    parser = argparse.ArgumentParser(
        description="Load INSEE COG CSV into raw_insee_cog_* tables"
    )
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
        default=os.environ.get("COG_CSV_URL"),
        help="Remote CSV or CSV.gz URL (or set COG_CSV_URL)",
    )
    parser.add_argument(
        "--kind",
        choices=sorted(KIND_FIELDS.keys()),
        default=None,
        help="Force COG file kind (auto-detected from header otherwise)",
    )
    parser.add_argument(
        "--millesime",
        type=int,
        default=None,
        help="Year of the COG release (auto-detected from filename otherwise)",
    )
    parser.add_argument(
        "--encoding",
        default="utf-8",
        help="CSV encoding (INSEE COG is UTF-8 since 2019; older years may need cp1252)",
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
        help="DELETE all rows from the target table before load",
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
        print("Provide --file or --url (or set COG_CSV_URL)", file=sys.stderr)
        return 1

    text_io: TextIO | None = None
    try:
        label, reader, text_io = _open_csv_stream(args.file, args.url, args.encoding)
        fieldnames = reader.fieldnames or []
        kind = args.kind or detect_kind(fieldnames)
        millesime = guess_millesime(label, args.millesime)
        table = KIND_TABLE[kind]

        with psycopg.connect(args.database_url) as conn:
            ensure_schema(conn, args.schema_file)
            if args.truncate:
                conn.execute(f"TRUNCATE TABLE {table} RESTART IDENTITY")
                conn.commit()
            inserted = load_rows(
                conn, kind, label, millesime, reader, args.max_rows, args.batch_size
            )
        millesime_str = millesime if millesime is not None else "unknown"
        print(
            f"Loaded {inserted} rows into {table} from {label} "
            f"(kind={kind}, millesime={millesime_str})"
        )
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    finally:
        if text_io is not None:
            text_io.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
