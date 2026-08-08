"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { usePreferencesModal } from "@/lib/preferences-modal-context";
import { DEFAULT_PREFERENCES, normaliseWeights } from "@/lib/preferences";
import type { SearchPreferences } from "@/api";

const TERM_OPTIONS = [10, 15, 20, 25, 30];

function toNum(v: string): number | null {
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * First-login onboarding: capture the user's housing-search profile (borrowing
 * inputs + what matters to them). Persisted to the profile and reused across
 * the app (personal borrowing capacity, score weighting). Also reopenable via a
 * floating "my preferences" button once onboarded.
 */
export function OnboardingModal() {
  const { user, savePreferences } = useAuth();
  const { t } = useLocale();
  const { open: manualOpen, openPreferences, closePreferences } =
    usePreferencesModal();
  const [dismissed, setDismissed] = useState(false);
  const [saving, setSaving] = useState(false);

  const initial = user?.preferences ?? DEFAULT_PREFERENCES;
  const [income, setIncome] = useState(
    initial.incomeMonthlyEur != null ? String(initial.incomeMonthlyEur) : "",
  );
  const [downPayment, setDownPayment] = useState(
    initial.downPaymentEur != null ? String(initial.downPaymentEur) : "",
  );
  const [maxDti, setMaxDti] = useState(initial.maxDti);
  const [termYears, setTermYears] = useState(initial.termYears);
  const [propertyType, setPropertyType] = useState<SearchPreferences["propertyType"]>(
    initial.propertyType,
  );
  const [wPrice, setWPrice] = useState(Math.round(initial.weights.price * 100));
  const [wSocial, setWSocial] = useState(Math.round(initial.weights.social * 100));
  const [wQuality, setWQuality] = useState(Math.round(initial.weights.quality * 100));

  if (!user) return null;

  const open = manualOpen || (!user.onboarded && !dismissed);

  const onSave = async () => {
    setSaving(true);
    const prefs: SearchPreferences = {
      incomeMonthlyEur: toNum(income),
      downPaymentEur: toNum(downPayment),
      maxDti,
      termYears,
      propertyType,
      weights: normaliseWeights({ price: wPrice, social: wSocial, quality: wQuality }),
    };
    await savePreferences(prefs);
    setSaving(false);
    closePreferences();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={openPreferences}
        className="fixed bottom-5 left-5 z-40 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-elevated ring-1 ring-brand-500/25 transition hover:bg-brand-50 dark:bg-ink-900 dark:text-brand-300 dark:ring-brand-400/30 dark:hover:bg-ink-800"
      >
        ⚙︎ {t("onboarding.editButton")}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-[1px]" />
      <div className="relative m-3 w-full max-w-lg overflow-y-auto rounded-2xl border border-ink-200/70 bg-white p-6 shadow-elevated ring-1 ring-ink-200/50 dark:border-ink-700/70 dark:bg-ink-900 dark:ring-ink-700/50 max-h-[90vh]">
        <h2 className="font-display text-xl font-bold tracking-tight text-ink-900 dark:text-ink-100">
          {t("onboarding.title")}
        </h2>
        <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
          {t("onboarding.subtitle")}
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("onboarding.incomeLabel")}>
            <input
              inputMode="numeric"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              placeholder={t("onboarding.incomePlaceholder")}
              className={inputCls}
            />
          </Field>
          <Field label={t("onboarding.downPaymentLabel")}>
            <input
              inputMode="numeric"
              value={downPayment}
              onChange={(e) => setDownPayment(e.target.value)}
              placeholder={t("onboarding.downPaymentPlaceholder")}
              className={inputCls}
            />
          </Field>
          <Field label={`${t("onboarding.dtiLabel")} — ${Math.round(maxDti * 100)}%`}>
            <input
              type="range"
              min={10}
              max={45}
              value={Math.round(maxDti * 100)}
              onChange={(e) => setMaxDti(Number(e.target.value) / 100)}
              className="w-full accent-brand-600"
            />
          </Field>
          <Field label={t("onboarding.termLabel")}>
            <select
              value={termYears}
              onChange={(e) => setTermYears(Number(e.target.value))}
              className={inputCls}
            >
              {TERM_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </Field>
          <Field label={t("onboarding.propertyTypeLabel")}>
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value as SearchPreferences["propertyType"])}
              className={inputCls}
            >
              <option value="">{t("onboarding.propertyAny")}</option>
              <option value="Appartement">{t("propertyType.Appartement")}</option>
              <option value="Maison">{t("propertyType.Maison")}</option>
            </select>
          </Field>
        </div>

        <p className="mt-5 text-sm font-semibold text-ink-700 dark:text-ink-200">
          {t("onboarding.weightsLabel")}
        </p>
        <div className="mt-2 space-y-2">
          <Weight label={t("onboarding.weightPrice")} value={wPrice} onChange={setWPrice} />
          <Weight label={t("onboarding.weightSocial")} value={wSocial} onChange={setWSocial} />
          <Weight label={t("onboarding.weightQuality")} value={wQuality} onChange={setWQuality} />
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => (manualOpen ? closePreferences() : setDismissed(true))}
            className="rounded-lg px-3 py-2 text-sm font-medium text-ink-500 transition hover:text-ink-800 dark:hover:text-ink-200"
          >
            {t("onboarding.skip")}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? t("onboarding.saving") : t("onboarding.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none ring-brand-500/30 transition focus:ring-2 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-ink-600 dark:text-ink-300">{label}</span>
      {children}
    </label>
  );
}

function Weight({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 text-ink-600 dark:text-ink-300">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand-600"
      />
      <span className="w-9 shrink-0 text-right tabular-nums text-ink-500">{value}</span>
    </label>
  );
}
