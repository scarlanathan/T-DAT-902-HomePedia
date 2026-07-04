import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fixtureEquipmentSummary } from "@/test/fixtures/api";
import { EquipmentStatCards } from "./EquipmentStatCards";

describe("EquipmentStatCards", () => {
  it("renders equipment counts", () => {
    render(<EquipmentStatCards row={fixtureEquipmentSummary} />);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.queryByText("BPE 2024")).not.toBeInTheDocument();
  });

  it("shows dashes when row is missing", () => {
    render(<EquipmentStatCards row={null} />);
    expect(screen.getAllByText("-")).toHaveLength(4);
  });

  it("shows ellipsis while loading", () => {
    render(<EquipmentStatCards row={null} loading />);
    expect(screen.getAllByText("…")).toHaveLength(4);
  });

  it("sums commerce, sport and other in combined card", () => {
    render(
      <EquipmentStatCards
        row={{
          ...fixtureEquipmentSummary,
          commerce_count: "3",
          sport_count: "2",
          other_count: "1",
        }}
      />,
    );
    expect(screen.getByText("6")).toBeInTheDocument();
  });
});
