import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ForecastModelResponse,
  ForecastRankingRow,
  ForecastSeriesResponse,
  ForecastSummaryRow,
} from "@/api";
import { ForecastDashboard } from "./ForecastDashboard";

vi.mock("echarts-for-react", () => ({
  default({ option }: { option: { series?: Array<{ id?: string }> } }) {
    return (
      <div
        data-testid="echarts-stub"
        data-series={option.series?.map((s) => s.id).join(",")}
      />
    );
  },
}));

vi.mock("./ForecastMap", () => ({
  ForecastMap: ({ selectedDepartment }: { selectedDepartment?: string }) => (
    <div data-testid="forecast-map-mock" data-selected={selectedDepartment ?? ""} />
  ),
}));

function summary(partial: Partial<ForecastSummaryRow>): ForecastSummaryRow {
  return {
    level: "france",
    code: "FR",
    nom: "France",
    code_departement: null,
    property_type: "all",
    scenario: "central",
    last_quarter: "2026-04-01",
    last_price: "3020",
    last_observed_price: "3005",
    annual_sales: "958000",
    trend_pct_year: "-0.5",
    price_h4: "3056",
    change_pct_h4: "1.2",
    lower_80_h4: "2950",
    upper_80_h4: "3160",
    price_h8: "3100",
    change_pct_h8: "2.6",
    lower_80_h8: "2900",
    upper_80_h8: "3300",
    reliability: "elevee",
    trained_at: "2026-10-01T00:00:00Z",
    ...partial,
  };
}

const history = [
  { period_quarter: "2026-01-01", median_price_per_sqm: "3000", sale_count: "1000" },
  { period_quarter: "2026-04-01", median_price_per_sqm: "3020", sale_count: "1000" },
];
const forecast = [
  {
    scenario: "central" as const,
    period_quarter: "2026-07-01",
    horizon: 1,
    median_price_per_sqm: "3030",
    lower_80: "2980",
    upper_80: "3080",
  },
  {
    scenario: "central" as const,
    period_quarter: "2027-04-01",
    horizon: 4,
    median_price_per_sqm: "3056",
    lower_80: "2950",
    upper_80: "3160",
  },
];

const franceSeries: ForecastSeriesResponse = {
  level: "france",
  code: "FR",
  nom: "France",
  property_type: "all",
  history,
  forecast,
  summary: [summary({})],
  fallback: null,
};

const communeSeries: ForecastSeriesResponse = {
  level: "commune",
  code: "69001",
  nom: "Petiteville",
  property_type: "all",
  history,
  forecast: [],
  summary: [],
  fallback: { level: "departement", code: "69" },
};

const deptSeries: ForecastSeriesResponse = {
  level: "departement",
  code: "69",
  nom: "Rhône",
  property_type: "all",
  history,
  forecast,
  summary: [summary({ level: "departement", code: "69", nom: "Rhône", change_pct_h4: "-0.9" })],
  fallback: null,
};

const rankingRows: ForecastRankingRow[] = [
  {
    level: "commune",
    code: "69001",
    nom: "Petiteville",
    code_departement: "69",
    last_price: "2500",
    forecast_price: "2550",
    change_pct: "2",
    lower_80: null,
    upper_80: null,
    annual_sales: "40",
    reliability: "faible",
  },
];

let modelData: ForecastModelResponse | null = null;

const useForecastSeriesMock = vi.fn(
  ({ level, code }: { level: string; code?: string | null }) => {
    const empty = { data: null, loading: false, error: null, notFound: false };
    if (level === "france") return { ...empty, data: franceSeries };
    if (level === "commune" && code === "69001") return { ...empty, data: communeSeries };
    if (level === "departement" && code === "69") return { ...empty, data: deptSeries };
    return empty;
  },
);

vi.mock("@/hooks/use-forecast", () => ({
  useForecastSeries: (params: { level: string; code?: string | null }) =>
    useForecastSeriesMock(params),
  useForecastModel: () => ({ data: modelData, loading: false, error: null }),
  useForecastMap: () => ({ data: [], loading: false, error: null }),
  useForecastRanking: () => ({ data: rankingRows, loading: false, error: null }),
  useForecastLocations: () => ({
    regions: [],
    departments: [
      {
        departement_id: "1",
        code_departement: "69",
        nom_departement: "Rhône",
        code_region: "84",
        code_commune_cheflieu: null,
        cog_millesime: null,
      },
    ],
    loading: false,
  }),
}));

