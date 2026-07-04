import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RankingDashboard } from "./RankingDashboard";
import { renderWithAuth } from "@/test/test-utils";

const useCommuneRankingMock = vi.fn(() => ({
  rows: [
    {
      code_commune: "75101",
      nom_commune: "Paris 1er",
      value: "45000",
    },
  ],
  total: 55,
  totalPages: 2,
  offset: 0,
  loading: false,
  error: null,
}));

vi.mock("@/hooks/use-commune-ranking", () => ({
  useCommuneRanking: (...args: unknown[]) => useCommuneRankingMock(...args),
}));

vi.mock("@/hooks/use-dashboard-data", () => ({
  useDashboardData: () => ({
    data: {
      socialSummary: null,
      irisSocialSummary: [],
      opportunityScore: null,
    },
    state: { loading: false, error: null, apiReachable: true },
    reload: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-dvf-summary", () => ({
  useDvfSummary: () => ({
    summary: null,
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-department-communes", () => ({
  useDepartmentCommunes: () => ({
    communes: [],
    loading: false,
    error: null,
  }),
}));

vi.mock("./FranceMap", () => ({
  FranceMap: () => <div data-testid="ranking-france-map" />,
}));

describe("RankingDashboard", () => {
  it("renders ranking with metric selector", async () => {
    renderWithAuth(<RankingDashboard />);
    await waitFor(() => {
      expect(screen.getByText("Commune rankings")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/median household disposable income/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Median income" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Ranking metric")).toBeInTheDocument();
    expect(screen.queryByText("Rank by")).not.toBeInTheDocument();
    expect(screen.getByText("Paris 1er")).toBeInTheDocument();
    expect(screen.getByText("1-50 of 55")).toBeInTheDocument();
    expect(screen.getByTestId("ranking-france-map")).toBeInTheDocument();
  });

  it("changes metric via selector", async () => {
    renderWithAuth(<RankingDashboard />);

    fireEvent.change(screen.getByLabelText("Ranking metric"), {
      target: { value: "composite_score" },
    });

    await waitFor(() => {
      expect(useCommuneRankingMock).toHaveBeenCalledWith(
        expect.objectContaining({ metric: "composite_score", page: 1 }),
      );
    });
    expect(
      screen.getByText(/Communes ranked by overall opportunity score/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Overall opportunity" })).not.toBeInTheDocument();
  });

  it("shows commune stats panel after row selection", async () => {
    renderWithAuth(<RankingDashboard />);

    fireEvent.click(screen.getByText("Paris 1er"));

    await waitFor(() => {
      expect(
        screen.queryByText(
          "Select a commune in the ranking list to see its map and key indicators.",
        ),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "Paris 1er" })).toBeInTheDocument();
  });
});
