import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DatasetCard } from "./DatasetCard";
import { MetricRow } from "./MetricRow";

describe("DatasetCard", () => {
  it("renders title, description, badge, toolbar and metrics", () => {
    render(
      <DatasetCard
        title="Housing market"
        description="Sale prices for the selected commune"
        badge="Filtered"
        toolbar={<label htmlFor="type">Property type</label>}
      >
        <MetricRow label="Sales" value="120" />
        <MetricRow label="Median price" value="350,000 €" />
      </DatasetCard>,
    );

    expect(
      screen.getByRole("heading", { name: /Housing market/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Sale prices for the selected commune/i)).toBeInTheDocument();
    expect(screen.getByText("Filtered")).toBeInTheDocument();
    expect(screen.getByText("Property type")).toBeInTheDocument();
    expect(screen.getByText("Sales")).toBeInTheDocument();
    expect(screen.getByText("Median price")).toBeInTheDocument();
  });

  it("shows source details in the info popover", async () => {
    const ue = userEvent.setup();
    render(
      <DatasetCard
        title="Housing market"
        sourceInfo={{
          name: "DVF",
          about: "French property transfer records.",
        }}
      >
        <MetricRow label="Transactions" value="120" />
      </DatasetCard>,
    );

    await ue.click(screen.getByRole("button", { name: /about housing market data/i }));
    expect(screen.getByText("DVF")).toBeInTheDocument();
    expect(screen.getByText("French property transfer records.")).toBeInTheDocument();
    expect(screen.queryByText(/warehouse tables/i)).not.toBeInTheDocument();
  });

  it("places the info button beside the description when configured", async () => {
    const ue = userEvent.setup();
    render(
      <DatasetCard
        description="Communes ranked by social mix score from income and poverty indicators. Higher is better."
        infoTitle="Social mix"
        sourceInfo={{
          name: "HOMEPEDIA",
          about: "Ranking data sources.",
        }}
        sourceInfoPlacement="description"
      >
        <MetricRow label="Rank" value="1" />
      </DatasetCard>,
    );

    expect(screen.queryByRole("heading", { name: "Social mix" })).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Communes ranked by social mix score from income and poverty indicators. Higher is better.",
      ),
    ).toBeInTheDocument();
    await ue.click(screen.getByRole("button", { name: /about social mix data/i }));
    expect(screen.getByText("HOMEPEDIA")).toBeInTheDocument();
  });
});
