import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api";
import { EMPTY_FILTERS } from "@/lib/filters";
import {
  fixtureEquipmentSummary,
  fixtureLocation,
  fixtureOpportunityScore,
  fixtureSocialSummary,
  filtersWithCommune,
} from "@/test/fixtures/api";
import { useDashboardData } from "./use-dashboard-data";

vi.mock("@/api", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  },
  fetchHealth: vi.fn(() =>
    Promise.resolve({ status: "ok" as const, postgres: "up" as const }),
  ),
  fetchLocation: vi.fn(() => Promise.resolve(fixtureLocation)),
  fetchCityHousingSummary: vi.fn(() => Promise.resolve([])),
  fetchTransactions: vi.fn(() => Promise.resolve([])),
  fetchCityEquipmentSummary: vi.fn(() => Promise.resolve([fixtureEquipmentSummary])),
  fetchCitySocialSummary: vi.fn(() => Promise.resolve([fixtureSocialSummary])),
  fetchIrisSocialSummary: vi.fn(() => Promise.resolve([])),
  fetchOpportunityScore: vi.fn(() => Promise.resolve([fixtureOpportunityScore])),
}));

describe("useDashboardData", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads health only when no commune is selected", async () => {
    const api = await import("@/api");
    const { result } = renderHook(() => useDashboardData(EMPTY_FILTERS));

    await waitFor(() => {
      expect(result.current.state.loading).toBe(false);
    });

    expect(api.fetchHealth).toHaveBeenCalled();
    expect(api.fetchLocation).not.toHaveBeenCalled();
    expect(api.fetchCityEquipmentSummary).not.toHaveBeenCalled();
    expect(result.current.data.location).toBeNull();
    expect(result.current.data.equipmentSummary).toBeNull();
    expect(result.current.data.health).toEqual({ status: "ok", postgres: "up" });
  });

  it("loads full dashboard when commune is selected", async () => {
    const api = await import("@/api");
    const { result } = renderHook(() => useDashboardData(filtersWithCommune));

    await waitFor(() => {
      expect(result.current.state.loading).toBe(false);
    });

    expect(result.current.state.error).toBeNull();
    expect(result.current.data.location).toEqual(fixtureLocation);
    expect(result.current.data.equipmentSummary).toEqual(fixtureEquipmentSummary);
    expect(result.current.data.socialSummary).toEqual(fixtureSocialSummary);
    expect(result.current.data.opportunityScore).toEqual(fixtureOpportunityScore);
    expect(api.fetchLocation).toHaveBeenCalledWith("75101");
    expect(api.fetchCityEquipmentSummary).toHaveBeenCalledWith({
      code_commune: "75101",
      limit: 1,
    });
    expect(api.fetchCitySocialSummary).toHaveBeenCalledWith({
      code_commune: "75101",
      limit: 1,
    });
    expect(api.fetchIrisSocialSummary).toHaveBeenCalledWith({
      code_commune: "75101",
      limit: 50,
    });
    expect(result.current.data.irisSocialSummary).toEqual([]);
    expect(api.fetchOpportunityScore).toHaveBeenCalledWith({
      code_commune: "75101",
      from: "2020-01-01",
      to: "2024-12-31",
      limit: 1,
    });
  });

  it("does not refetch when only typeLocal changes", async () => {
    const api = await import("@/api");
    const { result, rerender } = renderHook(
      (filters) => useDashboardData(filters),
      { initialProps: filtersWithCommune },
    );

    await waitFor(() => expect(result.current.state.loading).toBe(false));
    vi.mocked(api.fetchLocation).mockClear();
    vi.mocked(api.fetchCityEquipmentSummary).mockClear();

    rerender({ ...filtersWithCommune, typeLocal: "Appartement" });

    await waitFor(() => expect(result.current.state.loading).toBe(false));

    expect(api.fetchLocation).not.toHaveBeenCalled();
    expect(api.fetchCityEquipmentSummary).not.toHaveBeenCalled();
  });

  it("tolerates health check failure", async () => {
    const api = await import("@/api");
    vi.mocked(api.fetchHealth).mockRejectedValueOnce(new Error("down"));

    const { result } = renderHook(() => useDashboardData(filtersWithCommune));

    await waitFor(() => expect(result.current.state.loading).toBe(false));

    expect(result.current.data.health).toBeNull();
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.apiReachable).toBe(false);
    expect(result.current.data.location).toEqual(fixtureLocation);
  });

  it("sets error state when location fetch fails", async () => {
    const api = await import("@/api");
    vi.mocked(api.fetchLocation).mockRejectedValueOnce(
      new ApiError("Not found (/locations/99999)", 404),
    );

    const { result } = renderHook(() =>
      useDashboardData({ ...filtersWithCommune, codeCommune: "99999" }),
    );

    await waitFor(() => expect(result.current.state.loading).toBe(false));

    expect(result.current.state.error).toContain("Not found");
    expect(result.current.data.location).toBeNull();
    expect(result.current.state.apiReachable).toBe(true);
  });

  it("marks network errors as unreachable", async () => {
    const api = await import("@/api");
    vi.mocked(api.fetchLocation).mockRejectedValueOnce(
      new TypeError("Failed to fetch"),
    );

    const { result } = renderHook(() => useDashboardData(filtersWithCommune));

    await waitFor(() => expect(result.current.state.loading).toBe(false));

    expect(result.current.state.apiReachable).toBe(false);
    expect(result.current.state.error).toContain("Failed to fetch");
  });

  it("stores iris social rows when returned", async () => {
    const api = await import("@/api");
    vi.mocked(api.fetchIrisSocialSummary).mockResolvedValueOnce([
      {
        code_iris: "751010101",
        code_commune: "75101",
        nom_commune: "Paris",
        nom_iris: "Quartier 1",
        filosofi_millesime: 2021,
        median_income_eur: "30000",
        poverty_rate: "10",
        inequality_ratio: "3",
        caf_beneficiary_share: "5",
      },
    ]);

    const { result } = renderHook(() => useDashboardData(filtersWithCommune));

    await waitFor(() => expect(result.current.state.loading).toBe(false));

    expect(result.current.data.irisSocialSummary).toHaveLength(1);
    expect(result.current.data.irisSocialSummary[0].code_iris).toBe("751010101");
  });

  it("reload refetches data", async () => {
    const api = await import("@/api");
    const { result } = renderHook(() => useDashboardData(filtersWithCommune));

    await waitFor(() => expect(result.current.state.loading).toBe(false));
    vi.mocked(api.fetchLocation).mockClear();

    await act(async () => {
      await result.current.reload();
    });

    expect(api.fetchLocation).toHaveBeenCalled();
  });
});
