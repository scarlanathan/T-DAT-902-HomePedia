"use client";

import { DatasetCard } from "@/components/ui/DatasetCard";
import { MetricRow } from "@/components/ui/MetricRow";
import { IconBuilding } from "@/components/ui/icons";
import type { OpportunityScoreRow, SearchPreferences } from "@/api";
import { formatEuro, formatPercent, parseNumeric } from "@/lib/format";
import { personalBorrowingCapacity } from "@/lib/preferences";

type Props = {
  row: OpportunityScoreRow | null;
  loading?: boolean;
  /** When present with an income, capacity is computed for THIS user. */
  preferences?: SearchPreferences | null;
};

/**
 * Affordability card — the heart of the problématique: can the buyer afford to
 * buy here? When the user set a borrowing profile at onboarding, the capacity
 * and ratio are computed for THEM (income × DTI + down payment, at the real
 * ECB/BdF monthly rate); otherwise it falls back to the local-median estimate.
 */
export function AffordabilityCard({ row, loading, preferences }: Props) {
  const rate = parseNumeric(row?.assumed_interest_rate); // fraction, e.g. 0.031
  const medianSale = parseNumeric(row?.median_valeur_fonciere);

  const personalCapacity =
    preferences && rate != null
      ? personalBorrowingCapacity(preferences, rate)
      : null;
  const personal = personalCapacity != null;

  const capacity = personal
    ? personalCapacity
    : parseNumeric(row?.borrowing_capacity_eur);
  const ratio = personal
    ? medianSale != null && (personalCapacity as number) > 0
      ? medianSale / (personalCapacity as number)
      : null
    : parseNumeric(row?.price_to_capacity_ratio);

  const termYears = personal
    ? (preferences as SearchPreferences).termYears
    : row?.assumed_term_months != null
      ? Math.round(row.assumed_term_months / 12)
      : null;
  const dti = personal
    ? (preferences as SearchPreferences).maxDti
    : parseNumeric(row?.assumed_max_dti);

  const verdict = ratioVerdict(ratio, personal);

  const rateHint =
    rate != null
      ? `${personal ? "Votre profil" : "Taux réel"} · ${formatPercent(rate * 100, 2)}` +
        (termYears != null ? ` · ${termYears} ans` : "") +
        (dti != null ? ` · ${formatPercent(dti * 100, 0)} d'endettement` : "")
      : personal
        ? "Selon votre profil d'emprunt"
        : "Capacité au revenu médian local";

  const items = [
    {
      label: "Accessibilité",
      value: loading
        ? "…"
        : ratio != null
          ? `${ratio.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}×`
          : "—",
      hint: verdict.label,
      highlight: true,
    },
    {
      label: personal ? "Votre capacité d'emprunt" : "Capacité d'emprunt",
      value: loading ? "…" : formatEuro(capacity),
      hint: rateHint,
    },
    {
      label: "Prix médian de vente",
      value: loading ? "…" : formatEuro(medianSale),
      hint: "Bien médian vendu (DVF)",
    },
    {
      label: "Taxe foncière",
      value: loading ? "…" : formatPercent(parseNumeric(row?.property_tax_rate_pct), 2),
      hint: "Taux global bâti (DGFiP) — charge annuelle récurrente",
    },
  ];

  return (
    <DatasetCard
      title="Accessibilité"
      description={
        personal
          ? "Votre capacité d'emprunt vs prix — profil personnalisé"
          : "Capacité d'emprunt réelle vs prix — au taux BCE/BdF du mois"
      }
      icon={<IconBuilding />}
      tone="dvf"
      badge={verdict.badge}
    >
      {items.map((item) => (
        <MetricRow
          key={item.label}
          label={item.label}
          value={item.value}
          hint={item.hint}
          loading={loading}
          highlight={item.highlight}
        />
      ))}
    </DatasetCard>
  );
}

function ratioVerdict(
  ratio: number | null,
  personal: boolean,
): { label: string; badge?: string } {
  const ref = personal ? "votre capacité" : "la capacité locale";
  if (ratio == null) return { label: "Données insuffisantes" };
  if (ratio <= 1)
    return {
      label: personal
        ? "Accessible avec votre capacité d'emprunt"
        : "Accessible sur le revenu médian local",
      badge: "Accessible",
    };
  const x = ratio.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  if (ratio <= 1.5) return { label: `Tendu — ${x}× ${ref}`, badge: "Tendu" };
  return { label: `Peu accessible — ${x}× ${ref}`, badge: "Peu accessible" };
}
