import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  fixtureOpportunityScore,
  fixtureSocialSummary,
  fixtureSummary,
} from "@/test/fixtures/api";
import { RankingCommuneStatsCard } from "./RankingCommuneStatsCard";

describe("RankingCommuneStatsCard", () => {
  it("renders all sections in one card", () => {
    render(
      <RankingCommuneStatsCard
        communeName="Paris 1er"
        social={fixtureSocialSummary}
        dvf={fixtureSummary}
        opportunity={fixtureOpportunityScore}
      />,
    );

    expect(screen.getByRole("heading", { name: "Paris 1er" })).toBeInTheDocument();
    expect(screen.getByText("Social indicators")).toBeInTheDocument();
    expect(screen.getByText("Housing market")).toBeInTheDocument();
    expect(screen.getByText("Opportunity scores")).toBeInTheDocument();
    expect(screen.getByText("Median income")).toBeInTheDocument();
    expect(screen.getByText("Overall")).toBeInTheDocument();
  });

  it("renders DVF and opportunity values in the combined card", () => {
    render(
      <RankingCommuneStatsCard
        communeName="Paris 1er"
        social={fixtureSocialSummary}
        dvf={fixtureSummary}
        opportunity={fixtureOpportunityScore}
      />,
    );

    expect(screen.getByText("450,000 €")).toBeInTheDocument();
    expect(screen.getByText("10,000 €")).toBeInTheDocument();
    expect(screen.getByText("58.5 / 100")).toBeInTheDocument();
  });
});
