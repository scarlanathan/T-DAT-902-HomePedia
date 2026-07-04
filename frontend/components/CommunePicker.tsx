"use client";

import { useMemo, useState } from "react";
import type { LocationRow } from "@/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel } from "@/components/ui/Panel";
import { IconMapPin, IconSearch } from "@/components/ui/icons";
import { inputClassName } from "@/components/ui/field-styles";
import { communePostalCode } from "@/lib/commune-display";
import { MAP_PANEL_HEIGHT_CLASS } from "@/lib/map-layout";
import { useLocale } from "@/lib/locale-context";

export const COMMUNE_LOAD_ERROR_KEY = "communePicker.loadError";

type Props = {
  codeDepartement?: string;
  communes: LocationRow[];
  loading?: boolean;
  error?: string | null;
  selectedCodeCommune?: string;
  onSelect: (loc: LocationRow) => void;
  panelClassName?: string;
};

export function CommunePicker({
  codeDepartement,
  communes,
  loading,
  error,
  selectedCodeCommune,
  onSelect,
  panelClassName = MAP_PANEL_HEIGHT_CLASS,
}: Props) {
  const { t } = useLocale();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return communes;
    return communes.filter((c) => {
      const postal = communePostalCode(c);
      return (
        postal.includes(q) ||
        c.code_commune.includes(q) ||
        (c.nom_commune?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [communes, query]);

  const errorMessage =
    error === COMMUNE_LOAD_ERROR_KEY ? t("communePicker.loadError") : error;

  return (
    <Panel
      padding="sm"
      className={`flex w-full flex-col ${panelClassName}`}
    >
      {!codeDepartement ? (
        <div className="flex flex-1 items-center">
          <EmptyState icon={<IconMapPin />}>
            {t("communePicker.emptyHint")}
          </EmptyState>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-base font-semibold text-ink-900 dark:text-ink-50">
              {t("communePicker.title", { dept: codeDepartement })}
            </h3>
            {!loading && (
              <span className="rounded-full bg-ink-100 px-3 py-1 text-sm font-medium text-ink-600 dark:bg-ink-800 dark:text-ink-300">
                {communes.length === 1
                  ? t("communePicker.communeOne", { count: communes.length })
                  : t("communePicker.communeMany", { count: communes.length })}
              </span>
            )}
          </div>

          <label className="relative mt-3 block shrink-0 text-sm">
            <span className="sr-only">{t("communePicker.filterSrOnly")}</span>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
              <IconSearch />
            </span>
            <input
              type="search"
              className={`${inputClassName} pl-9`}
              placeholder={t("communePicker.filterPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>

          {loading ? (
            <p className="mt-4 text-base text-ink-600 dark:text-ink-300">
              {t("communePicker.loading")}
            </p>
          ) : errorMessage ? (
            <p className="mt-4 text-sm text-amber-800 dark:text-amber-300">
              {errorMessage}
            </p>
          ) : communes.length === 0 ? (
            <p className="mt-4 text-sm text-ink-600 dark:text-ink-300">
              {t("communePicker.noCommunes")}
            </p>
          ) : (
            <ul
              className="scrollbar-thin mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1"
              role="listbox"
              aria-label={t("communePicker.listAria")}
            >
              {filtered.map((loc) => {
                const selected = loc.code_commune === selectedCodeCommune;
                return (
                  <li key={loc.location_id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`w-full rounded-xl px-4 py-3 text-left text-base transition ${
                        selected
                          ? "bg-ink-100 font-bold text-ink-900 shadow-sm dark:bg-ink-700 dark:text-ink-50"
                          : "text-ink-900 hover:bg-ink-50 dark:text-ink-100 dark:hover:bg-ink-800/70"
                      }`}
                      onClick={() => onSelect(loc)}
                    >
                      <span
                        className={
                          selected
                            ? "font-bold text-ink-900 dark:text-ink-50"
                            : "font-medium"
                        }
                      >
                        {loc.nom_commune ?? t("common.emDash")}
                      </span>{" "}
                      <span
                        className={
                          selected
                            ? "font-bold text-ink-900 dark:text-ink-50"
                            : "text-ink-500 dark:text-ink-400"
                        }
                      >
                        ({communePostalCode(loc)})
                      </span>
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className="px-2 py-2 text-sm text-ink-600 dark:text-ink-300">
                  {t("communePicker.noMatch")}
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}
