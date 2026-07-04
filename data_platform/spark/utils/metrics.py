import os
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Optional

import psycopg


def _get_connection():
    database_url = os.environ.get(
        "DATABASE_URL",
        "postgresql://homepedia:homepedia@localhost:5432/homepedia",
    )
    return psycopg.connect(database_url)


def _save_metrics(
    job_name: str,
    started_at: datetime,
    ended_at: datetime,
    rows_in: int,
    rows_out: int,
    status: str,
    error_message: Optional[str],
) -> None:
    duration_s = (ended_at - started_at).total_seconds()
    with _get_connection() as conn:
        conn.execute(
            """
            INSERT INTO spark_job_metrics
                (job_name, started_at, ended_at, duration_s, rows_in, rows_out, status, error_message)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (job_name, started_at, ended_at, duration_s, rows_in, rows_out, status, error_message),
        )
        conn.commit()


@contextmanager
def track_job(job_name: str, rows_in: int = 0):
    """
    Contexte manager qui enregistre la durée et le statut du job dans spark_job_metrics.

    Usage:
        with track_job("dvf-processing", rows_in=df.count()) as metrics:
            # traitement...
            metrics["rows_out"] = clean_df.count()
    """
    started_at = datetime.now(timezone.utc)
    metrics = {"rows_out": 0}
    try:
        yield metrics
        ended_at = datetime.now(timezone.utc)
        _save_metrics(
            job_name, started_at, ended_at,
            rows_in, metrics["rows_out"],
            "success", None,
        )
    except Exception as e:
        ended_at = datetime.now(timezone.utc)
        _save_metrics(
            job_name, started_at, ended_at,
            rows_in, 0,
            "error", str(e),
        )
        raise
