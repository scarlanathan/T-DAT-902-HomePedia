import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  useForecastMap,
  useForecastModel,
  useForecastRanking,
  useForecastSeries,
} from "./use-forecast";

vi.mock("@/api", async () => {
  const client = await vi.importActual<typeof import("@/api/client")>("@/api/client");
  return {
    ApiError: client.ApiError,
    fetchForecastModel: vi.fn(() =>
      Promise.resolve({ model: null, scenarios: [], backtest: [] }),
    ),
    fetchForecastSeries: vi.fn(() =>
      Promise.resolve({
        level: "france",
        code: "FR",
        nom: "France",
        property_type: "all",
        history: [],
        forecast: [],
        summary: [],
        fallback: null,
      }),
    ),
    fetchForecastMap: vi.fn(() => Promise.resolve([{ code: "69" }])),
    fetchForecastRanking: vi.fn(() => Promise.resolve([{ code: "69123" }])),
    listRegions: vi.fn(() => Promise.resolve([])),
    listDepartments: vi.fn(() => Promise.resolve([])),
  };
});

describe("forecast hooks", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads the model (null model = not trained yet)", async () => {
    const { result } = renderHook(() => useForecastModel());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ model: null, scenarios: [], backtest: [] });
    expect(result.current.error).toBeNull();
  });

  it("fetches France without a code", async () => {
    const api = await import("@/api");
    const { result } = renderHook(() =>
      useForecastSeries({ level: "france", propertyType: "all" }),
    );
    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(api.fetchForecastSeries).toHaveBeenCalledWith({
      level: "france",
      code: undefined,
      property_type: "all",
    });
  });

  it("does not fetch a commune series until a code is chosen", async () => {
    const api = await import("@/api");
    const { result } = renderHook(() =>
      useForecastSeries({ level: "commune", code: null, propertyType: "maison" }),
    );
    expect(result.current.loading).toBe(false);
    expect(api.fetchForecastSeries).not.toHaveBeenCalled();
  });

  it("reports a 404 as notFound rather than an error", async () => {
    const api = await import("@/api");
    vi.mocked(api.fetchForecastSeries).mockRejectedValueOnce(
      new api.ApiError("Not found", 404),
    );
    const { result } = renderHook(() =>
      useForecastSeries({ level: "commune", code: "99999", propertyType: "all" }),
    );
    await waitFor(() => expect(result.current.notFound).toBe(true));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("sets an i18n error key when the series request fails", async () => {
    const api = await import("@/api");
    vi.mocked(api.fetchForecastSeries).mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() =>
      useForecastSeries({ level: "departement", code: "69", propertyType: "all" }),
    );
    await waitFor(() => expect(result.current.error).toBe("forecast.errors.series"));
    expect(result.current.loading).toBe(false);
  });

  it("loads the department map with scenario and horizon", async () => {
    const api = await import("@/api");
    const { result } = renderHook(() =>
      useForecastMap({ scenario: "pessimiste", propertyType: "appartement", horizon: 8 }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toHaveLength(1);
    expect(api.fetchForecastMap).toHaveBeenCalledWith({
      level: "departement",
      scenario: "pessimiste",
      property_type: "appartement",
      horizon: 8,
    });
  });

  it("filters the commune ranking by department, not the department ranking", async () => {
    const api = await import("@/api");
    const { result, rerender } = renderHook(
      (props: { level: "commune" | "departement" }) =>
        useForecastRanking({
          level: props.level,
          scenario: "central",
          propertyType: "all",
          horizon: 4,
          order: "asc",
          codeDepartement: "69",
        }),
      { initialProps: { level: "commune" } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(api.fetchForecastRanking).toHaveBeenLastCalledWith(
      expect.objectContaining({
        level: "commune",
        order: "asc",
        limit: 10,
        code_departement: "69",
      }),
    );

    rerender({ level: "departement" });
    await waitFor(() =>
      expect(api.fetchForecastRanking).toHaveBeenLastCalledWith(
        expect.objectContaining({ level: "departement", code_departement: undefined }),
      ),
    );
  });

  it("sets an error key when the ranking fails", async () => {
    const api = await import("@/api");
    vi.mocked(api.fetchForecastRanking).mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() =>
      useForecastRanking({
        level: "commune",
        scenario: "central",
        propertyType: "all",
        horizon: 4,
        order: "desc",
      }),
    );
    await waitFor(() => expect(result.current.error).toBe("forecast.errors.ranking"));
    expect(result.current.data).toEqual([]);
  });
});
