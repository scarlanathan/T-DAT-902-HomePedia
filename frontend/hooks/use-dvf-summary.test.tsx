import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api";
import { EMPTY_FILTERS } from "@/lib/filters";
import { fixtureSummary, filtersWithCommune } from "@/test/fixtures/api";
import { useDvfSummary } from "./use-dvf-summary";

vi.mock("@/api", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  },
  fetchTransactionSummary: vi.fn(() => Promise.resolve(fixtureSummary)),
}));

describe("useDvfSummary", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not fetch when no commune is selected", async () => {
    const api = await import("@/api");
    const { result } = renderHook(() => useDvfSummary(EMPTY_FILTERS));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(api.fetchTransactionSummary).not.toHaveBeenCalled();
    expect(result.current.summary).toBeNull();
  });

  it("loads summary when commune is selected", async () => {
    const api = await import("@/api");
    const { result } = renderHook(() => useDvfSummary(filtersWithCommune));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.summary).toEqual(fixtureSummary);
    expect(api.fetchTransactionSummary).toHaveBeenCalledWith({
      code_commune: "75101",
      from: "2020-01-01",
      to: "2024-12-31",
      type_local: undefined,
    });
  });

  it("passes type_local when filter is set", async () => {
    const api = await import("@/api");
    const { result } = renderHook(() =>
      useDvfSummary({ ...filtersWithCommune, typeLocal: "Appartement" }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(api.fetchTransactionSummary).toHaveBeenCalledWith(
      expect.objectContaining({ type_local: "Appartement" }),
    );
  });

  it("refetches only summary when type changes", async () => {
    const api = await import("@/api");
    const { result, rerender } = renderHook(
      (filters) => useDvfSummary(filters),
      { initialProps: filtersWithCommune },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(api.fetchTransactionSummary).toHaveBeenCalledTimes(1);

    rerender({ ...filtersWithCommune, typeLocal: "Maison" });

    await waitFor(() =>
      expect(api.fetchTransactionSummary).toHaveBeenCalledTimes(2),
    );
    expect(api.fetchTransactionSummary).toHaveBeenLastCalledWith(
      expect.objectContaining({ type_local: "Maison" }),
    );
  });

  it("sets error when fetch fails", async () => {
    const api = await import("@/api");
    vi.mocked(api.fetchTransactionSummary).mockRejectedValueOnce(
      new ApiError("Bad request", 400),
    );

    const { result } = renderHook(() => useDvfSummary(filtersWithCommune));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Bad request");
    expect(result.current.summary).toBeNull();
  });

  it("reload refetches summary", async () => {
    const api = await import("@/api");
    const { result } = renderHook(() => useDvfSummary(filtersWithCommune));

    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(api.fetchTransactionSummary).mockClear();

    await act(async () => {
      await result.current.reload();
    });

    expect(api.fetchTransactionSummary).toHaveBeenCalled();
  });
});
