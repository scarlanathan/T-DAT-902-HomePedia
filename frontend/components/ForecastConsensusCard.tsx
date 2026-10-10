"use client";

import { Panel } from "@/components/ui/Panel";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { IconGlobe } from "@/components/ui/icons";
import { changeToneClass, useSignedPercent } from "@/components/ForecastBits";
import {
  CONSENSUS_AS_OF,
  FORECAST_CONSENSUS,
  type ConsensusItem,
} from "@/lib/forecast-consensus";
import { INTL_LOCALE } from "@/lib/i18n/types";
import { useFormat, useLocale } from "@/lib/locale-context";

export function ForecastConsensusCard() {
  const { t, locale } = useLocale();
  const fmt = useFormat();
  const signed = useSignedPercent();

  const date = (iso: string, monthOnly = false) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString(INTL_LOCALE[locale], {
      day: monthOnly ? undefined : "numeric",
      month: monthOnly ? "long" : "short",
      year: "numeric",
    });

  const value = (item: ConsensusItem) => {
    if (item.unit === "count") return fmt.formatFrNumber(item.value);
    if (item.unit === "pct") return fmt.formatPercent(item.value, 2);
    if (item.valueMax != null) {
      return t("forecast.consensus.range", {
        min: signed(item.value, 0).replace(/\s?%$/, ""),
        max: signed(item.valueMax, 0),
      });
    }
    return signed(item.value);
  };

  const groups: { kind: ConsensusItem["kind"]; titleKey: Parameters<typeof t>[0] }[] = [
    { kind: "observed", titleKey: "forecast.consensus.groupObserved" },
    { kind: "forecast", titleKey: "forecast.consensus.groupForecast" },
    { kind: "market", titleKey: "forecast.consensus.groupMarket" },
  ];

  return (
    <Panel className="space-y-5">
      <SectionHeader
        title={t("forecast.consensus.title")}
        description={t("forecast.consensus.description", { date: date(CONSENSUS_AS_OF) })}
        icon={<IconGlobe />}
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {groups.map((g) => (
          <section key={g.kind} className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-600 dark:text-ink-300">
              {t(g.titleKey)}
            </h3>
            <ul className="space-y-3">
              {FORECAST_CONSENSUS.filter((i) => i.kind === g.kind).map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg bg-ink-50/60 px-3 py-2.5 ring-1 ring-ink-100/80 dark:bg-ink-800/50 dark:ring-ink-700/60"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium text-ink-800 dark:text-ink-100">{t(item.labelKey)}</p>
                    <p
                      className={`shrink-0 text-lg font-bold tabular-nums ${
                        item.unit === "signedPct" ? changeToneClass(item.value) : "text-ink-900 dark:text-ink-50"
                      }`}
                    >
                      {value(item)}
                    </p>
                  </div>
                  {item.noteKey ? (
                    <p className="mt-1 text-xs leading-snug text-ink-600 dark:text-ink-300">{t(item.noteKey)}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-dotted underline-offset-2 hover:text-brand-600 dark:hover:text-brand-300"
                      >
                        {item.source}
                      </a>
                    ) : (
                      item.source
                    )}
                    {" · "}
                    {date(item.date, item.monthOnly)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="rounded-lg border border-amber-300/60 bg-amber-50/70 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
        {t("forecast.disclaimer")}
      </p>
    </Panel>
  );
}
