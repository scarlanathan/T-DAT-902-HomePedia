import type { SearchPreferences } from "@/api";

export const DEFAULT_PREFERENCES: SearchPreferences = {
  incomeMonthlyEur: null,
  downPaymentEur: null,
  maxDti: 0.35,
  termYears: 20,
  propertyType: "",
  weights: { price: 0.5, social: 0.25, quality: 0.25 },
};

/**
 * Personal borrowing capacity = affordable loan principal + down payment.
 * Uses the annuity formula with a monthly rate; `annualRate` is a fraction
 * (e.g. 0.031). Returns null when the user's income is unknown.
 */
export function personalBorrowingCapacity(
  prefs: SearchPreferences,
  annualRate: number,
): number | null {
  if (prefs.incomeMonthlyEur == null || prefs.incomeMonthlyEur <= 0) return null;
  const payment = prefs.incomeMonthlyEur * prefs.maxDti;
  const n = prefs.termYears * 12;
  const r = annualRate / 12;
  const principal =
    r > 0 ? (payment * (1 - Math.pow(1 + r, -n))) / r : payment * n;
  return principal + (prefs.downPaymentEur ?? 0);
}

/** Recompute a 0-100 composite from the three sub-scores using user weights. */
export function weightedComposite(
  scores: {
    price: number | null;
    social: number | null;
    quality: number | null;
  },
  weights: SearchPreferences["weights"],
): number | null {
  let num = 0;
  let den = 0;
  if (scores.price != null) {
    num += scores.price * weights.price;
    den += weights.price;
  }
  if (scores.social != null) {
    num += scores.social * weights.social;
    den += weights.social;
  }
  if (scores.quality != null) {
    num += scores.quality * weights.quality;
    den += weights.quality;
  }
  return den > 0 ? num / den : null;
}

/** Normalise three raw weight values (e.g. slider 0-100) so they sum to 1. */
export function normaliseWeights(raw: {
  price: number;
  social: number;
  quality: number;
}): SearchPreferences["weights"] {
  const sum = raw.price + raw.social + raw.quality;
  if (sum <= 0) return { price: 1 / 3, social: 1 / 3, quality: 1 / 3 };
  return {
    price: raw.price / sum,
    social: raw.social / sum,
    quality: raw.quality / sum,
  };
}
