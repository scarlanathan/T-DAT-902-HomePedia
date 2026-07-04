#!/usr/bin/env python3
"""
Load INSEE BPE (Base Permanente des Équipements) CSV into raw_bpe_equipement.

BPE is distributed as a ZIP archive containing a semicolon-delimited CSV.
One row per équipement. Key column: TYPEQU (equipment type code, e.g. C101
for école maternelle). DCIRIS encodes the IRIS code (9 chars) or commune
code (5 chars) - the first 5 chars always give the commune.

Useful TYPEQU families:
  C1xx  Enseignement (C101 maternelle, C102 primaire, C201 collège, C301 lycée)
  D1xx  Médecins (D101 omnipraticien, D106 pédiatre)
  A5xx  Commerce alimentaire (A504 supermarché, A505 hypermarché)
  F1xx  Sport (F101 salle multisports)

Full nomenclature: https://www.insee.fr/fr/statistiques/3568614

Environment:
  DATABASE_URL  PostgreSQL connection URI
"""

from __future__ import annotations

import argparse
import csv
import gzip
import io
import os
import re
import sys
import zipfile
import urllib.request
from pathlib import Path
from typing import Iterable

import psycopg
from dotenv import load_dotenv

EXPECTED_FIELDS = ["AN", "DCIRIS", "DEP", "REG", "TYPEQU", "LAMBERT_X", "LAMBERT_Y", "QUALITE_XY"]

INSERT_SQL = """
INSERT INTO raw_bpe_equipement (
    source_file, source_row_number, millesime,
    an, dciris, dep, reg, typequ, lambert_x, lambert_y, qualite_xy
) VALUES (
    %s, %s, %s,
    %s, %s, %s, %s, %s, %s, %s, %s
)
"""

_MILLESIME_RE = re.compile(r"(\d{4})")
_BPE_SHORT_YEAR_RE = re.compile(r"bpe(\d{2})", re.IGNORECASE)


def guess_millesime(label: str, override: int | None) -> int | None:
    if override is not None:
        return override
    name = os.path.basename(label)
    m = _MILLESIME_RE.search(name)
    if m:
        year = int(m.group(1))
        if 1990 <= year <= 2100:
            return year
    short = _BPE_SHORT_YEAR_RE.search(name)
    if short:
        return 2000 + int(short.group(1))
    return None


def _open_csv_stream(
    path: Path | None,
    url: str | None,
    encoding: str,
    delimiter: str,
) -> tuple[str, csv.DictReader, object]:
    if path and url:
        raise ValueError("Pass only one of --file or --url")

    if path:
        p = path.expanduser().resolve()
        label = str(p)
        reader, handle = _open_local(p, encoding, delimiter)
        return label, reader, handle

    if not url:
        raise ValueError("Either --file or --url is required")

    req = urllib.request.Request(url, headers={"User-Agent": "HomepediaBPELoader/1.0"})
    resp = urllib.request.urlopen(req, timeout=180)
    reader, handle = _open_remote(resp, url, encoding, delimiter)
    return url, reader, handle


def _open_local(p: Path, encoding: str, delimiter: str):
    if p.suffix == ".zip":
        zf = zipfile.ZipFile(p)
        csv_name = next((n for n in zf.namelist() if n.endswith(".csv")), None)
        if not csv_name:
            raise ValueError(f"No CSV file found inside ZIP: {p}")
        inner = zf.open(csv_name)
        text = io.TextIOWrapper(inner, encoding=encoding, newline="")
        return csv.DictReader(text, delimiter=delimiter), zf
    if p.suffix == ".gz":
        raw = gzip.open(p, "rt", encoding=encoding, newline="")
        return csv.DictReader(raw, delimiter=delimiter), raw
    raw = p.open("r", encoding=encoding, newline="")
    return csv.DictReader(raw, delimiter=delimiter), raw


def _open_remote(resp, url: str, encoding: str, delimiter: str):
    body: io.RawIOBase = resp
    if url.endswith(".zip"):
        data = io.BytesIO(body.read())
        zf = zipfile.ZipFile(data)
        csv_name = next((n for n in zf.namelist() if n.endswith(".csv")), None)
        if not csv_name:
            raise ValueError(f"No CSV file found inside ZIP from URL: {url}")
        inner = zf.open(csv_name)
        text = io.TextIOWrapper(inner, encoding=encoding, newline="")
        return csv.DictReader(text, delimiter=delimiter), zf
    if url.endswith(".gz"):
        gz = gzip.GzipFile(fileobj=body)
        text = io.TextIOWrapper(gz, encoding=encoding, newline="")
        return csv.DictReader(text, delimiter=delimiter), text
    text = io.TextIOWrapper(body, encoding=encoding, newline="")
    return csv.DictReader(text, delimiter=delimiter), text


