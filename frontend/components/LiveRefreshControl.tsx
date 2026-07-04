"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/locale-context";

const REFRESH_MS = 30_000;

type Props = {
  /** Refetch callback (dashboard data reload). */
  onRefresh: () => void | Promise<void>;
};

/**
 * Opt-in near-real-time refresh: when enabled, polls the API every 30s so the
 * selected commune's indicators stay current without a manual reload (HOM-66).
 * Data is batch upstream, so this is an auto-refresh rather than a live stream.
 */
export function LiveRefreshControl({ onRefresh }: Props) {
  const { t } = useLocale();
  const [on, setOn] = useState(false);
  const [secondsAgo, setSecondsAgo] = useState<number | null>(null);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!on) {
      setSecondsAgo(null);
      return;
    }
    let elapsed = 0;
    setSecondsAgo(0);
    const tick = window.setInterval(() => {
      elapsed += 1;
      setSecondsAgo(elapsed);
      if (elapsed % (REFRESH_MS / 1000) === 0) {
        void onRefreshRef.current();
        elapsed = 0;
        setSecondsAgo(0);
      }
    }, 1000);
    return () => window.clearInterval(tick);
  }, [on]);

  const label =
    on && secondsAgo != null
      ? secondsAgo < 3
        ? t("live.justNow")
        : t("live.updated", { seconds: secondsAgo })
      : t("live.hint");

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn((v) => !v)}
        title={t("live.hint")}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
          on
            ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300"
            : "bg-ink-50 text-ink-600 ring-ink-200/80 dark:bg-ink-800/50 dark:text-ink-300 dark:ring-ink-700/70"
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            on ? "animate-pulse bg-emerald-500" : "bg-ink-400"
          }`}
          aria-hidden
        />
        {t("live.on")}
      </button>
      <span className="text-xs text-ink-500 dark:text-ink-400" aria-live="polite">
        {label}
      </span>
    </div>
  );
}
