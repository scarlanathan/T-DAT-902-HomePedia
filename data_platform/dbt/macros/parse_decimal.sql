{% macro parse_decimal(column) %}
CASE
    WHEN {{ column }} IS NULL OR TRIM({{ column }}) = '' THEN NULL
    WHEN LOWER(TRIM({{ column }})) IN ('s', 'so', 'nd', 'ns') THEN NULL
    WHEN REPLACE(TRIM({{ column }}), ',', '.') ~ '^-?[0-9]+(\.[0-9]+)?$'
        THEN REPLACE(TRIM({{ column }}), ',', '.')::numeric
    ELSE NULL
END
{% endmacro %}
