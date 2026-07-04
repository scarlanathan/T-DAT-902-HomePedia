{{
  config(
    materialized='view',
    tags=['rates', 'core'],
  )
}}

-- Core: one housing-loan interest rate per month (latest ingested wins).
-- National series — no commune grain. Feeds borrowing-capacity in the mart.
WITH ranked AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY rate_month
            ORDER BY ingested_at DESC, raw_id DESC
        ) AS _rn
    FROM {{ ref('stg_rates__interest_rate') }}
    WHERE indicator = 'housing_loan_rate'
      AND rate_month IS NOT NULL
      AND rate_pct IS NOT NULL
)

SELECT
    rate_month,
    rate_pct AS housing_loan_rate_pct
FROM ranked
WHERE _rn = 1
