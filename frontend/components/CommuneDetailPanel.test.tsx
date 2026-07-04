import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CommuneDetailPanel } from "./CommuneDetailPanel";

const location = {
  location_id: "loc-1",
  code_commune: "75101",
  nom_commune: "Paris",
  code_postal: "75001",
  code_departement: "75",
  code_region: "11",
  type_commune: "COM",
};

const summary = {
  transaction_count: "3",
  min_date_mutation: null,
  max_date_mutation: null,
  median_valeur_fonciere: "450000",
  median_price_per_sqm_built: "10000",
};

describe("CommuneDetailPanel", () => {
  it("shows loading skeleton", () => {
    const { container } = render(
      <CommuneDetailPanel location={null} summary={null} loading />,
    );
    expect(container.querySelector("[aria-busy=true]")).toBeTruthy();
  });

  it("shows placeholder when location is null", () => {
    render(<CommuneDetailPanel location={null} summary={null} />);
    expect(
      screen.getByText(/Select a commune to see housing stats/i),
    ).toBeInTheDocument();
  });

  it("renders user-facing commune stats", () => {
    render(<CommuneDetailPanel location={location} summary={summary} />);
    expect(screen.getByRole("heading", { name: "Paris" })).toBeInTheDocument();
    expect(screen.getByText(/Postal code 75001 · dept\. 75 · region 11 · COM/)).toBeInTheDocument();
    expect(screen.getByText("Sales")).toBeInTheDocument();
    expect(screen.getByText("Median sale price")).toBeInTheDocument();
    expect(screen.getByText("Median price per m² (built)")).toBeInTheDocument();
    expect(screen.queryByText("loc-1")).not.toBeInTheDocument();
    expect(screen.getByText(/\b3\b/)).toBeInTheDocument();
    expect(screen.getByText(/450,000\s*€/)).toBeInTheDocument();
    expect(screen.getByText(/10,000\s*€/)).toBeInTheDocument();
  });

  it("shows dashes when summary metrics are missing", () => {
    render(
      <CommuneDetailPanel
        location={location}
        summary={{
          transaction_count: "",
          min_date_mutation: null,
          max_date_mutation: null,
          median_valeur_fonciere: null,
          median_price_per_sqm_built: null,
        }}
      />,
    );
    expect(screen.getAllByText("-")).toHaveLength(3);
  });

  it("shows INSEE code in detail when postal is missing", () => {
    render(
      <CommuneDetailPanel
        location={{ ...location, code_postal: null }}
        summary={summary}
      />,
    );
    expect(
      screen.getByText(/Postal code 75101 · dept\. 75 · region 11 · COM/),
    ).toBeInTheDocument();
  });
});
