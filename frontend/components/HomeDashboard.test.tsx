import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LocationRow } from "@/api";
import { HomeDashboard } from "./HomeDashboard";
import {
  fixtureEquipmentSummary,
  fixtureLocation,
  fixtureOpportunityScore,
  fixtureSocialSummary,
  fixtureSummary,
  fixtureTransaction,
} from "@/test/fixtures/api";

const mockReload = vi.fn();
const franceMapProps = vi.fn();
const communePickerProps = vi.fn();
const priceTrendProps = vi.fn();

const lyon: LocationRow = {
  location_id: "loc-2",
  code_commune: "69123",
  nom_commune: "Lyon",
  code_departement: "69",
  code_postal: "69001",
};

function mockDashboardData(overrides?: {
  location?: typeof fixtureLocation | null;
  loading?: boolean;
  error?: string | null;
  apiReachable?: boolean;
}) {
  return {
    data: {
      health: { status: "ok" as const, postgres: "up" as const },
      location:
        overrides && "location" in overrides
          ? overrides.location
          : fixtureLocation,
      housingSummary: [
        {
          code_commune: "75101",
          nom_commune: "Paris",
          period_month: "2020-03-01T00:00:00.000Z",
          sale_line_count: "1",
          median_valeur_fonciere: null,
          median_price_per_sqm_built: "8000",
        },
      ],
      transactions: [fixtureTransaction],
      equipmentSummary: fixtureEquipmentSummary,
      socialSummary: fixtureSocialSummary,
      irisSocialSummary: [{ code_iris: "751010101", code_commune: "75101" }],
      opportunityScore: fixtureOpportunityScore,
    },
    state: {
      loading: overrides?.loading ?? false,
      error: overrides?.error ?? null,
      apiReachable: overrides?.apiReachable ?? true,
    },
    reload: mockReload,
  };
}

const useDashboardDataMock = vi.fn(() => mockDashboardData());

vi.mock("@/hooks/use-dashboard-data", () => ({
  useDashboardData: (...args: unknown[]) => useDashboardDataMock(...args),
}));

