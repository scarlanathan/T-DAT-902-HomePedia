-- Fails when a non-empty postal code is not exactly five digits.
select
    code_commune,
    code_postal
from {{ ref('dim_location') }}
where code_postal is not null
  and trim(code_postal) <> ''
  and code_postal !~ '^[0-9]{5}$'
