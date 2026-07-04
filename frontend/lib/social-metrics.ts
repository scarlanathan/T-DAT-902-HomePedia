import type { MessageKey } from "@/lib/i18n";
import type { useFormat } from "@/lib/locale-context";

type Format = ReturnType<typeof useFormat>;

export function formatInequalityRatio(
  ratio: number | null,
  fmt: Format,
): string {
  if (ratio == null) return fmt.formatFrNumber(null);
  return `${fmt.formatFrNumber(ratio, { maximumFractionDigits: 1 })}×`;
}

function inequalityParams(
  ratio: number | null,
  incomeD1: string | null | undefined,
  incomeD9: string | null | undefined,
  fmt: Format,
) {
  const ratioLabel =
    ratio == null ? null : formatInequalityRatio(ratio, fmt).replace("×", "");
  const d1 = fmt.formatEuro(parseOptional(incomeD1));
  const d9 = fmt.formatEuro(parseOptional(incomeD9));
  const hasIncomes = ratioLabel != null && d1 !== "-" && d9 !== "-";

  return { ratioLabel, d1, d9, hasIncomes };
}

export function buildInequalityHint(
  ratio: number | null,
  incomeD1: string | null | undefined,
  incomeD9: string | null | undefined,
  t: (key: MessageKey, params?: Record<string, string | number>) => string,
  fmt: Format,
): string | undefined {
  const { ratioLabel, d1, d9, hasIncomes } = inequalityParams(
    ratio,
    incomeD1,
    incomeD9,
    fmt,
  );

  if (hasIncomes) {
    return t("social.hintInequalityWithIncomes", {
      d1,
      d9,
    });
  }

  if (ratio != null) {
    return t("social.hintInequality");
  }

  return t("social.hintInequality");
}

export function buildInequalityInfo(
  ratio: number | null,
  incomeD1: string | null | undefined,
  incomeD9: string | null | undefined,
  t: (key: MessageKey, params?: Record<string, string | number>) => string,
  fmt: Format,
): string {
  if (ratio == null) return t("social.infoInequality");

  const { ratioLabel, d1, d9, hasIncomes } = inequalityParams(
    ratio,
    incomeD1,
    incomeD9,
    fmt,
  );

  if (hasIncomes) {
    return t("social.infoInequalityWithIncomes", {
      ratio: ratioLabel!,
      d1,
      d9,
    });
  }

  return t("social.infoInequalityWithRatio", { ratio: ratioLabel! });
}

function parseOptional(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
