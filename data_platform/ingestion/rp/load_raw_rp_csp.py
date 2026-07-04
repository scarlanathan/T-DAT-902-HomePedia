#!/usr/bin/env python3
"""
Load INSEE RP active population by socio-professional category into raw_rp_csp.

Default source (INSEE, RP 2021 "activité des résidents", IRIS level):
  https://www.insee.fr/fr/statistiques/fichier/8268843/base-ic-activite-residents-2021_csv.zip

The ZIP holds base-ic-activite-residents-2021.CSV (the data file) and a
meta_*.CSV (ignored). The CSV is latin-1, ';'-delimited, ~119 columns; only the
IRIS/commune keys and the CSP counts C21_ACT1564_CS1..CS6 are landed.

Environment:
  DATABASE_URL  PostgreSQL connection URI (preferred)
"""

from __future__ import annotations

import argparse
import csv
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

# Source column name -> raw_rp_csp column.
FIELD_MAP = {
    "IRIS": "code_iris",
    "COM": "code_com",
    "P21_ACT1564": "pop_active_1564",
    "C21_ACT1564_CS1": "cs1_agriculteurs",
    "C21_ACT1564_CS2": "cs2_artisans",
    "C21_ACT1564_CS3": "cs3_cadres",
    "C21_ACT1564_CS4": "cs4_prof_interm",
    "C21_ACT1564_CS5": "cs5_employes",
    "C21_ACT1564_CS6": "cs6_ouvriers",
}

ORDERED_COLS = [
    "code_iris",
    "code_com",
    "pop_active_1564",
    "cs1_agriculteurs",
    "cs2_artisans",
    "cs3_cadres",
    "cs4_prof_interm",
    "cs5_employes",
    "cs6_ouvriers",
]

INSERT_SQL = """
INSERT INTO raw_rp_csp (
    source_file, source_row_number, millesime,
    code_iris, code_com, pop_active_1564,
    cs1_agriculteurs, cs2_artisans, cs3_cadres,
    cs4_prof_interm, cs5_employes, cs6_ouvriers
) VALUES (
    %s, %s, %s,
    %s, %s, %s,
    %s, %s, %s,
    %s, %s, %s
)
"""

_MILLESIME_RE = re.compile(r"(\d{4})")


def guess_millesime(label: str, override: int | None) -> int | None:
    if override is not None:
        return override
    m = _MILLESIME_RE.search(os.path.basename(label))
    if m:
        year = int(m.group(1))
        if 1990 <= year <= 2100:
            return year
    return None


def _pick_data_csv(names: list[str]) -> str:
    csvs = [n for n in names if n.lower().endswith(".csv")]
    if not csvs:
        raise ValueError("No CSV file found inside ZIP")
    data = [n for n in csvs if not os.path.basename(n).lower().startswith("meta")]
    return (data or csvs)[0]


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
        if p.suffix == ".zip":
            zf = zipfile.ZipFile(p)
            name = _pick_data_csv(zf.namelist())
            text = io.TextIOWrapper(zf.open(name), encoding=encoding, newline="")
            return label, csv.DictReader(text, delimiter=delimiter), zf
        raw = p.open("r", encoding=encoding, newline="")
        return label, csv.DictReader(raw, delimiter=delimiter), raw

    if not url:
        raise ValueError("Either --file or --url is required")

    req = urllib.request.Request(url, headers={"User-Agent": "HomepediaRPLoader/1.0"})
    resp = urllib.request.urlopen(req, timeout=300)
    if url.endswith(".zip"):
        data = io.BytesIO(resp.read())
        zf = zipfile.ZipFile(data)
        name = _pick_data_csv(zf.namelist())
        text = io.TextIOWrapper(zf.open(name), encoding=encoding, newline="")
        return url, csv.DictReader(text, delimiter=delimiter), zf
    text = io.TextIOWrapper(resp, encoding=encoding, newline="")
    return url, csv.DictReader(text, delimiter=delimiter), text


def _get(row: dict[str, str], src_name: str) -> str | None:
    for key in row:
        if (key or "").strip().upper() == src_name:
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
    millesime: int | None,
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
                missing = {"COM", "C21_ACT1564_CS3"} - present
                if missing:
                    raise ValueError(
                        f"CSV missing expected RP columns: {sorted(missing)}. "
                        "Use base-ic-activite-residents (see module doc)."
                    )
                header_checked = True

            values = {dst: _get(row, src) for src, dst in FIELD_MAP.items()}
            buffer.append(
                (source_label, row_num, millesime, *(values[c] for c in ORDERED_COLS))
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
    parser = argparse.ArgumentParser(description="Load INSEE RP CSP into raw_rp_csp")
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL"))
    parser.add_argument("--file", type=Path, help="Local ZIP or CSV path")
    parser.add_argument(
        "--url",
        default=os.environ.get("RP_CSP_URL"),
        help="Remote ZIP/CSV URL (or set RP_CSP_URL)",
    )
    parser.add_argument("--millesime", type=int, default=None)
    parser.add_argument("--encoding", default="latin-1", help="CSV encoding (default: latin-1)")
    parser.add_argument("--delimiter", default=";", help="CSV delimiter (default: ;)")
    parser.add_argument("--max-rows", type=int, default=None)
    parser.add_argument(
        "--truncate",
        action="store_true",
        help="DELETE all rows from raw_rp_csp before load",
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
        print("Provide --file or --url (or set RP_CSP_URL)", file=sys.stderr)
        return 1

    handle = None
    try:
        label, reader, handle = _open_csv_stream(
            args.file, args.url, args.encoding, args.delimiter
        )
        millesime = guess_millesime(label, args.millesime)
        with psycopg.connect(args.database_url) as conn:
            ensure_schema(conn, args.schema_file)
            if args.truncate:
                conn.execute("TRUNCATE TABLE raw_rp_csp RESTART IDENTITY")
                conn.commit()
            inserted = load_rows(
                conn, label, millesime, reader, args.max_rows, args.batch_size
            )
        millesime_str = millesime if millesime is not None else "unknown"
        print(
            f"Loaded {inserted} rows into raw_rp_csp from {label} (millesime={millesime_str})"
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
