CREATE TABLE IF NOT EXISTS spark_job_metrics (
    id            SERIAL PRIMARY KEY,
    job_name      TEXT        NOT NULL,
    started_at    TIMESTAMPTZ NOT NULL,
    ended_at      TIMESTAMPTZ,
    duration_s    FLOAT,
    rows_in       BIGINT,
    rows_out      BIGINT,
    status        TEXT        NOT NULL CHECK (status IN ('success', 'error')),
    error_message TEXT
);
