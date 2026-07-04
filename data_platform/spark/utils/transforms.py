"""Reusable column-cleaning helpers.

French open data is messy in predictable ways: decimal commas, thousands spaces,
and statistical-secrecy tokens (``s``, ``ns``, ``nd``) standing in for nulls. These
helpers centralise that cleanup so every job treats values the same way.
"""

from __future__ import annotations

from pyspark.sql import Column
from pyspark.sql import functions as F

# Tokens that mean "no value" across INSEE / data.gouv files (incl. statistical secrecy).
NULL_TOKENS = ["", "s", "ns", "nd", "na", "n/a", "null", "."]


def blank_to_null(col: Column) -> Column:
    """Map empty strings and INSEE null-tokens to a real SQL NULL."""
    c = F.trim(col.cast("string"))
    return F.when(F.lower(c).isin(NULL_TOKENS), None).otherwise(c)


def to_double(col: Column, comma_decimal: bool = False) -> Column:
    """Parse a (possibly French-formatted) numeric string into a double.

    Strips surrounding whitespace and thousands separators; when
    ``comma_decimal`` is set, converts ``1 234,56`` -> ``1234.56``.
    """
    c = blank_to_null(col)
    # Drop spaces and non-breaking spaces used as thousands separators.
    c = F.regexp_replace(c, "[\\s\\u00a0]", "")
    if comma_decimal:
        c = F.regexp_replace(c, ",", ".")
    return c.cast("double")


def to_int(col: Column) -> Column:
    """Parse an integer-like string, tolerating a trailing ``.0`` and null-tokens."""
    c = blank_to_null(col)
    c = F.regexp_replace(c, "[\\s\\u00a0]", "")
    c = F.regexp_replace(c, "\\.0+$", "")
    return c.cast("int")


def clean_insee_code(col: Column, width: int = 5) -> Column:
    """Normalise an INSEE geographic code: trim, drop a trailing ``.0`` that sneaks in
    from spreadsheet exports, and left-pad with zeros (Ain communes lose their leading 0).
    """
    c = F.trim(col.cast("string"))
    c = F.regexp_replace(c, "\\.0+$", "")
    return F.lpad(c, width, "0")