def _row_tuple(
    source_file: str,
    row_num: int,
    millesime: int | None,
    row: dict[str, str],
) -> tuple:
    def g(key: str) -> str | None:
        v = row.get(key) or row.get(key.upper())
        if v is None or v.strip() == "":
            return None
        return v.strip()

    return (
        source_file, row_num, millesime,
        g("AN"), g("DCIRIS"), g("DEP"), g("REG"),
        g("TYPEQU"), g("LAMBERT_X"), g("LAMBERT_Y"), g("QUALITE_XY"),
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
    millesime: int | None,
    rows: Iterable[dict[str, str]],
    max_rows: int | None,
    batch_size: int,
    typequ_filter: list[str] | None,
) -> int:
    header_checked = False
    buffer: list[tuple] = []
    total = 0
    row_num = 0

    with conn.cursor() as cur:
        for row in rows:
            row_num += 1
            if not header_checked:
                present = {(k or "").upper() for k in row.keys()}
                missing = [f for f in EXPECTED_FIELDS if f not in present]
                if missing:
                    raise ValueError(
                        f"CSV missing expected columns: {missing}. "
                        "Use the BPE 'ensemble' file from INSEE (see README)."
                    )
                header_checked = True

            typequ = (row.get("TYPEQU") or row.get("typequ") or "").strip()
            if typequ_filter and typequ not in typequ_filter:
                continue

            buffer.append(_row_tuple(source_label, row_num, millesime, row))
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
    parser = argparse.ArgumentParser(description="Load INSEE BPE CSV into raw_bpe_equipement")
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL"))
    parser.add_argument("--file", type=Path, help="Local CSV, CSV.gz or ZIP path")
    parser.add_argument("--url", default=os.environ.get("BPE_URL"),
                        help="Remote ZIP/CSV URL (or set BPE_URL)")
    parser.add_argument("--millesime", type=int, default=None,
                        help="Year of the release (auto-detected from filename if omitted)")
    parser.add_argument("--encoding", default="utf-8",
                        help="CSV encoding (default: utf-8)")
    parser.add_argument("--delimiter", default=";",
                        help="CSV delimiter (default: ;)")
    parser.add_argument("--typequ-filter", default=None,
                        help="Comma-separated list of TYPEQU codes to keep (e.g. C101,C102,D101). "
                             "Loads all equipment types if omitted.")
    parser.add_argument("--max-rows", type=int, default=None,
                        help="Stop after N source rows (before TYPEQU filter); for dev sampling")
    parser.add_argument("--truncate", action="store_true",
                        help="DELETE all rows from raw_bpe_equipement before load")
    parser.add_argument("--batch-size", type=int, default=2000)
    parser.add_argument("--schema-file", type=Path,
                        default=Path(__file__).resolve().parent / "schema.sql")
    args = parser.parse_args()

    if not args.database_url:
        print("Missing DATABASE_URL or --database-url", file=sys.stderr)
        return 1
    if not args.file and not args.url:
        print("Provide --file or --url (or set BPE_URL)", file=sys.stderr)
        return 1

    typequ_filter = (
        [t.strip() for t in args.typequ_filter.split(",") if t.strip()]
        if args.typequ_filter
        else None
    )

    handle = None
    try:
        label, reader, handle = _open_csv_stream(
            args.file, args.url, args.encoding, args.delimiter
        )
        millesime = guess_millesime(label, args.millesime)

        with psycopg.connect(args.database_url) as conn:
            ensure_schema(conn, args.schema_file)
            if args.truncate:
                conn.execute("TRUNCATE TABLE raw_bpe_equipement RESTART IDENTITY")
                conn.commit()
            inserted = load_rows(
                conn, label, millesime, reader,
                args.max_rows, args.batch_size, typequ_filter,
            )

        millesime_str = millesime if millesime is not None else "unknown"
        filter_str = f", typequ_filter={typequ_filter}" if typequ_filter else ""
        print(
            f"Loaded {inserted} rows into raw_bpe_equipement from {label} "
            f"(millesime={millesime_str}{filter_str})"
        )
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    finally:
        if handle is not None:
            try:
                handle.close()
            except Exception:
                pass

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
