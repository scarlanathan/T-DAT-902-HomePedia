import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fixtureOpportunityScore } from "@/test/fixtures/api";
import { OpportunityScoreCards } from "./OpportunityScoreCards";

describe("OpportunityScoreCards", () => {
  it("renders composite and dimension scores", () => {
    render(<OpportunityScoreCards row={fixtureOpportunityScore} />);
    expect(screen.getByText(/58\.5\s*\/\s*100/)).toBeInTheDocument();
    expect(screen.getByText(/35\s*\/\s*100/)).toBeInTheDocument();
    expect(screen.getByText(/68\s*\/\s*100/)).toBeInTheDocument();
    expect(screen.getByText(/72\s*\/\s*100/)).toBeInTheDocument();
    expect(
      screen.getByText("Higher score means more affordable housing"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Higher score means higher income and lower poverty"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Higher score means more nearby amenities"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Latest month:/)).not.toBeInTheDocument();
  });

  it("shows dashes when row is missing", () => {
    render(<OpportunityScoreCards row={null} />);
    expect(screen.getAllByText("-")).toHaveLength(4);
  });

  it("shows ellipsis while loading", () => {
    render(<OpportunityScoreCards row={null} loading />);
    expect(screen.getAllByText("…")).toHaveLength(4);
  });
});