vi.mock("@/hooks/use-dvf-summary", () => ({
  useDvfSummary: () => ({
    summary: fixtureSummary,
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

vi.mock("next/dynamic", () => ({
  default: () => {
    function FranceMapStub(props: Record<string, unknown>) {
      franceMapProps(props);
      return <div data-testid="france-map-stub">map</div>;
    }
    return FranceMapStub;
  },
}));

vi.mock("./CommunePicker", () => ({
  CommunePicker: (props: Record<string, unknown>) => {
    communePickerProps(props);
    return <div data-testid="commune-picker-stub">picker</div>;
  },
}));

vi.mock("./CommuneSearch", () => ({
  CommuneSearch: ({
    codeCommune,
    codePostal,
    onSelect,
    onClear,
  }: {
    codeCommune: string;
    codePostal?: string;
    onSelect: (loc: LocationRow) => void;
    onClear?: () => void;
  }) => (
    <div data-testid="commune-search-stub">
      <span data-testid="search-code">{codeCommune}</span>
      <span data-testid="search-postal">{codePostal ?? ""}</span>
      <button type="button" onClick={() => onSelect(lyon)}>
        pick-lyon
      </button>
      {onClear ? (
        <button type="button" onClick={onClear}>
          clear-search
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock("./PriceTrendChart", () => ({
  PriceTrendChart: (props: Record<string, unknown>) => {
    priceTrendProps(props);
    return <div data-testid="price-trend-stub">chart</div>;
  },
}));

vi.mock("@/hooks/use-department-communes", () => ({
  useDepartmentCommunes: () => ({
    communes: [fixtureLocation, lyon],
    loading: false,
    error: null,
  }),
}));

describe("HomeDashboard", () => {
  it("renders map and search but hides insight cards until a commune is selected", () => {
    render(<HomeDashboard />);

    expect(screen.getByTestId("commune-search-stub")).toBeInTheDocument();
    expect(screen.getByTestId("france-map-stub")).toBeInTheDocument();
    expect(screen.getByTestId("commune-picker-stub")).toBeInTheDocument();
    expect(screen.queryByTestId("price-trend-stub")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Housing market/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Price history per m²/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows all dataset cards and price chart after a commune is selected", async () => {
    const ue = userEvent.setup();
    render(<HomeDashboard />);

    await ue.click(screen.getByRole("button", { name: /pick-lyon/i }));

    expect(screen.getByTestId("price-trend-stub")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Housing market/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Social indicators/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Public equipment/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Opportunity score/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Price history per m²/i })).toBeInTheDocument();
  });

  it("hides insight cards and price chart when commune selection is cleared", async () => {
    const ue = userEvent.setup();
    render(<HomeDashboard />);

    await ue.click(screen.getByRole("button", { name: /pick-lyon/i }));
    await ue.click(screen.getByRole("button", { name: /clear-search/i }));

    expect(screen.queryByTestId("price-trend-stub")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Housing market/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Price history per m²/i })).not.toBeInTheDocument();
  });

  it("shows loading placeholders on DVF card when commune is selected and data is loading", async () => {
    useDashboardDataMock.mockImplementation(() => mockDashboardData({ loading: true }));
    const ue = userEvent.setup();
    render(<HomeDashboard />);

    await ue.click(screen.getByRole("button", { name: /pick-lyon/i }));

    expect(screen.getAllByText("…").length).toBeGreaterThan(0);
    useDashboardDataMock.mockImplementation(() => mockDashboardData());
  });

  it("shows API error banner when dashboard load fails", () => {
    useDashboardDataMock.mockReturnValueOnce(
      mockDashboardData({ error: "Not found", apiReachable: true }),
    );

    render(<HomeDashboard />);

    expect(screen.getByRole("alert")).toHaveTextContent(/API error/i);
    expect(screen.getByText(/Not found/i)).toBeInTheDocument();
  });

  it("selects a commune from search and passes it to the map", async () => {
    const ue = userEvent.setup();
    render(<HomeDashboard />);

    await ue.click(screen.getByRole("button", { name: /pick-lyon/i }));

    expect(screen.getByTestId("search-code")).toHaveTextContent("69123");
    expect(screen.getByTestId("search-postal")).toHaveTextContent("69001");
    expect(franceMapProps).toHaveBeenCalled();
    const lastProps = franceMapProps.mock.calls.at(-1)?.[0] as {
      selectedCommune?: string;
      focusedDepartment?: string;
    };
    expect(lastProps.selectedCommune).toBe("69123");
    expect(lastProps.focusedDepartment).toBe("69");
  });

  it("clears commune selection from search", async () => {
    const ue = userEvent.setup();
    render(<HomeDashboard />);

    await ue.click(screen.getByRole("button", { name: /pick-lyon/i }));
    await ue.click(screen.getByRole("button", { name: /clear-search/i }));

    expect(screen.getByTestId("search-code")).toHaveTextContent("");
    expect(screen.getByTestId("search-postal")).toHaveTextContent("");
    const lastProps = franceMapProps.mock.calls.at(-1)?.[0] as {
      selectedCommune?: string;
      focusedDepartment?: string;
    };
    expect(lastProps.selectedCommune).toBeUndefined();
    expect(lastProps.focusedDepartment).toBeUndefined();
  });

  it("updates property type filter from the DVF card", async () => {
    const ue = userEvent.setup();
    render(<HomeDashboard />);

    await ue.click(screen.getByRole("button", { name: /pick-lyon/i }));
    await ue.selectOptions(screen.getByLabelText(/property type/i), "Appartement");

    expect(screen.getByLabelText(/property type/i)).toHaveValue("Appartement");
  });

  it("passes housing summary rows to the price trend chart when a commune is selected", async () => {
    const ue = userEvent.setup();
    render(<HomeDashboard />);

    await ue.click(screen.getByRole("button", { name: /pick-lyon/i }));

    const lastProps = priceTrendProps.mock.calls.at(-1)?.[0] as {
      rows: unknown[];
      loading: boolean;
    };
    expect(lastProps.rows).toHaveLength(1);
    expect(lastProps.loading).toBe(false);
  });

  it("passes department communes to the picker", () => {
    render(<HomeDashboard />);

    const lastProps = communePickerProps.mock.calls.at(-1)?.[0] as {
      communes: LocationRow[];
      codeDepartement?: string;
    };
    expect(lastProps.communes).toHaveLength(2);
    expect(lastProps.codeDepartement).toBeUndefined();
  });
});
