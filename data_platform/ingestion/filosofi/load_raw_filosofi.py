#!/usr/bin/env python3
"""
Load INSEE FiLoSoFi CSV into raw_filosofi.

Two publication formats are supported (auto-detected, or forced with --format):

  wide  - Filosofi 1 (2012–2021): one row per commune/IRIS, columns like MED21, TP6021.
          Files: cc_filosofi_*_COM.zip, BASE_TD_FILO_IRIS_*_DISP*.zip, tests/fixtures/*_sample.csv

  v2    - Filosofi 2 (from revenus 2023): long/tidy CSV, pivot by FILOSOFI_MEASURE + GEO.
          Files: FILOSOFI_CC_csv.zip (DS_FILOSOFI_CC_*_data.csv)

Use --format wide | v2 | auto (default). Truncate deletes rows for (millesime, kind) only,
so loading multiple millésimes keeps history in raw_filosofi.

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

INSERT_SQL = """
INSERT INTO raw_filosofi (
    source_file, source_row_number, millesime, kind,
    codgeo, libgeo,
    tp60, med,
    d1, d2, d3, d4, d5, d6, d7, d8, d9, rd,
    pact, ptsa, pcho, pben, ppen, ppat, pcaf, plog
) VALUES (
    %s, %s, %s, %s,
    %s, %s,
    %s, %s,
    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
    %s, %s, %s, %s, %s, %s, %s, %s
)
"""

_MILLESIME_RE = re.compile(r"(\d{4})")
_SUFFIX_RE = re.compile(r"(\d{2})$")
_SKIP_COLS = {"CODGEO", "LIBGEO", "IRIS", "COM", "DEP", "REG", "AN", "TYPECOM"}
_WIDE_PREFIXES = ("DISP_", "DEC_")
# INSEE confidentiality / missing codes (wide + v2); keep lowercase for matching.
_NULL_SENTINELS = {"", "s", "so", "nd", "ns"}

# Filosofi 2 measure code → raw_filosofi column
_V2_MEASURE_TO_COL = {
    "MED_SL": "med",
    "PR_MD60": "tp60",
    "D1_SL": "d1",
    "D2_SL": "d2",
    "D3_SL": "d3",
    "D4_SL": "d4",
    "D5_SL": "d5",
    "D6_SL": "d6",
    "D7_SL": "d7",
    "D8_SL": "d8",
    "D9_SL": "d9",
    "IR_D9_D1_SL": "rd",
    "S_EI_DI": "pact",
    "S_EI_DI_SAL": "ptsa",
    "S_EI_DI_UNE": "pcho",
    "S_EI_DI_N_SAL": "pben",
    "S_RET_PEN_DI": "ppen",
    "S_INC_ASS_DI": "ppat",
    "S_SOC_BEN_DI_FAM_BEN": "pcaf",
    "S_SOC_BEN_DI_HOU_BEN": "plog",
}

_V2_GEO_TO_KIND = {
    "COM": "commune",
    "IRIS": "iris",
}


def detect_format(fieldnames: list[str] | None) -> str:
    if not fieldnames:
        raise ValueError("CSV has no header row")
    upper = {f.upper().strip() for f in fieldnames}
    if "FILOSOFI_MEASURE" in upper:
        return "v2"
    if "CODGEO" in upper or "IRIS" in upper:
        return "wide"
    raise ValueError(
        f"Cannot detect FiLoSoFi format from header: {fieldnames}. "
        "Use --format wide or v2."
    )


def detect_kind(fieldnames: list[str]) -> str:
    upper = {f.upper() for f in fieldnames}
    if "IRIS" in upper and "CODGEO" not in upper:
        return "iris"
    if "CODGEO" in upper:
        return "commune"
    raise ValueError(
        f"Cannot detect FiLoSoFi kind from header: {fieldnames}. "
        "Use --kind {commune,iris}."
    )


def detect_year_suffix(fieldnames: list[str]) -> str:
    for col in fieldnames:
        if col.upper() in _SKIP_COLS:
            continue
        m = _SUFFIX_RE.search(col)
        if m:
            return m.group(1)
    raise ValueError(
        f"Cannot detect year suffix from columns: {fieldnames}. "
        "Expected columns like MED21, TP6021, etc."
    )


def guess_millesime(label: str, override: int | None) -> int | None:
    if override is not None:
        return override
    name = os.path.basename(label)
    m = _MILLESIME_RE.search(name)
    if m:
        year = int(m.group(1))
        if 1990 <= year <= 2100:
            return year
    return None


def _pick_csv_from_zip(names: list[str], format_hint: str | None) -> str:
    csvs = [n for n in names if n.lower().endswith(".csv")]
    if not csvs:
        raise ValueError("No CSV file found inside ZIP")

    def is_meta(name: str) -> bool:
        base = os.path.basename(name).lower()
        return "metadata" in base or base.startswith("meta_")

    candidates = [n for n in csvs if not is_meta(n)]
    if not candidates:
        candidates = csvs

    if format_hint == "v2":
        data = [n for n in candidates if "_data" in os.path.basename(n).lower()]
        if data:
            return data[0]

    if format_hint == "wide":
        for token in ("DISP_COM", "filosofi", "_COM", "IRIS"):
            for n in candidates:
                if token.lower() in os.path.basename(n).lower():
                    return n

    return candidates[0]


def _open_csv_stream(
    path: Path | None,
    url: str | None,
    encoding: str,
    delimiter: str,
    format_hint: str | None,
) -> tuple[str, csv.DictReader, object]:
    if path and url:
        raise ValueError("Pass only one of --file or --url")

    if path:
        p = path.expanduser().resolve()
        label = str(p)
        reader, handle = _open_local(p, encoding, delimiter, format_hint)
        return label, reader, handle

    if not url:
        raise ValueError("Either --file or --url is required")

    req = urllib.request.Request(url, headers={"User-Agent": "HomepediaFiLoSoFiLoader/1.0"})
    resp = urllib.request.urlopen(req, timeout=180)
    reader, handle = _open_remote(resp, url, encoding, delimiter, format_hint)
    return url, reader, handle


def _open_local(p: Path, encoding: str, delimiter: str, format_hint: str | None):
    if p.suffix == ".zip":
        zf = zipfile.ZipFile(p)
        csv_name = _pick_csv_from_zip(zf.namelist(), format_hint)
        inner = zf.open(csv_name)
        text = io.TextIOWrapper(inner, encoding=encoding, newline="")
        return csv.DictReader(text, delimiter=delimiter), zf
    if p.suffix == ".gz":
        raw = gzip.open(p, "rt", encoding=encoding, newline="")
        return csv.DictReader(raw, delimiter=delimiter), raw
    raw = p.open("r", encoding=encoding, newline="")
    return csv.DictReader(raw, delimiter=delimiter), raw


def _open_remote(resp, url: str, encoding: str, delimiter: str, format_hint: str | None):
    body: io.RawIOBase = resp
    if url.endswith(".zip"):
        data = io.BytesIO(body.read())
        zf = zipfile.ZipFile(data)
        csv_name = _pick_csv_from_zip(zf.namelist(), format_hint)
        inner = zf.open(csv_name)
        text = io.TextIOWrapper(inner, encoding=encoding, newline="")
        return csv.DictReader(text, delimiter=delimiter), zf
    if url.endswith(".gz"):
        gz = gzip.GzipFile(fileobj=body)
        text = io.TextIOWrapper(gz, encoding=encoding, newline="")
        return csv.DictReader(text, delimiter=delimiter), text
    text = io.TextIOWrapper(body, encoding=encoding, newline="")
    return csv.DictReader(text, delimiter=delimiter), text


def _normalize_wide_row(row: dict[str, str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for key, value in row.items():
        stripped = key
        ku = key.upper()
        for prefix in _WIDE_PREFIXES:
            if ku.startswith(prefix):
                stripped = key[len(prefix) :]
                break
        out[stripped] = value
    return out


def _clean_value(raw: str | None) -> str | None:
    if raw is None:
        return None
    v = raw.strip()
    if v.lower() in _NULL_SENTINELS:
        return None
    return v


def _clean_numeric_value(raw: str | None) -> str | None:
    """Normalize INSEE French decimals (e.g. 19,0) for Postgres numeric casts."""
    v = _clean_value(raw)
    if v is None:
        return None
    v = v.replace("\u00a0", "").replace(" ", "")
    if "," in v:
        v = v.replace(",", ".")
    return v


def _row_tuple(
    kind: str,
    source_file: str,
    row_num: int,
    millesime: int | None,
    suffix: str,
    row: dict[str, str],
) -> tuple:
    row = _normalize_wide_row(row)

    def g(key: str) -> str | None:
        v = row.get(key) or row.get(key.upper())
        return _clean_value(v)

    def _row_get(key: str) -> str | None:
        return row.get(key) or row.get(key.upper())

    def m(*bases: str) -> str | None:
        for base in bases:
            if base.upper() == "RD":
                val = _clean_numeric_value(_row_get("RD" + suffix) or _row_get("RD"))
                if val is not None:
                    return val
                continue
            val = _clean_numeric_value(_row_get(base.upper() + suffix))
            if val is not None:
                return val
        return None

    codgeo = g("IRIS") if kind == "iris" else g("CODGEO")

    return (
        source_file,
        row_num,
        millesime,
        kind,
        codgeo,
        g("LIBGEO"),
        m("TP60"),
        m("MED"),
        m("D1"),
        m("D2"),
        m("D3"),
        m("D4"),
        m("D5"),
        m("D6"),
        m("D7"),
        m("D8"),
        m("D9"),
        m("RD"),
        m("PACT"),
        m("PTSA"),
        m("PCHO"),
        m("PBEN"),
        m("PPEN"),
        m("PPAT"),
        m("PCAF", "PPSOC"),
        m("PLOG", "PPLOGT"),
    )


def _v2_field(row: dict[str, str], name: str) -> str | None:
    for key in row:
        if key.upper().strip() == name:
            return _clean_value(row.get(key))
    return None


def _v2_rows_to_tuples(
    source_label: str,
    rows: Iterable[dict[str, str]],
    max_rows: int | None,
) -> list[tuple]:
    """Pivot long Filosofi 2 rows into wide raw_filosofi tuples."""
    buckets: dict[tuple[str, str, int], dict[str, str | None]] = {}

    for row_num, row in enumerate(rows, start=1):
        if max_rows is not None and row_num > max_rows:
            break

        measure = _v2_field(row, "FILOSOFI_MEASURE")
        geo = _v2_field(row, "GEO")
        geo_object = _v2_field(row, "GEO_OBJECT")
        period = _v2_field(row, "TIME_PERIOD")
        value = _clean_numeric_value(_v2_field(row, "OBS_VALUE"))

        if not measure or not geo or not geo_object or not period:
            continue
        if geo_object.upper() not in _V2_GEO_TO_KIND:
            continue
        col = _V2_MEASURE_TO_COL.get(measure.upper())
        if col is None or value is None:
            continue

        try:
            millesime = int(period)
        except ValueError:
            continue

        kind = _V2_GEO_TO_KIND[geo_object.upper()]
        key = (geo, kind, millesime)
        if key not in buckets:
            buckets[key] = {c: None for c in _V2_MEASURE_TO_COL.values()}
            buckets[key]["codgeo"] = geo
            buckets[key]["libgeo"] = None
        buckets[key][col] = value

    tuples: list[tuple] = []
    for idx, ((geo, kind, millesime), data) in enumerate(sorted(buckets.items()), start=1):
        tuples.append(
            (
                source_label,
                idx,
                millesime,
                kind,
                data["codgeo"],
                data["libgeo"],
                data["tp60"],
                data["med"],
                data["d1"],
                data["d2"],
                data["d3"],
                data["d4"],
                data["d5"],
                data["d6"],
                data["d7"],
                data["d8"],
                data["d9"],
                data["rd"],
                data["pact"],
                data["ptsa"],
                data["pcho"],
                data["pben"],
                data["ppen"],
                data["ppat"],
                data["pcaf"],
                data["plog"],
            )
        )
    return tuples


def ensure_schema(conn: psycopg.Connection, schema_path: Path) -> None:
    sql = schema_path.read_text(encoding="utf-8")
    for stmt in (s.strip() for s in sql.split(";")):
        if stmt:
            conn.execute(stmt)
    conn.commit()


def _insert_tuples(
    conn: psycopg.Connection,
    tuples: list[tuple],
    batch_size: int,
) -> int:
    with conn.cursor() as cur:
        for i in range(0, len(tuples), batch_size):
            batch = tuples[i : i + batch_size]
            cur.executemany(INSERT_SQL, batch)
    conn.commit()
    return len(tuples)


def load_rows_wide(
    conn: psycopg.Connection,
    kind: str,
    source_label: str,
    millesime: int | None,
    suffix: str,
    rows: Iterable[dict[str, str]],
    max_rows: int | None,
    batch_size: int,
) -> int:
    buffer: list[tuple] = []
    total = 0
    row_num = 0

    with conn.cursor() as cur:
        for row in rows:
            row_num += 1
            buffer.append(_row_tuple(kind, source_label, row_num, millesime, suffix, row))
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


def _truncate_pairs(
    conn: psycopg.Connection,
    pairs: set[tuple[int, str]],
) -> None:
    for millesime, kind in pairs:
        conn.execute(
            "DELETE FROM raw_filosofi WHERE millesime = %s AND kind = %s",
            (millesime, kind),
        )
    conn.commit()


def main() -> int:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Load INSEE FiLoSoFi CSV into raw_filosofi")
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL"))
    parser.add_argument("--file", type=Path, help="Local CSV, CSV.gz or ZIP path")
    parser.add_argument(
        "--url",
        default=os.environ.get("FILOSOFI_URL"),
        help="Remote ZIP/CSV URL (or set FILOSOFI_URL)",
    )
    parser.add_argument(
        "--format",
        choices=["auto", "wide", "v2"],
        default="auto",
        help="Publication format: wide (Filosofi 1), v2 (Filosofi 2), or auto-detect",
    )
    parser.add_argument(
        "--kind",
        choices=["commune", "iris"],
        default=None,
        help="Wide format only: level (auto-detected from header if omitted)",
    )
    parser.add_argument(
        "--millesime",
        type=int,
        default=None,
        help="Year of the release (auto-detected from filename or TIME_PERIOD if omitted)",
    )
    parser.add_argument("--encoding", default="utf-8", help="CSV encoding (default: utf-8)")
    parser.add_argument("--delimiter", default=";", help="CSV delimiter (default: ;)")
    parser.add_argument(
        "--max-rows",
        type=int,
        default=None,
        help="Wide: max source rows. V2: max long rows before pivot.",
    )
    parser.add_argument(
        "--truncate",
        action="store_true",
        help="Delete existing rows for this load scope before insert (see module doc)",
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
        print("Provide --file or --url (or set FILOSOFI_URL)", file=sys.stderr)
        return 1

    format_hint = None if args.format == "auto" else args.format
    handle = None
    try:
        label, reader, handle = _open_csv_stream(
            args.file,
            args.url,
            args.encoding,
            args.delimiter,
            format_hint,
        )
        fieldnames = reader.fieldnames or []
        fmt = args.format if args.format != "auto" else detect_format(fieldnames)

        with psycopg.connect(args.database_url) as conn:
            ensure_schema(conn, args.schema_file)

            if fmt == "v2":
                tuples = _v2_rows_to_tuples(label, reader, args.max_rows)
                if args.truncate and tuples:
                    scopes = {(t[2], t[3]) for t in tuples if t[2] is not None}
                    _truncate_pairs(conn, scopes)
                inserted = _insert_tuples(conn, tuples, args.batch_size)
                millesimes = sorted({t[2] for t in tuples if t[2] is not None})
                millesime_str = ",".join(str(m) for m in millesimes) or "unknown"
                print(
                    f"Loaded {inserted} rows into raw_filosofi from {label} "
                    f"(format=v2, millesime={millesime_str})"
                )
            else:
                kind = args.kind or detect_kind(fieldnames)
                suffix = detect_year_suffix(fieldnames)
                millesime = guess_millesime(label, args.millesime)
                if millesime is None:
                    millesime = 2000 + int(suffix)
                if args.truncate and millesime is not None:
                    _truncate_pairs(conn, {(millesime, kind)})
                inserted = load_rows_wide(
                    conn,
                    kind,
                    label,
                    millesime,
                    suffix,
                    reader,
                    args.max_rows,
                    args.batch_size,
                )
                print(
                    f"Loaded {inserted} rows into raw_filosofi from {label} "
                    f"(format=wide, kind={kind}, millesime={millesime}, suffix={suffix})"
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
