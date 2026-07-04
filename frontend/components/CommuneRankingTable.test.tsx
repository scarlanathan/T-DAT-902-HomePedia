import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommuneRankingTable } from "./CommuneRankingTable";
import { renderWithAuth } from "@/test/test-utils";

const sampleRow = {
  code_commune: "75101",
  nom_commune: "Paris 1er",
  value: "45000",
};

describe("CommuneRankingTable", () => {
  it("renders ranked communes with metric value", () => {
    renderWithAuth(
      <CommuneRankingTable
        rows={[sampleRow]}
        metric="median_income_eur"
      />,
    );

    expect(screen.getByText("Paris 1er")).toBeInTheDocument();
    expect(screen.getByText("45,000 €")).toBeInTheDocument();
  });

  it("formats composite score values", () => {
    renderWithAuth(
      <CommuneRankingTable
        rows={[{ ...sampleRow, value: "72.5" }]}
        metric="composite_score"
      />,
    );

    expect(screen.getByText("72.5 / 100")).toBeInTheDocument();
  });

  it("formats price per sqm values", () => {
    renderWithAuth(
      <CommuneRankingTable
        rows={[{ ...sampleRow, value: "12500" }]}
        metric="price_median_per_sqm"
      />,
    );

    expect(screen.getByText("12,500 €")).toBeInTheDocument();
  });

  it("calls onSelect when a row is clicked", () => {
    const onSelect = vi.fn();
    renderWithAuth(
      <CommuneRankingTable
        rows={[sampleRow]}
        metric="median_income_eur"
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByText("Paris 1er"));
    expect(onSelect).toHaveBeenCalledWith(sampleRow);
  });

  it("marks the selected commune row", () => {
    renderWithAuth(
      <CommuneRankingTable
        rows={[sampleRow]}
        metric="median_income_eur"
        selectedCodeCommune="75101"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole("row", { selected: true })).toBeInTheDocument();
  });
});
