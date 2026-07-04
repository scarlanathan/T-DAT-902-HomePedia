import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtureLocation } from "@/test/fixtures/api";
import { COMMUNE_LOAD_ERROR_KEY } from "@/components/CommunePicker";
import { useDepartmentCommunes } from "./use-department-communes";

vi.mock("@/api", () => ({
  listAllLocationsByDepartment: vi.fn(() => Promise.resolve([fixtureLocation])),
}));

describe("useDepartmentCommunes", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty state when no department is focused", () => {
    const { result } = renderHook(() => useDepartmentCommunes(undefined));

    expect(result.current.communes).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("loads communes for the focused department", async () => {
    const api = await import("@/api");
    const { result } = renderHook(() => useDepartmentCommunes("75"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(api.listAllLocationsByDepartment).toHaveBeenCalledWith("75");
    expect(result.current.communes).toEqual([fixtureLocation]);
    expect(result.current.error).toBeNull();
  });

  it("clears communes when the department is unset", async () => {
    const { result, rerender } = renderHook(
      ({ code }: { code?: string }) => useDepartmentCommunes(code),
      { initialProps: { code: "75" as string | undefined } },
    );

    await waitFor(() => {
      expect(result.current.communes).toHaveLength(1);
    });

    rerender({ code: undefined });

    expect(result.current.communes).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("sets error state when the API call fails", async () => {
    const api = await import("@/api");
    vi.mocked(api.listAllLocationsByDepartment).mockRejectedValueOnce(
      new Error("network"),
    );

    const { result } = renderHook(() => useDepartmentCommunes("01"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.communes).toEqual([]);
    expect(result.current.error).toBe(COMMUNE_LOAD_ERROR_KEY);
  });
});
