"use client";

import { useLocale } from "@/lib/locale-context";
import type { Locale } from "@/lib/i18n";

type Props = {
  className?: string;
};

export function LanguageToggle({ className = "" }: Props) {
  const { locale, setLocale, t } = useLocale();

  function select(next: Locale) {
    if (next !== locale) setLocale(next);
  }

  return (
    <div
      className={`inline-flex rounded-xl border border-ink-200/90 bg-white p-0.5 text-xs font-semibold shadow-sm dark:border-ink-700/80 dark:bg-ink-800/80 ${className}`}
      role="group"
      aria-label={locale === "en" ? t("language.switchToFr") : t("language.switchToEn")}
    >
      <button
        type="button"
        onClick={() => select("en")}
        aria-pressed={locale === "en"}
        className={`flex-1 rounded-lg px-2.5 py-1.5 transition ${
          locale === "en"
            ? "bg-brand-600 text-white shadow-sm"
            : "text-ink-600 hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-ink-700/80"
        }`}
      >
        {t("language.en")}
      </button>
      <button
        type="button"
        onClick={() => select("fr")}
        aria-pressed={locale === "fr"}
        className={`flex-1 rounded-lg px-2.5 py-1.5 transition ${
          locale === "fr"
            ? "bg-brand-600 text-white shadow-sm"
            : "text-ink-600 hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-ink-700/80"
        }`}
      >
        {t("language.fr")}
      </button>
    </div>
  );
}
