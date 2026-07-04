"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import type { MessageKey } from "@/lib/i18n";

const SEEN_KEY = "homepedia_tour_seen_v1";

const HIGHLIGHT_CLASSES = [
  "ring-2",
  "ring-brand-500",
  "ring-offset-2",
  "ring-offset-white",
  "dark:ring-offset-ink-900",
  "rounded-xl",
  "relative",
  "z-[60]",
];

type Step = {
  selector?: string;
  titleKey: MessageKey;
  bodyKey: MessageKey;
};

const STEPS: Step[] = [
  { titleKey: "tour.welcomeTitle", bodyKey: "tour.welcomeBody" },
  { selector: '[data-tour="search"]', titleKey: "tour.searchTitle", bodyKey: "tour.searchBody" },
  { selector: '[data-tour="themes"]', titleKey: "tour.themesTitle", bodyKey: "tour.themesBody" },
  { selector: '[data-tour="map"]', titleKey: "tour.mapTitle", bodyKey: "tour.mapBody" },
  { selector: '[data-tour="ranking"]', titleKey: "tour.rankingTitle", bodyKey: "tour.rankingBody" },
];

function clearHighlights(): void {
  document
    .querySelectorAll('[data-tour-active="true"]')
    .forEach((el) => {
      el.classList.remove(...HIGHLIGHT_CLASSES);
      el.removeAttribute("data-tour-active");
    });
}

export function GuidedTour() {
  const { t } = useLocale();
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);

  // Auto-start on first visit only.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(SEEN_KEY)) return;
    const id = window.setTimeout(() => {
      setIndex(0);
      setActive(true);
    }, 600);
    return () => window.clearTimeout(id);
  }, []);

  // Highlight the current step's target element.
  useEffect(() => {
    if (!active) return;
    clearHighlights();
    const step = STEPS[index];
    if (!step?.selector) return;
    const el = document.querySelector(step.selector);
    if (!el) return;
    el.classList.add(...HIGHLIGHT_CLASSES);
    el.setAttribute("data-tour-active", "true");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    return () => clearHighlights();
  }, [active, index]);

  const finish = useCallback(() => {
    clearHighlights();
    setActive(false);
    if (typeof window !== "undefined") localStorage.setItem(SEEN_KEY, "1");
  }, []);

  const start = useCallback(() => {
    setIndex(0);
    setActive(true);
  }, []);

  if (!active) {
    return (
      <button
        type="button"
        onClick={start}
        aria-label={t("tour.restart")}
        title={t("tour.restart")}
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white shadow-elevated ring-1 ring-brand-700/40 transition hover:bg-brand-700"
      >
        ?
      </button>
    );
  }

  const step = STEPS[index];
  const isFirst = index === 0;
  const isLast = index === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t("tour.start")}>
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-[1px]" onClick={finish} />

      <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-4">
        <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-ink-200/70 bg-white p-5 shadow-elevated ring-1 ring-ink-200/50 dark:border-ink-700/70 dark:bg-ink-900 dark:ring-ink-700/50">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-lg font-semibold tracking-tight text-ink-900 dark:text-ink-100">
              {t(step.titleKey)}
            </h3>
            <span className="shrink-0 text-xs font-medium text-ink-500 dark:text-ink-400">
              {t("tour.stepOf", { step: index + 1, total: STEPS.length })}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
            {t(step.bodyKey)}
          </p>

          <div className="mt-4 flex items-center justify-between gap-2">
            <div className="flex gap-1.5" aria-hidden>
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index
                      ? "w-5 bg-brand-500"
                      : "w-1.5 bg-ink-200 dark:bg-ink-700"
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              {!isLast ? (
                <button
                  type="button"
                  onClick={finish}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-500 transition hover:text-ink-800 dark:hover:text-ink-200"
                >
                  {t("tour.skip")}
                </button>
              ) : null}
              {!isFirst ? (
                <button
                  type="button"
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-700 ring-1 ring-ink-200 transition hover:bg-ink-50 dark:text-ink-200 dark:ring-ink-700 dark:hover:bg-ink-800"
                >
                  {t("tour.back")}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => (isLast ? finish() : setIndex((i) => i + 1))}
                className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                {isLast ? t("tour.done") : t("tour.next")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
