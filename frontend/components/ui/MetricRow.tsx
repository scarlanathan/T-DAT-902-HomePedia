"use client";

import { InfoPopoverButton } from "@/components/ui/InfoPopoverButton";
import { useLocale } from "@/lib/locale-context";

type Props = {
  label: string;
  value: string;
  hint?: string;
  info?: string;
  loading?: boolean;
  highlight?: boolean;
};

export function MetricRow({ label, value, hint, info, loading, highlight }: Props) {
  const { t } = useLocale();

  return (
    <div className="min-w-0 rounded-lg bg-ink-50/50 px-3 py-2.5 ring-1 ring-ink-100/80 dark:bg-ink-800/50 dark:ring-ink-700/60">
      <div className="flex items-start justify-between gap-1.5">
        <p
          className="min-w-0 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400"
          title={label}
        >
          {label}
        </p>
        {info ? (
          <InfoPopoverButton
            variant="question"
            ariaLabel={t("metricInfo.buttonLabel", { label })}
            dialogLabel={t("metricInfo.dialogLabel", { label })}
            contentKey={info}
          >
            {info}
          </InfoPopoverButton>
        ) : null}
      </div>
      <p
        className={`mt-1 font-bold tabular-nums tracking-tight text-ink-900 dark:text-ink-50 ${
          highlight ? "text-xl" : "text-lg"
        } ${loading ? "animate-pulse text-ink-400" : ""}`}
        title={value}
      >
        {value}
      </p>
      {hint ? (
        <p
          className="mt-1 text-xs leading-snug text-ink-500 dark:text-ink-400"
          title={hint}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
