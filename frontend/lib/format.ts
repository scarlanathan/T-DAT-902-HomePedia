import type { Locale } from "@/lib/i18n/types";
import { INTL_LOCALE } from "@/lib/i18n/types";
import { getMessages } from "@/lib/i18n";

const DEFAULT_LOCALE: Locale = "en";

export function parseNumeric(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function formatFrNumber(
  n: number | null | undefined,
  opts?: Intl.NumberFormatOptions,
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (n == null || !Number.isFinite(n)) return getMessages(locale).common.emDash;
  return new Intl.NumberFormat(INTL_LOCALE[locale], opts).format(n);
}

export function formatEuro(
  n: number | null | undefined,
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (n == null || !Number.isFinite(n)) return getMessages(locale).common.emDash;
  return `${formatFrNumber(Math.round(n), undefined, locale)} €`;
}

export function formatMonthLabel(iso: string, locale: Locale = DEFAULT_LOCALE): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 7);
  return d.toLocaleDateString(INTL_LOCALE[locale], {
    month: "short",
    year: "numeric",
  });
}

export function formatPercent(
  n: number | null | undefined,
  digits = 1,
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (n == null || !Number.isFinite(n)) return getMessages(locale).common.emDash;
  return `${formatFrNumber(n, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }, locale)} %`;
}

export function formatScore(
  n: number | null | undefined,
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (n == null || !Number.isFinite(n)) return getMessages(locale).common.emDash;
  return formatFrNumber(n, { maximumFractionDigits: 1 }, locale);
}

/** Maps DVF property types to localized labels for display. */
export function formatPropertyType(
  type: string | null | undefined,
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (!type) return getMessages(locale).common.emDash;
  const labels = getMessages(locale).propertyType;
  return labels[type as keyof typeof labels] ?? type;
}
