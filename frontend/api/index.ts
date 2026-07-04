export { ApiError, apiGet, apiPatch, apiPost, getApiBaseUrl } from "./client";

export type {
  AuthUser,
  CityEquipmentSummaryRow,
  CityHousingSummaryRow,
  CitySocialSummaryRow,
  CommuneRankingRow,
  DepartmentRow,
  EquipmentRow,
  HealthResponse,
  IrisSocialSummaryRow,
  LocationRow,
  MapTransactionPoint,
  OpportunityScoreRow,
  RegionRow,
  SearchPreferences,
  TransactionRow,
  TransactionSummary,
} from "./types";

export { fetchEquipment } from "./equipment";
export { fetchHealth } from "./health";
export {
  fetchDepartment,
  fetchLocation,
  listDepartments,
  listLocations,
  listLocationsByDepartment,
  listAllLocationsByDepartment,
  listRegions,
  resolveLocationForDepartment,
  searchLocations,
} from "./locations";
export {
  fetchCityEquipmentSummary,
  fetchCityHousingSummary,
  fetchCitySocialSummary,
  fetchCitySocialSummaryCount,
  fetchIrisSocialSummary,
  fetchOpportunityScore,
  fetchCommuneRanking,
  fetchCommuneRankingCount,
  fetchTransactionSummary,
} from "./stats";
export { fetchTransactions } from "./transactions";
export { fetchMapTransactions } from "./map";
export {
  fetchCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  saveUserPreferences,
  updateUserSettings,
} from "./auth";
