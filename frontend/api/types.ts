export type HealthResponse = {
  status: "ok" | "degraded";
  postgres: "up" | "down";
};

/** Housing-search preferences captured at onboarding, kept in the user profile. */
export type SearchPreferences = {
  incomeMonthlyEur: number | null;
  downPaymentEur: number | null;
  maxDti: number;
  termYears: number;
  propertyType: "" | "Appartement" | "Maison";
  weights: { price: number; social: number; quality: number };
};

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  locale: "en" | "fr";
  theme: "light" | "dark";
  preferences: SearchPreferences | null;
  onboarded: boolean;
};

export type LocationRow = {
  location_id: string;
  code_commune: string;
  nom_commune: string | null;
  code_departement: string | null;
  code_region?: string | null;
  type_commune?: string | null;
  code_commune_parent?: string | null;
  cog_millesime?: number | null;
  code_postal?: string | null;
};

export type DepartmentRow = {
  departement_id: string;
  code_departement: string;
  nom_departement: string | null;
  code_region: string | null;
  code_commune_cheflieu: string | null;
  cog_millesime: number | null;
};

export type RegionRow = {
  region_id: string;
  code_region: string;
  nom_region: string | null;
  code_commune_cheflieu: string | null;
  cog_millesime: number | null;
};

export type TransactionSummary = {
  transaction_count: string;
  min_date_mutation: string | null;
  max_date_mutation: string | null;
  median_valeur_fonciere: string | null;
  median_price_per_sqm_built: string | null;
};

export type CityHousingSummaryRow = {
  code_commune: string;
  nom_commune: string | null;
  period_month: string;
  sale_line_count: string;
  median_valeur_fonciere: string | null;
  median_price_per_sqm_built: string | null;
};

export type CityEquipmentSummaryRow = {
  code_commune: string;
  nom_commune: string | null;
  bpe_millesime: number | null;
  equipment_total_count: string;
  education_count: string;
  health_count: string;
  commerce_count: string;
  sport_count: string;
  other_count: string;
};

export type CitySocialSummaryRow = {
  code_commune: string;
  nom_commune: string | null;
  filosofi_millesime: number | null;
  median_income_eur: string | null;
  poverty_rate: string | null;
  inequality_ratio: string | null;
  caf_beneficiary_share: string | null;
  housing_aid_share: string | null;
  income_d1_eur: string | null;
  income_d9_eur: string | null;
};

export type CommuneRankingRow = {
  code_commune: string;
  nom_commune: string | null;
  value: string | null;
};

export type IrisSocialSummaryRow = {
  code_iris: string;
  code_commune: string;
  nom_commune: string | null;
  nom_iris: string | null;
  filosofi_millesime: number | null;
  median_income_eur: string | null;
  poverty_rate: string | null;
  inequality_ratio: string | null;
  caf_beneficiary_share: string | null;
};

export type OpportunityScoreRow = {
  code_commune: string;
  nom_commune: string | null;
  period_month: string;
  sale_line_count: string;
  median_valeur_fonciere: string | null;
  price_median_per_sqm: string | null;
  median_income_eur: string | null;
  poverty_rate: string | null;
  csp_diversity_index: string | null;
  qpv_share: string | null;
  equipment_density: string | null;
  transit_accessibility: string | null;
  safety_index: string | null;
  property_tax_rate_pct: string | null;
  assumed_interest_rate: string | null;
  assumed_term_months: number | null;
  assumed_max_dti: string | null;
  borrowing_capacity_eur: string | null;
  price_to_capacity_ratio: string | null;
  price_score: string | null;
  social_mix_score: string | null;
  quality_of_life_score: string | null;
  composite_score: string | null;
};

export type EquipmentRow = {
  equipment_id: string;
  location_id: string;
  code_commune: string;
  code_iris: string | null;
  millesime: number | null;
  typequ: string | null;
  equipment_category: string | null;
  lambert_x: string | null;
  lambert_y: string | null;
  qualite_xy: string | null;
  source_file: string | null;
  ingested_at: string;
  nom_commune?: string | null;
};

export type TransactionRow = {
  transaction_id: string;
  location_id: string;
  date_mutation: string | null;
  nature_mutation: string | null;
  valeur_fonciere: string | null;
  surface_reelle_bati: string | null;
  price_per_sqm_built: string | null;
  type_local: string | null;
  code_type_local: string | null;
  code_postal: string | null;
  longitude: number | null;
  latitude: number | null;
  code_commune?: string;
  nom_commune?: string | null;
};

export type MapTransactionPoint = {
  transaction_id: string;
  date_mutation: string | null;
  valeur_fonciere: string | null;
  price_per_sqm_built: string | null;
  type_local: string | null;
  longitude: number;
  latitude: number;
  code_commune: string | null;
};
