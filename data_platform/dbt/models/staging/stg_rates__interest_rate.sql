{{
  config(
    materialized='view',
    tags=['rates', 'staging'],
  )
}}

-- Staging: monthly bank interest rates. Grain = one raw CSV row (series × month).
-- period 'YYYY-MM' -> rate_month (first day of month); obs_value -> percent.
SELECT
    raw_id,
    ingested_at,
    source_file,
    source_row_number,
    NULLIF(TRIM(series_key), '') AS series_key,
    NULLIF(TRIM(indicator), '')  AS indicator,
    NULLIF(TRIM(ref_area), '')   AS ref_area,
    NULLIF(TRIM(period), '')     AS period,
    CASE
        WHEN period ~ '^[0-9]{4}-[0-9]{2}$' THEN to_date(period || '-01', 'YYYY-MM-DD')
    END AS rate_month,
    {{ parse_decimal('obs_value') }} AS rate_pct
FROM {{ source('raw', 'raw_interest_rate') }}
