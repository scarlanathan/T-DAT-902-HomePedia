import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TransactionsTable } from "./TransactionsTable";

const row = {
  transaction_id: "2020-3",
  location_id: "loc-1",
  date_mutation: "2021-03-15T00:00:00.000Z",
  nature_mutation: "Vente",
  valeur_fonciere: "450000",
  surface_reelle_bati: "45",
  price_per_sqm_built: "10000",
  type_local: "Appartement",
  code_type_local: "2",
  code_postal: "75001",
  longitude: 2.3522,
  latitude: 48.8566,
  ingested_at: "2020-01-01T00:00:00.000Z",
  code_commune: "75101",
  nom_commune: "Paris",
};

describe("TransactionsTable", () => {
  it("shows loading skeleton", () => {
    const { container } = render(<TransactionsTable rows={[]} loading />);
    expect(container.querySelector("[aria-busy=true]")).toBeTruthy();
  });

  it("shows empty message when no rows", () => {
    render(<TransactionsTable rows={[]} />);
    expect(screen.getByText(/No transactions found/i)).toBeInTheDocument();
  });

  it("renders transaction rows in a table", () => {
    render(<TransactionsTable rows={[row]} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("2021-03-15")).toBeInTheDocument();
    expect(screen.getByText("Apartment")).toBeInTheDocument();
    expect(screen.getByText(/450,000\s*€/)).toBeInTheDocument();
    expect(screen.getByText(/45 m²/)).toBeInTheDocument();
  });

  it("shows em dash for missing optional fields", () => {
    render(
      <TransactionsTable
        rows={[
          {
            ...row,
            transaction_id: "empty-1",
            date_mutation: null,
            type_local: null,
            surface_reelle_bati: null,
            valeur_fonciere: null,
            price_per_sqm_built: null,
          },
        ]}
      />,
    );
    const dashes = screen.getAllByText("-");
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });
});
