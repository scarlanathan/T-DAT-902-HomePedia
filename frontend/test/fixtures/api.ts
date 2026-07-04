import type {
  CityEquipmentSummaryRow,
  CityHousingSummaryRow,
  CitySocialSummaryRow,
  LocationRow,
  OpportunityScoreRow,
  TransactionRow,
  TransactionSummary,
} from "@/api";

export const fixtureLocation: LocationRow = {
  location_id: "loc-1",
  code_commune: "75101",
  nom_commune: "Paris",
  code_postal: "75001",
  code_departement: "75",
  code_region: "11",
  type_commune: "COM",
  code_commune_parent: null,
  cog_millesime: 2024,
};

export const fixtureSummary: TransactionSummary = {
  transaction_count: "2",
  min_date_mutation: "2020-07-01T00:00:00.000Z",
  max_date_mutation: "2021-03-15T00:00:00.000Z",
  median_valeur_fonciere: "450000",
  median_price_per_sqm_built: "10000",
};

export const fixtureHousingRow: CityHousingSummaryRow = {
  code_commune: "75101",
  nom_commune: "Paris",
  period_month: "2020-03-01T00:00:00.000Z",
  sale_line_count: "1",
  median_valeur_fonciere: null,
  median_price_per_sqm_built: "8000",
};

export const fixtureEquipmentSummary: CityEquipmentSummaryRow = {
  code_commune: "75101",
  nom_commune: "Paris",
  bpe_millesime: 2024,
  equipment_total_count: "12",
  education_count: "4",
  health_count: "2",
  commerce_count: "3",
  sport_count: "2",
  other_count: "1",
};

export const fixtureSocialSummary: CitySocialSummaryRow = {
  code_commune: "75101",
  nom_commune: "Paris",
  filosofi_millesime: 2021,
  median_income_eur: "32000",
  poverty_rate: "14.2",
  inequality_ratio: "3.1",
  caf_beneficiary_share: "6.5",
  housing_aid_share: "2.1",
  income_d1_eur: "11000",
  income_d9_eur: "62000",
};

export const fixtureOpportunityScore: OpportunityScoreRow = {
  code_commune: "75101",
  nom_commune: "Paris",
  period_month: "2020-03-01T00:00:00.000Z",
  sale_line_count: "1",
  median_valeur_fonciere: "450000",
  price_median_per_sqm: "10000",
  median_income_eur: "32000",
  poverty_rate: "14.2",
  qpv_share: null,
  equipment_density: "0.7",
  transit_accessibility: null,
  safety_index: null,
  assumed_interest_rate: "0.035",
  assumed_term_months: 240,
  assumed_max_dti: "0.35",
  borrowing_capacity_eur: null,
  price_to_capacity_ratio: null,
  price_score: "35",
  social_mix_score: "68",
  quality_of_life_score: "72",
  composite_score: "58.5",
};

export const fixtureTransaction: TransactionRow = {
  transaction_id: "2020-3",
  location_id: "loc-1",
  date_mutation: "2021-03-15T00:00:00.000Z",
  nature_mutation: "Vente",
  valeur_fonciere: "450000",
  surface_reelle_bati: "45",
  price_per_sqm_built: "10000",
  type_local: "Appartement",
  code_type_local: "2",
  code_postal: "75001",
  longitude: 2.3522,
  latitude: 48.8566,
  code_commune: "75101",
  nom_commune: "Paris",
};

export const filtersWithCommune = {
  codeCommune: "75101",
  nomCommune: "Paris",
  from: "2020-01-01",
  to: "2024-12-31",
  typeLocal: "" as const,
};
