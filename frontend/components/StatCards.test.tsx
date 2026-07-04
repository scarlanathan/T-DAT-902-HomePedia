import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StatCards } from "./StatCards";

describe("StatCards", () => {
  it("formats summary values for en-US locale", () => {
    render(
      <StatCards
        summary={{
          transaction_count: "120000",
          min_date_mutation: "2020-01-15T00:00:00.000Z",
          max_date_mutation: "2024-06-01T00:00:00.000Z",
          median_valeur_fonciere: "350000",
          median_price_per_sqm_built: "4500",
        }}
      />,
    );
    expect(screen.getByText(/4,500\s*€/)).toBeInTheDocument();
    expect(screen.getByText(/120,000/)).toBeInTheDocument();
    expect(screen.getByText(/2020-01-15/)).toBeInTheDocument();
  });

  it("shows em dash when summary is null", () => {
    render(<StatCards summary={null} />);
    const dashes = screen.getAllByText("-");
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it("shows ellipsis while loading", () => {
    render(
      <StatCards
        summary={{
          transaction_count: "1",
          min_date_mutation: null,
          max_date_mutation: null,
          median_valeur_fonciere: null,
          median_price_per_sqm_built: null,
        }}
        loading
      />,
    );
    expect(screen.getAllByText("…").length).toBeGreaterThanOrEqual(1);
  });

  it("hides property type filter when onTypeLocalChange is not provided", () => {
    render(<StatCards summary={null} />);
    expect(screen.queryByLabelText(/property type/i)).not.toBeInTheDocument();
  });

  it("calls onTypeLocalChange when property type changes", async () => {
    const onTypeLocalChange = vi.fn();
    const { userEvent } = await import("@testing-library/user-event");
    const ue = userEvent.setup();
    render(
      <StatCards summary={null} typeLocal="" onTypeLocalChange={onTypeLocalChange} />,
    );
    await ue.selectOptions(screen.getByLabelText(/property type/i), "Maison");
    expect(onTypeLocalChange).toHaveBeenCalledWith("Maison");
  });
});
