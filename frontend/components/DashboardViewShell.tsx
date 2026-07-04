"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HomeDashboard } from "@/components/HomeDashboard";
import { OnboardingModal } from "@/components/OnboardingModal";
import { RankingDashboard } from "@/components/RankingDashboard";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";

export function DashboardViewShell() {
  const { user, ready } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const showRanking = pathname === "/ranking";
  const showMetrics = !showRanking;

  const [metricsMounted, setMetricsMounted] = useState(showMetrics);
  const [rankingMounted, setRankingMounted] = useState(showRanking);

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  useEffect(() => {
    if (showMetrics) setMetricsMounted(true);
    if (showRanking) setRankingMounted(true);
  }, [showMetrics, showRanking]);

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-ink-700 dark:text-ink-300">
        {t("common.loading")}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-ink-700 dark:text-ink-300">
        {t("common.redirectingToLogin")}
      </div>
    );
  }

  return (
    <>
      {metricsMounted ? (
        <div className={showMetrics ? undefined : "hidden"} aria-hidden={!showMetrics}>
          <HomeDashboard />
        </div>
      ) : null}
      {rankingMounted ? (
        <div className={showRanking ? undefined : "hidden"} aria-hidden={!showRanking}>
          <RankingDashboard />
        </div>
      ) : null}
      <OnboardingModal />
    </>
  );
}
