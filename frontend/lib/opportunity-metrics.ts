import type { MessageKey } from "@/lib/i18n";
import type { useFormat } from "@/lib/locale-context";

type Format = ReturnType<typeof useFormat>;

export function formatEuroPerSqm(
  value: number | null,
  fmt: Format,
): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return `${fmt.formatFrNumber(value)} €/m²`;
}

export function buildPriceHint(
  t: (key: MessageKey, params?: Record<string, string | number>) => string,
): string {
  return t("opportunity.hintPrice");
}

export function buildPriceInfo(
  medianPricePerSqm: number | null,
  t: (key: MessageKey, params?: Record<string, string | number>) => string,
  fmt: Format,
): string {
  const price = formatEuroPerSqm(medianPricePerSqm, fmt);
  if (price) {
    return t("opportunity.infoPriceWithMedian", { price });
  }
  return t("opportunity.infoPrice");
}

export function buildSocialMixHint(
  t: (key: MessageKey, params?: Record<string, string | number>) => string,
): string {
  return t("opportunity.hintSocialMix");
}

export function buildSocialMixInfo(
  medianIncome: number | null,
  povertyRate: number | null,
  t: (key: MessageKey, params?: Record<string, string | number>) => string,
  fmt: Format,
): string {
  const income =
    medianIncome != null ? fmt.formatEuro(medianIncome) : null;
  const poverty =
    povertyRate != null ? fmt.formatPercent(povertyRate) : null;

  if (income && income !== "-" && poverty && poverty !== "-") {
    return t("opportunity.infoSocialMixWithData", { income, poverty });
  }

  return t("opportunity.infoSocialMix");
}

export function buildAmenitiesHint(
  t: (key: MessageKey, params?: Record<string, string | number>) => string,
): string {
  return t("opportunity.hintQualityOfLife");
}

export function buildAmenitiesInfo(
  equipmentCount: number | null,
  t: (key: MessageKey, params?: Record<string, string | number>) => string,
  fmt: Format,
): string {
  if (equipmentCount != null) {
    return t("opportunity.infoQualityOfLifeWithData", {
      count: fmt.formatFrNumber(equipmentCount),
    });
  }

  return t("opportunity.infoQualityOfLife");
}

export function parseOptional(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
