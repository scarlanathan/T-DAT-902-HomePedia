"use client";

import { useTheme, type Theme } from "@/lib/theme-context";
import { useLocale } from "@/lib/locale-context";

type Props = {
  className?: string;
};

export function ThemeToggle({ className = "" }: Props) {
  const { theme, setTheme } = useTheme();
  const { t } = useLocale();

  function select(next: Theme) {
    if (next !== theme) setTheme(next);
  }

  return (
    <div
      className={`inline-flex rounded-xl border border-ink-200/90 bg-white p-0.5 text-xs font-semibold shadow-sm dark:border-ink-700/80 dark:bg-ink-800/80 ${className}`}
      role="group"
      aria-label={
        theme === "dark" ? t("theme.switchToLight") : t("theme.switchToDark")
      }
    >
      <button
        type="button"
        onClick={() => select("light")}
        aria-pressed={theme === "light"}
        className={`flex-1 rounded-lg px-2.5 py-1.5 transition ${
          theme === "light"
            ? "bg-brand-600 text-white shadow-sm"
            : "text-ink-600 hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-ink-700/80"
        }`}
      >
        {t("theme.light")}
      </button>
      <button
        type="button"
        onClick={() => select("dark")}
        aria-pressed={theme === "dark"}
        className={`flex-1 rounded-lg px-2.5 py-1.5 transition ${
          theme === "dark"
            ? "bg-brand-600 text-white shadow-sm"
            : "text-ink-600 hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-ink-700/80"
        }`}
      >
        {t("theme.dark")}
      </button>
    </div>
  );
}
