import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockFetchJson } from "@/test/mock-fetch";
import {
  ApiError,
  fetchCityEquipmentSummary,
  fetchCityHousingSummary,
  fetchCitySocialSummary,
  fetchCommuneRanking,
  fetchCommuneRankingCount,
  fetchIrisSocialSummary,
  fetchEquipment,
  fetchHealth,
  fetchLocation,
  fetchMapTransactions,
  fetchOpportunityScore,
  fetchTransactionSummary,
  fetchTransactions,
  getApiBaseUrl,
  listLocations,
  resolveLocationForDepartment,
  searchLocations,
  listLocationsByDepartment,
} from "./index";

describe("getApiBaseUrl", () => {
  const prev = process.env.NEXT_PUBLIC_API_URL;

  afterEach(() => {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = prev;
  });

  it("defaults to localhost:3001", () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    expect(getApiBaseUrl()).toBe("http://localhost:3001");
  });

  it("strips trailing slash from env URL", () => {
    process.env.NEXT_PUBLIC_API_URL = "http://api.example.com/";
    expect(getApiBaseUrl()).toBe("http://api.example.com");
  });
});

describe("ApiError", () => {
  it("stores status and name", () => {
    const err = new ApiError("Not found (/x)", 404);
    expect(err.name).toBe("ApiError");
    expect(err.status).toBe(404);
    expect(err.message).toContain("Not found");
  });
});

