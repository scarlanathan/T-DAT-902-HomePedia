#!/usr/bin/env python3
"""Run every cleaning job then the cross-dataset analysis, in dependency order.

This is the single entry point to spark-submit for a full lake refresh:

    spark-submit run_all.py

Each step reads from ``<LAKE_ROOT>/raw/<source>`` and writes Parquet to
``<LAKE_ROOT>/curated/...``; the final analyse step joins them all. Steps run
sequentially (each manages its own SparkSession) so a failure is easy to locate.
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from jobs import analyse_commune, clean_bpe, clean_cog, clean_dvf, clean_filosofi

# (label, module) - cleaning first, analysis last (it joins the curated outputs).
STEPS = [
    ("cog", clean_cog),
    ("dvf", clean_dvf),
    ("filosofi", clean_filosofi),
    ("bpe", clean_bpe),
    ("analyse_commune", analyse_commune),
]


def main() -> int:
    only = set(a for a in sys.argv[1:] if not a.startswith("-"))
    for label, module in STEPS:
        if only and label not in only:
            continue
        print(f"\n===== [{label}] =====")
        rc = module.main()
        if rc != 0:
            print(f"[run_all] step '{label}' failed with rc={rc}", file=sys.stderr)
            return rc
    print("\n[run_all] all steps complete")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
