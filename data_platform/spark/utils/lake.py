"""Data-lake path conventions.

The lake has two zones under a single root (``LAKE_ROOT``):

    <LAKE_ROOT>/raw/<source>/...        files exactly as published (immutable)
    <LAKE_ROOT>/curated/<source>/       cleaned, typed Parquet written by Spark

``LAKE_ROOT`` defaults to the HDFS namenode inside the docker stack, but can point
at a local folder (``file:///...``) for cluster-less development.
"""

from __future__ import annotations

import os

LAKE_ROOT = os.environ.get("LAKE_ROOT", "hdfs://namenode:9000/lake").rstrip("/")


def raw_path(source: str, *parts: str) -> str:
    """Path of a raw input under ``<LAKE_ROOT>/raw/<source>/...``."""
    tail = "/".join(p.strip("/") for p in parts if p)
    base = f"{LAKE_ROOT}/raw/{source}"
    return f"{base}/{tail}" if tail else base


def curated_path(dataset: str) -> str:
    """Output folder of a curated dataset under ``<LAKE_ROOT>/curated/<dataset>``."""
    return f"{LAKE_ROOT}/curated/{dataset}"