describe("ForecastDashboard", () => {
  beforeEach(() => {
    modelData = null;
    useForecastSeriesMock.mockClear();
  });

  it("renders the France forecast with KPIs and chart", async () => {
    render(<ForecastDashboard />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Housing market forecasts" }),
    ).toBeInTheDocument();
    const kpis = within(screen.getByRole("region", { name: "Key forecast figures" }));
    expect(kpis.getByText("3,020 €/m²")).toBeInTheDocument();
    expect(kpis.getByText("3,056 €/m²")).toBeInTheDocument();
    expect(kpis.getByText("+1.2 %")).toBeInTheDocument();
    expect(kpis.getByText("2,950 – 3,160")).toBeInTheDocument();
    expect(kpis.getByText("High")).toBeInTheDocument();
    expect(kpis.getByText("958,000")).toBeInTheDocument();
    expect(kpis.getByText(/Q2 2026/)).toBeInTheDocument();

    const chart = screen.getByTestId("echarts-stub");
    expect(chart.getAttribute("data-series")).toContain("scenario-central");
    expect(await screen.findByTestId("forecast-map-mock")).toBeInTheDocument();
    expect(screen.getByLabelText("Geographic level")).toBeInTheDocument();
    expect(screen.getByLabelText("Scenario")).toBeInTheDocument();
    expect(screen.getByLabelText("Horizon")).toBeInTheDocument();
  });

  it("switches KPIs to the 2-year horizon", () => {
    render(<ForecastDashboard />);
    fireEvent.change(screen.getByLabelText("Horizon"), { target: { value: "8" } });
    const kpis = within(screen.getByRole("region", { name: "Key forecast figures" }));
    expect(kpis.getByText("3,100 €/m²")).toBeInTheDocument();
    expect(kpis.getByText("+2.6 %")).toBeInTheDocument();
  });

  it("asks for a department when that level has no selection", () => {
    render(<ForecastDashboard />);
    fireEvent.change(screen.getByLabelText("Geographic level"), {
      target: { value: "departement" },
    });
    expect(
      screen.getByText("Choose a department, or click one on the map below."),
    ).toBeInTheDocument();
  });

  it("falls back to the department forecast for a thin commune", async () => {
    render(<ForecastDashboard />);

    fireEvent.click(screen.getByText("Petiteville"));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Petiteville has too few sales for a reliable forecast of its own",
      );
    });
    expect(useForecastSeriesMock).toHaveBeenCalledWith(
      expect.objectContaining({ level: "departement", code: "69" }),
    );
    // KPIs come from the department summary; the chart also carries the commune history.
    expect(
      within(screen.getByRole("region", { name: "Key forecast figures" })).getByText("-0.9 %"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("echarts-stub").getAttribute("data-series")).toContain("context");
    expect(screen.getByTestId("forecast-map-mock")).toHaveAttribute("data-selected", "69");

    fireEvent.click(screen.getByRole("button", { name: "View Rhône" }));
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText("Geographic level")).toHaveValue("departement");
    expect(screen.getByLabelText("Department")).toHaveValue("69");
  });

  it("shows the not-trained state and the external consensus", () => {
    render(<ForecastDashboard />);
    expect(screen.getByText("The forecast model has not been trained yet.")).toBeInTheDocument();
    expect(screen.getByText("Market consensus (external sources)")).toBeInTheDocument();
    expect(screen.getByText(/are not investment advice/)).toBeInTheDocument();
  });

  it("renders the backtest table when the model is available", () => {
    modelData = {
      model: {
        trained_at: "2026-10-01T08:00:00Z",
        history_start: "2014-01-01",
        history_end: "2026-04-01",
        horizon_quarters: 8,
        method: "Damped local trend with a mortgage-rate term.",
        rate_elasticity: "-0.035",
        damping_phi: "0.9",
        mean_reversion_kappa: "0.05",
        last_rate_pct: "3.31",
        last_rate_month: "2026-08-01",
        n_series: { france: 1, departement: 96 },
      },
      scenarios: [
        {
          scenario: "central",
          label: "Central",
          description: "Rates stable.",
          period_quarter: "2026-07-01",
          horizon: 1,
          rate_pct: "3.3",
          national_change_pct_year: null,
        },
      ],
      backtest: [
        {
          level: "departement",
          horizon: 4,
          n_series: 96,
          mape_model: "3.1",
          mape_naive: "4.0",
          coverage_80: "78",
        },
      ],
    };
    render(<ForecastDashboard />);
    expect(screen.getByText("Damped local trend with a mortgage-rate term.")).toBeInTheDocument();
    expect(screen.getByText("+0.9 pt")).toBeInTheDocument();
    expect(screen.getByText("Q1 2014 – Q2 2026")).toBeInTheDocument();
    expect(screen.getByText("-3.5 % on prices per +1 pt of mortgage rate")).toBeInTheDocument();
  });
});
