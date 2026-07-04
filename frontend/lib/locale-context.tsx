"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type Locale,
  type MessageKey,
  translate,
} from "@/lib/i18n";
import {
  formatEuro,
  formatFrNumber,
  formatMonthLabel,
  formatPercent,
  formatPropertyType,
  formatScore,
} from "@/lib/format";

export const LOCALE_STORAGE_KEY = "homepedia_locale";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === "en" || stored === "fr") return stored;
  return navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en";
}

function applyDocumentLocale(locale: Locale): void {
  document.documentElement.lang = locale;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const initial = readStoredLocale();
    setLocaleState(initial);
    applyDocumentLocale(initial);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(LOCALE_STORAGE_KEY, next);
    applyDocumentLocale(next);
  }, []);

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) =>
      translate(locale, key, vars),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}

/** Locale-aware number/date formatters for components. */
export function useFormat() {
  const { locale } = useLocale();
  return useMemo(
    () => ({
      locale,
      formatFrNumber: (
        n: Parameters<typeof formatFrNumber>[0],
        opts?: Parameters<typeof formatFrNumber>[1],
      ) => formatFrNumber(n, opts, locale),
      formatEuro: (n: Parameters<typeof formatEuro>[0]) => formatEuro(n, locale),
      formatMonthLabel: (iso: string) => formatMonthLabel(iso, locale),
      formatPercent: (
        n: Parameters<typeof formatPercent>[0],
        digits?: number,
      ) => formatPercent(n, digits, locale),
      formatScore: (n: Parameters<typeof formatScore>[0]) =>
        formatScore(n, locale),
      formatPropertyType: (type: string | null | undefined) =>
        formatPropertyType(type, locale),
    }),
    [locale],
  );
}
