"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { fetchLocation, type LocationRow } from "@/api";
import { useAuth } from "@/lib/auth-context";
import { ApiStatusBanner } from "@/components/ApiStatusBanner";
import { AppViewNav } from "@/components/AppViewNav";
import { AffordabilityCard } from "@/components/AffordabilityCard";
import { GuidedTour } from "@/components/GuidedTour";
import { LiveRefreshControl } from "@/components/LiveRefreshControl";
import { ThematicCarousel } from "@/components/ThematicCarousel";
import { CommunePicker } from "@/components/CommunePicker";
import { CommuneSearch } from "@/components/CommuneSearch";
import { EquipmentStatCards } from "@/components/EquipmentStatCards";
import { OpportunityScoreCards } from "@/components/OpportunityScoreCards";
import { PriceTrendChart } from "@/components/PriceTrendChart";
import { SocialStatCards } from "@/components/SocialStatCards";
import { StatCards } from "@/components/StatCards";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { IconChart } from "@/components/ui/icons";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useDvfSummary } from "@/hooks/use-dvf-summary";
import { useDepartmentCommunes } from "@/hooks/use-department-communes";
import { EMPTY_FILTERS, hasCommuneSelected, type DashboardFilters } from "@/lib/filters";
import { APP_PAGE_SHELL_CLASS } from "@/lib/page-layout";
import { MAP_PANEL_HEIGHT_CLASS, METRICS_MAP_PANEL_HEIGHT_CLASS } from "@/lib/map-layout";
import { useLocale } from "@/lib/locale-context";

const FranceMap = dynamic(() => import("./FranceMap").then((m) => m.FranceMap), {
  ssr: false,
  loading: () => (
    <div
      className={`${METRICS_MAP_PANEL_HEIGHT_CLASS} animate-pulse rounded-2xl bg-gradient-to-br from-ink-100 to-ink-50 ring-1 ring-ink-200/60 dark:from-ink-800 dark:to-ink-900 dark:ring-ink-700/50`}
    />
  ),
});

export function HomeDashboard() {
  const { t } = useLocale();
  const [filters, setFilters] = useState<DashboardFilters>(EMPTY_FILTERS);
  const [focusedDepartment, setFocusedDepartment] = useState<string | undefined>();
  const { user } = useAuth();
  const { data, state, reload } = useDashboardData(filters);
  const dvf = useDvfSummary(filters);
  const communeSelected = hasCommuneSelected(filters);

  // Pre-fill the property-type filter from the user's saved search preferences.
  const preferredType = user?.preferences?.propertyType;
  useEffect(() => {
    if (preferredType) {
      setFilters((prev) => (prev.typeLocal ? prev : { ...prev, typeLocal: preferredType }));
    }
  }, [preferredType]);

  const activeDepartment =
    focusedDepartment ??
    (communeSelected ? data.location?.code_departement : undefined);

  const {
    communes: departmentCommunes,
    loading: communesLoading,
    error: communesError,
  } = useDepartmentCommunes(activeDepartment);

  const onCommuneSelect = (loc: LocationRow) => {
    setFilters((prev) => ({
      ...prev,
      codeCommune: loc.code_commune,
      nomCommune: loc.nom_commune ?? loc.code_commune,
      codePostal: loc.code_postal ?? "",
    }));
    if (loc.code_departement) setFocusedDepartment(loc.code_departement);
  };

  const onCommuneClear = () => {
    setFilters((prev) => ({ ...prev, codeCommune: "", nomCommune: "", codePostal: "" }));
    setFocusedDepartment(undefined);
  };

  const onPickTheme = async (code: string) => {
    try {
      const loc = await fetchLocation(code);
      onCommuneSelect(loc);
    } catch {
      // Ignore unknown/unavailable commune codes.
    }
  };

  return (
    <main className={`${APP_PAGE_SHELL_CLASS} space-y-6 px-4 py-6 sm:px-6 lg:py-8`}>
      <AppViewNav />

      <ApiStatusBanner
        health={data.health}
        apiReachable={state.apiReachable}
        error={state.error}
        loading={state.loading}
      />

      {!communeSelected ? (
        <div className="animate-slide-up">
          <ThematicCarousel onPick={onPickTheme} />
        </div>
      ) : null}

      <section className="animate-slide-up">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:grid-rows-[auto_auto] lg:gap-x-8 lg:gap-y-4">
          <div data-tour="search" className="lg:col-start-1 lg:row-start-1">
            <CommuneSearch
              codeCommune={filters.codeCommune}
              nomCommune={filters.nomCommune}
              codePostal={filters.codePostal}
              onSelect={onCommuneSelect}
              onClear={onCommuneClear}
            />
          </div>

          <div data-tour="map" className="lg:col-start-1 lg:row-start-2 min-h-0">
            <FranceMap
              from={filters.from || undefined}
              to={filters.to || undefined}
              selectedCommune={filters.codeCommune || undefined}
              focusedDepartment={activeDepartment}
              departmentCommunes={departmentCommunes}
              onDepartmentFocus={setFocusedDepartment}
              onCommuneSelect={onCommuneSelect}
              panelClassName={METRICS_MAP_PANEL_HEIGHT_CLASS}
            />
          </div>

          <aside className="flex lg:col-start-2 lg:row-start-2 lg:self-start">
            <CommunePicker
              codeDepartement={activeDepartment}
              communes={departmentCommunes}
              loading={communesLoading}
              error={communesError}
              selectedCodeCommune={filters.codeCommune || undefined}
              onSelect={onCommuneSelect}
              panelClassName={METRICS_MAP_PANEL_HEIGHT_CLASS}
            />
          </aside>
        </div>
      </section>

      {communeSelected ? (
        <>
          <div className="flex justify-end">
            <LiveRefreshControl onRefresh={reload} />
          </div>
          <div className="animate-slide-up grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCards
              summary={dvf.summary}
              loading={dvf.loading}
              typeLocal={filters.typeLocal}
              onTypeLocalChange={(typeLocal) =>
                setFilters((prev) => ({ ...prev, typeLocal }))
              }
            />
            <SocialStatCards
              row={data.socialSummary}
              irisCount={data.irisSocialSummary.length}
              loading={state.loading}
            />
            <EquipmentStatCards row={data.equipmentSummary} loading={state.loading} />
            <OpportunityScoreCards
              row={data.opportunityScore}
              loading={state.loading}
              weights={user?.preferences?.weights}
            />
            <AffordabilityCard
              row={data.opportunityScore}
              loading={state.loading}
              preferences={user?.preferences}
            />
          </div>

          <section className="animate-slide-up space-y-5">
            <SectionHeader
              title={t("dashboard.priceHistoryTitle")}
              description={t("dashboard.priceHistoryDescription")}
              sourceInfo={{
                name: t("dashboard.priceHistorySourceName"),
                about: t("dashboard.priceHistorySourceAbout"),
              }}
              icon={<IconChart />}
            />
            <PriceTrendChart rows={data.housingSummary} loading={state.loading} />
          </section>
        </>
      ) : null}

      <GuidedTour />
    </main>
  );
}
