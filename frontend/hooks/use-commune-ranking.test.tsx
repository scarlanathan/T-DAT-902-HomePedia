import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCommuneRanking } from "./use-commune-ranking";

vi.mock("@/api", () => ({
  fetchCommuneRanking: vi.fn(() =>
    Promise.resolve([
      { code_commune: "75101", nom_commune: "Paris 1er", value: "45000" },
    ]),
  ),
  fetchCommuneRankingCount: vi.fn(() => Promise.resolve({ count: 155 })),
}));

describe("useCommuneRanking", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads rows and total for the current page", async () => {
    const api = await import("@/api");
    const { result } = renderHook(() =>
      useCommuneRanking({ page: 1, pageSize: 50, metric: "median_income_eur" }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.rows).toHaveLength(1);
    expect(result.current.total).toBe(155);
    expect(result.current.totalPages).toBe(4);
    expect(result.current.offset).toBe(0);
    expect(api.fetchCommuneRanking).toHaveBeenCalledWith({
      metric: "median_income_eur",
      order: "desc",
      limit: 50,
      offset: 0,
    });
    expect(api.fetchCommuneRankingCount).toHaveBeenCalledWith({
      metric: "median_income_eur",
    });
  });

  it("uses offset for later pages", async () => {
    const api = await import("@/api");
    const { result } = renderHook(() =>
      useCommuneRanking({ page: 3, pageSize: 100, metric: "composite_score" }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.offset).toBe(200);
    expect(api.fetchCommuneRanking).toHaveBeenCalledWith({
      metric: "composite_score",
      order: "desc",
      limit: 100,
      offset: 200,
    });
  });

  it("sets error state when fetch fails", async () => {
    const api = await import("@/api");
    vi.mocked(api.fetchCommuneRanking).mockRejectedValueOnce(new Error("network"));

    const { result } = renderHook(() =>
      useCommuneRanking({ page: 1, pageSize: 50, metric: "price_median_per_sqm" }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("ranking.loadError");
    expect(result.current.rows).toEqual([]);
    expect(result.current.total).toBe(0);
  });
});
