#!/usr/bin/env python3
"""
Load monthly bank interest rates into raw_interest_rate.

Default source: ECB Statistical Data Warehouse (MIR dataset), series for
France housing loans to households, new business (annualised agreed rate):

  https://data-api.ecb.europa.eu/service/data/MIR/M.FR.B.A2C.A.R.A.2250.EUR.N?format=csvdata&detail=dataonly

The CSV is comma-delimited with (at least) columns KEY, TIME_PERIOD, OBS_VALUE.
This national monthly series feeds the borrowing-capacity computation in
app_opportunity_score (replacing the hard-coded assumed interest rate).

Truncate deletes only the loaded series_key, so several series can coexist.

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

INSERT_SQL = """
INSERT INTO raw_interest_rate (
    source_file, source_row_number,
    series_key, indicator, ref_area, freq, period, obs_value
) VALUES (
    %s, %s,
    %s, %s, %s, %s, %s, %s
)
"""


def _field(row: dict[str, str], name: str) -> str | None:
    for key in row:
        if (key or "").upper().strip() == name:
            v = row.get(key)
            if v is None or v.strip() == "":
                return None
            return v.strip()
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
        return label, csv.DictReader(raw), raw

    if not url:
        raise ValueError("Either --file or --url is required")

    req = urllib.request.Request(url, headers={"User-Agent": "HomepediaRatesLoader/1.0"})
    resp = urllib.request.urlopen(req, timeout=120)
    body: BinaryIO = resp
    if url.endswith(".gz"):
        gz = gzip.GzipFile(fileobj=body)
        text = io.TextIOWrapper(gz, encoding=encoding, newline="")
    else:
        text = io.TextIOWrapper(body, encoding=encoding, newline="")
    return url, csv.DictReader(text), text


def ensure_schema(conn: psycopg.Connection, schema_path: Path) -> None:
    sql = schema_path.read_text(encoding="utf-8")
    for stmt in (s.strip() for s in sql.split(";")):
        if stmt:
            conn.execute(stmt)
    conn.commit()


def load_rows(
    conn: psycopg.Connection,
    source_label: str,
    indicator: str,
    rows: Iterable[dict[str, str]],
    max_rows: int | None,
    batch_size: int,
) -> tuple[int, set[str]]:
    header_checked = False
    buffer: list[tuple] = []
    total = 0
    row_num = 0
    series_seen: set[str] = set()

    with conn.cursor() as cur:
        for row in rows:
            row_num += 1
            if not header_checked:
                present = {(k or "").upper().strip() for k in row.keys()}
                missing = {"TIME_PERIOD", "OBS_VALUE"} - present
                if missing:
                    raise ValueError(
                        f"CSV missing expected columns: {sorted(missing)}. "
                        "Expected an ECB SDW csvdata export (KEY, TIME_PERIOD, OBS_VALUE)."
                    )
                header_checked = True

            series = _field(row, "KEY")
            if series:
                series_seen.add(series)
            buffer.append(
                (
                    source_label,
                    row_num,
                    series,
                    indicator,
                    _field(row, "REF_AREA"),
                    _field(row, "FREQ"),
                    _field(row, "TIME_PERIOD"),
                    _field(row, "OBS_VALUE"),
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
    return total, series_seen


def main() -> int:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Load monthly interest rates into raw_interest_rate")
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL"))
    parser.add_argument("--file", type=Path, help="Local CSV or CSV.gz path")
    parser.add_argument(
        "--url",
        default=os.environ.get("RATES_CSV_URL"),
        help="Remote CSV URL (ECB SDW csvdata) or set RATES_CSV_URL",
    )
    parser.add_argument(
        "--indicator",
        default="housing_loan_rate",
        help="Logical indicator name stored alongside the series (default: housing_loan_rate)",
    )
    parser.add_argument("--encoding", default="utf-8")
    parser.add_argument("--max-rows", type=int, default=None)
    parser.add_argument(
        "--truncate",
        action="store_true",
        help="Delete existing rows for the loaded series_key(s) before insert",
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
        print("Provide --file or --url (or set RATES_CSV_URL)", file=sys.stderr)
        return 1

    text_io: TextIO | None = None
    try:
        label, reader, text_io = _open_csv_stream(args.file, args.url, args.encoding)
        # Buffer rows so we know which series to truncate before inserting.
        rows = list(reader)
        with psycopg.connect(args.database_url) as conn:
            ensure_schema(conn, args.schema_file)
            if args.truncate:
                series_keys = {
                    (r.get("KEY") or r.get("key") or "").strip()
                    for r in rows
                    if (r.get("KEY") or r.get("key"))
                }
                for key in series_keys:
                    conn.execute("DELETE FROM raw_interest_rate WHERE series_key = %s", (key,))
                conn.commit()
            inserted, series_seen = load_rows(
                conn, label, args.indicator, rows, args.max_rows, args.batch_size
            )
        series_str = ",".join(sorted(series_seen)) or "unknown"
        print(f"Loaded {inserted} rows into raw_interest_rate from {label} (series={series_str})")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    finally:
        if text_io is not None:
            text_io.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
