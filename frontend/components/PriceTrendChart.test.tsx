import type { ReactElement } from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/lib/locale-context";
import { ThemeProvider } from "@/lib/theme-context";
import { PriceTrendChart } from "./PriceTrendChart";

function renderChart(ui: ReactElement) {
  return render(
    <LocaleProvider>
      <ThemeProvider>{ui}</ThemeProvider>
    </LocaleProvider>,
  );
}

vi.mock("echarts-for-react", () => ({
  default ({
    option,
  }: {
    option: { xAxis?: { data?: string[] }; series?: Array<{ data?: (number | null)[] }> };
  }) {
    return (
      <div
        data-testid="echarts-stub"
        data-labels={option.xAxis?.data?.join(",")}
        data-first={option.series?.[0]?.data?.[0]}
      />
    );
  },
}));

describe("PriceTrendChart", () => {
  it("builds chart from housing summary rows", () => {
    renderChart(
      <PriceTrendChart
        rows={[
          {
            code_commune: "75101",
            nom_commune: "Paris",
            period_month: "2020-03-01T00:00:00.000Z",
            sale_line_count: "1",
            median_valeur_fonciere: null,
            median_price_per_sqm_built: "8000",
          },
          {
            code_commune: "75101",
            nom_commune: "Paris",
            period_month: "2021-06-01T00:00:00.000Z",
            sale_line_count: "2",
            median_valeur_fonciere: null,
            median_price_per_sqm_built: "9000",
          },
        ]}
      />,
    );
    const stub = screen.getByTestId("echarts-stub");
    expect(Number(stub.getAttribute("data-first"))).toBe(8000);
  });

  it("shows empty state when no rows", () => {
    const { container } = renderChart(<PriceTrendChart rows={[]} />);
    expect(
      within(container).getByText(/No price history/i),
    ).toBeInTheDocument();
  });

  it("shows loading state", () => {
    renderChart(<PriceTrendChart rows={[]} loading />);
    expect(screen.getByText(/Loading chart/i)).toBeInTheDocument();
  });
});
