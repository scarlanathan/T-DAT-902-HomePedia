"use client";

import type { ReactNode } from "react";
import type { HealthResponse } from "@/api";
import { useLocale } from "@/lib/locale-context";

type Props = {
  health: HealthResponse | null;
  apiReachable: boolean;
  error: string | null;
  loading: boolean;
};

function StatusCard({
  tone,
  title,
  children,
  alert,
}: {
  tone: "error" | "warning";
  title: string;
  children: ReactNode;
  alert?: boolean;
}) {
  const tones = {
    error:
      "border-rose-200/90 bg-rose-50/90 text-rose-950 ring-rose-500/15 dark:border-rose-900/80 dark:bg-rose-950/50 dark:text-rose-100 dark:ring-rose-500/25",
    warning:
      "border-amber-200/90 bg-amber-50/90 text-amber-950 ring-amber-500/15 dark:border-amber-900/80 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-500/25",
  };

  return (
    <div
      role={alert ? "alert" : undefined}
      className={`animate-fade-in rounded-2xl border px-5 py-4 text-base shadow-card ring-1 ${tones[tone]}`}
    >
      <p className="font-semibold">{title}</p>
      <div className="mt-1.5 leading-relaxed opacity-90">{children}</div>
    </div>
  );
}

export function ApiStatusBanner({ health, apiReachable, error, loading }: Props) {
  const { t } = useLocale();

  if (loading) return null;

  if (error) {
    return (
      <StatusCard tone="error" title={t("apiStatus.apiError")} alert>
        <p>{error}</p>
        {!apiReachable && (
          <p className="mt-2 text-xs">{t("apiStatus.startBackend")}</p>
        )}
      </StatusCard>
    );
  }

  if (!health) {
    return (
      <StatusCard tone="warning" title={t("apiStatus.limitedConnectivity")}>
        {t("apiStatus.healthUnavailable")}
      </StatusCard>
    );
  }

  if (health.postgres === "down") {
    return (
      <StatusCard tone="warning" title={t("apiStatus.databaseOffline")} alert>
        {t("apiStatus.postgresDown")}
      </StatusCard>
    );
  }

  return null;
}
