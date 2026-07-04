"use client";

import { DatasetCard } from "@/components/ui/DatasetCard";
import { MetricRow } from "@/components/ui/MetricRow";
import { IconBuilding } from "@/components/ui/icons";
import type { CityEquipmentSummaryRow } from "@/api";
import { parseNumeric } from "@/lib/format";
import { useFormat, useLocale } from "@/lib/locale-context";

type Props = {
  row: CityEquipmentSummaryRow | null;
  loading?: boolean;
};

export function EquipmentStatCards({ row, loading }: Props) {
  const { t } = useLocale();
  const fmt = useFormat();

  const items = [
    {
      label: t("equipment.total"),
      value: loading ? t("common.ellipsis") : formatCount(row?.equipment_total_count, fmt),
      info: t("equipment.infoTotal"),
      hint: t("equipment.hintTotal"),
    },
    {
      label: t("equipment.education"),
      value: loading ? t("common.ellipsis") : formatCount(row?.education_count, fmt),
      info: t("equipment.infoEducation"),
      hint: t("equipment.hintEducation"),
    },
    {
      label: t("equipment.health"),
      value: loading ? t("common.ellipsis") : formatCount(row?.health_count, fmt),
      info: t("equipment.infoHealth"),
      hint: t("equipment.hintHealth"),
    },
    {
      label: t("equipment.commerceSport"),
      value: loading
        ? t("common.ellipsis")
        : formatCount(
            sumCounts(row?.commerce_count, row?.sport_count, row?.other_count),
            fmt,
          ),
      info: t("equipment.infoCommerceSport"),
      hint: t("equipment.hintCommerceSport"),
    },
  ];

  return (
    <DatasetCard
      title={t("equipment.title")}
      description={t("equipment.description")}
      sourceInfo={{
        name: t("equipment.sourceName"),
        about: t("equipment.sourceAbout"),
        detail: row?.bpe_millesime
          ? t("equipment.sourceVintage", { year: row.bpe_millesime })
          : undefined,
      }}
      icon={<IconBuilding />}
      tone="equipment"
    >
      {items.map((item) => (
        <MetricRow
          key={item.label}
          label={item.label}
          value={item.value}
          hint={item.hint}
          info={item.info}
          loading={loading}
        />
      ))}
    </DatasetCard>
  );
}

function formatCount(
  value: string | null | undefined,
  fmt: ReturnType<typeof useFormat>,
): string {
  const n = parseNumeric(value);
  return n != null ? fmt.formatFrNumber(n) : fmt.formatFrNumber(null);
}

function sumCounts(
  ...values: Array<string | null | undefined>
): string | null {
  let total = 0;
  let hasValue = false;
  for (const value of values) {
    const n = parseNumeric(value);
    if (n != null) {
      total += n;
      hasValue = true;
    }
  }
  return hasValue ? String(total) : null;
}
