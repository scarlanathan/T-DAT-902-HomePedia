"use client";

import { THEMES } from "@/lib/themes";
import { useLocale } from "@/lib/locale-context";

type Props = {
  /** Called with a commune INSEE code when the user picks a thematic shortcut. */
  onPick: (codeCommune: string) => void;
};

/**
 * Horizontal, scrollable carousel of thematic commune shortcuts (seaside,
 * mountains, major cities, student cities, overseas). A discovery entry point
 * for users who don't know which commune to look up.
 */
export function ThematicCarousel({ onPick }: Props) {
  const { t } = useLocale();

  return (
    <section
      data-tour="themes"
      aria-label={t("themes.title")}
      className="rounded-2xl border border-ink-200/70 bg-white/70 p-4 shadow-card ring-1 ring-ink-200/40 backdrop-blur-sm dark:border-ink-700/70 dark:bg-ink-900/50 dark:ring-ink-700/40"
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink-900 dark:text-ink-100">
          {t("themes.title")}
        </h2>
        <p className="hidden truncate text-sm text-ink-500 dark:text-ink-400 sm:block">
          {t("themes.subtitle")}
        </p>
      </div>

      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
        {THEMES.map((theme) => (
          <div
            key={theme.id}
            className="w-60 shrink-0 snap-start rounded-xl border border-ink-200/70 bg-ink-50/70 p-3 dark:border-ink-700/60 dark:bg-ink-800/40"
          >
            <div className="flex items-center gap-2">
              <span aria-hidden className="text-xl leading-none">
                {theme.emoji}
              </span>
              <h3 className="truncate font-semibold text-ink-800 dark:text-ink-200">
                {t(theme.labelKey)}
              </h3>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {theme.communes.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => onPick(c.code)}
                  className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-ink-700 ring-1 ring-ink-200/80 transition hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-300 dark:bg-ink-900/60 dark:text-ink-200 dark:ring-ink-700/70 dark:hover:bg-brand-950/40 dark:hover:text-brand-300"
                >
                  {c.nom}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