describe("api client", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      mockFetchJson((url) => {
        if (url.includes("/health")) {
          return { ok: true, body: { status: "ok", postgres: "up" } };
        }
        if (url.includes("/locations/75101")) {
          return {
            ok: true,
            body: {
              location_id: "loc-1",
              code_commune: "75101",
              nom_commune: "Paris",
              code_departement: "75",
              code_postal: "75001",
            },
          };
        }
        if (url.includes("/locations?")) {
          return {
            ok: true,
            body: [
              {
                location_id: "loc-1",
                code_commune: "75101",
                nom_commune: "Paris",
                code_departement: "75",
                code_postal: "75001",
              },
            ],
          };
        }
        if (url.includes("/stats/transaction-summary")) {
          return {
            ok: true,
            body: {
              transaction_count: "3",
              min_date_mutation: null,
              max_date_mutation: null,
              median_valeur_fonciere: null,
              median_price_per_sqm_built: null,
            },
          };
        }
        if (url.includes("/stats/city-housing-summary")) {
          return { ok: true, body: [] };
        }
        if (url.includes("/stats/city-equipment-summary")) {
          return {
            ok: true,
            body: [
              {
                code_commune: "75101",
                equipment_total_count: "5",
                education_count: "2",
                health_count: "1",
                commerce_count: "1",
                sport_count: "1",
                other_count: "0",
              },
            ],
          };
        }
        if (url.includes("/stats/city-social-summary")) {
          return {
            ok: true,
            body: [{ code_commune: "75101", median_income_eur: "30000" }],
          };
        }
        if (url.includes("/stats/iris-social-summary")) {
          return {
            ok: true,
            body: [
              {
                code_iris: "751010101",
                code_commune: "75101",
                nom_commune: "Paris",
                nom_iris: "Quartier 1",
                median_income_eur: "28000",
              },
            ],
          };
        }
        if (url.includes("/stats/opportunity-score")) {
          return {
            ok: true,
            body: [{ code_commune: "75101", composite_score: "55" }],
          };
        }
        if (url.includes("/stats/commune-ranking/count")) {
          return { ok: true, body: { count: 155 } };
        }
        if (url.includes("/stats/commune-ranking")) {
          return {
            ok: true,
            body: [
              {
                code_commune: "75101",
                nom_commune: "Paris 1er",
                value: "45000",
              },
            ],
          };
        }
        if (url.includes("/equipment")) {
          return {
            ok: true,
            body: [{ equipment_id: "eq-1", location_id: "loc-1", code_commune: "75101", ingested_at: "2020-01-01T00:00:00.000Z" }],
          };
        }
        if (url.includes("/locations/departments/75/communes")) {
          return {
            ok: true,
            body: [
              {
                location_id: "loc-1",
                code_commune: "75101",
                nom_commune: "Paris",
                code_departement: "75",
              },
            ],
          };
        }
        if (url.includes("/map/transactions")) {
          return {
            ok: true,
            body: [
              {
                transaction_id: "t1",
                longitude: 2.35,
                latitude: 48.85,
                date_mutation: null,
                valeur_fonciere: null,
                price_per_sqm_built: null,
                type_local: null,
                code_commune: "75101",
              },
            ],
          };
        }
        if (url.includes("/transactions")) {
          return {
            ok: true,
            body: [
              {
                transaction_id: "t1",
                location_id: "loc-1",
                ingested_at: "2020-01-01T00:00:00.000Z",
              },
            ],
          };
        }
        if (url.includes("/locations/missing")) {
          return { ok: false, status: 404, body: {} };
        }
        return { ok: false, status: 500, body: {} };
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetchHealth calls /health", async () => {
    const health = await fetchHealth();
    expect(health).toEqual({ status: "ok", postgres: "up" });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/health"),
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("listLocations passes limit without q", async () => {
    const rows = await listLocations(5);
    expect(rows).toHaveLength(1);
    const url = String(vi.mocked(fetch).mock.calls.at(-1)?.[0]);
    expect(url).toContain("limit=5");
    expect(url).not.toContain("q=");
  });

  it("searchLocations passes q and limit", async () => {
    const rows = await searchLocations("paris", 10);
    expect(rows).toHaveLength(1);
    expect(rows[0].code_postal).toBe("75001");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/locations\?.*q=paris/),
      expect.any(Object),
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/limit=10/),
      expect.any(Object),
    );
  });

  it("fetchLocation encodes commune code in path", async () => {
    const loc = await fetchLocation("75101");
    expect(loc.code_commune).toBe("75101");
    expect(loc.code_postal).toBe("75001");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/locations/75101"),
      expect.any(Object),
    );
  });

  it("fetchTransactionSummary forwards filter params", async () => {
    await fetchTransactionSummary({
      code_commune: "75101",
      from: "2020-01-01",
      to: "2024-12-31",
      type_local: "Appartement",
    });
    const url = String(vi.mocked(fetch).mock.calls.at(-1)?.[0]);
    expect(url).toContain("code_commune=75101");
    expect(url).toContain("from=2020-01-01");
    expect(url).toContain("type_local=Appartement");
  });

  it("fetchCityHousingSummary forwards limit", async () => {
    await fetchCityHousingSummary({ code_commune: "75101", limit: 100 });
    expect(String(vi.mocked(fetch).mock.calls.at(-1)?.[0])).toContain("limit=100");
  });

  it("fetchTransactions serializes include_location as string", async () => {
    await fetchTransactions({ code_commune: "75101", include_location: false });
    expect(String(vi.mocked(fetch).mock.calls.at(-1)?.[0])).toContain(
      "include_location=false",
    );
    await fetchTransactions({ code_commune: "75101" });
    expect(String(vi.mocked(fetch).mock.calls.at(-1)?.[0])).toContain(
      "include_location=true",
    );
  });

  it("fetchMapTransactions requires bbox param", async () => {
    const pts = await fetchMapTransactions({
      bbox: "2,48,3,49",
      from: "2020-01-01",
      limit: 500,
    });
    expect(pts).toHaveLength(1);
    const url = String(vi.mocked(fetch).mock.calls.at(-1)?.[0]);
    expect(url).toContain("bbox=2%2C48%2C3%2C49");
  });

  it("throws ApiError on 404", async () => {
    await expect(fetchLocation("missing")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: expect.stringContaining("Not found"),
    });
  });

  it("throws ApiError on other HTTP errors", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchJson(() => ({ ok: false, status: 503, body: {} })),
    );
    await expect(fetchHealth()).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining("HTTP 503"),
    });
  });

  it("resolveLocationForDepartment returns first commune from COG endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchJson((url) => {
        if (url.includes("/locations/departments/69/communes")) {
          return {
            ok: true,
            body: [
              {
                location_id: "a",
                code_commune: "69123",
                nom_commune: "Lyon",
                code_departement: "69",
              },
            ],
          };
        }
        return { ok: false, status: 404, body: {} };
      }),
    );
    const loc = await resolveLocationForDepartment("69");
    expect(loc?.code_commune).toBe("69123");
  });

  it("listLocationsByDepartment calls COG communes endpoint", async () => {
    const rows = await listLocationsByDepartment("75");
    expect(rows).toHaveLength(1);
    expect(rows[0].code_commune).toBe("75101");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/locations/departments/75/communes"),
      expect.any(Object),
    );
  });

  it("fetchCityEquipmentSummary forwards code_commune", async () => {
    const rows = await fetchCityEquipmentSummary({ code_commune: "75101", limit: 1 });
    expect(rows[0].equipment_total_count).toBe("5");
    expect(String(vi.mocked(fetch).mock.calls.at(-1)?.[0])).toContain(
      "code_commune=75101",
    );
  });

  it("fetchCitySocialSummary forwards code_commune", async () => {
    const rows = await fetchCitySocialSummary({ code_commune: "75101" });
    expect(rows[0].median_income_eur).toBe("30000");
  });

  it("fetchIrisSocialSummary forwards commune and iris filters", async () => {
    const rows = await fetchIrisSocialSummary({
      code_commune: "75101",
      code_iris: "751010101",
      limit: 10,
    });
    expect(rows[0].code_iris).toBe("751010101");
    const url = String(vi.mocked(fetch).mock.calls.at(-1)?.[0]);
    expect(url).toContain("code_commune=75101");
    expect(url).toContain("code_iris=751010101");
    expect(url).toContain("limit=10");
  });

  it("fetchOpportunityScore forwards date filters", async () => {
    await fetchOpportunityScore({
      code_commune: "75101",
      from: "2020-01-01",
      to: "2024-12-31",
      limit: 1,
    });
    const url = String(vi.mocked(fetch).mock.calls.at(-1)?.[0]);
    expect(url).toContain("from=2020-01-01");
    expect(url).toContain("to=2024-12-31");
  });

  it("fetchCommuneRanking forwards metric and pagination", async () => {
    const rows = await fetchCommuneRanking({
      metric: "median_income_eur",
      order: "desc",
      limit: 50,
      offset: 100,
    });
    expect(rows[0].value).toBe("45000");
    const url = String(vi.mocked(fetch).mock.calls.at(-1)?.[0]);
    expect(url).toContain("metric=median_income_eur");
    expect(url).toContain("order=desc");
    expect(url).toContain("limit=50");
    expect(url).toContain("offset=100");
  });

  it("fetchCommuneRankingCount forwards metric", async () => {
    const { count } = await fetchCommuneRankingCount({
      metric: "price_median_per_sqm",
    });
    expect(count).toBe(155);
    const url = String(vi.mocked(fetch).mock.calls.at(-1)?.[0]);
    expect(url).toContain("metric=price_median_per_sqm");
  });

  it("fetchEquipment forwards category filter", async () => {
    const rows = await fetchEquipment({
      code_commune: "75101",
      equipment_category: "education",
      include_location: false,
    });
    expect(rows[0].equipment_id).toBe("eq-1");
    const url = String(vi.mocked(fetch).mock.calls.at(-1)?.[0]);
    expect(url).toContain("equipment_category=education");
    expect(url).toContain("include_location=false");
  });

  it("omits empty string query params", async () => {
    await fetchTransactionSummary({ code_commune: "", type_local: "" });
    const url = String(vi.mocked(fetch).mock.calls.at(-1)?.[0]);
    expect(url).not.toContain("code_commune=");
    expect(url).not.toContain("type_local=");
  });
});
