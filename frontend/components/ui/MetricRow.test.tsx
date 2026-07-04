import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MetricRow } from "./MetricRow";

describe("MetricRow", () => {
  it("renders label and value", () => {
    render(<MetricRow label="Median income" value="32,000 €" />);

    expect(screen.getByText("Median income")).toBeInTheDocument();
    expect(screen.getByText("32,000 €")).toBeInTheDocument();
  });

  it("renders a short hint below the value", () => {
    render(
      <MetricRow
        label="Median income"
        value="32,000 €"
        hint="€/year per household"
      />,
    );

    expect(screen.getByText("€/year per household")).toBeInTheDocument();
  });

  it("shows info in a popover when the ? button is clicked", async () => {
    const ue = userEvent.setup();
    render(
      <MetricRow
        label="Median income"
        value="32,000 €"
        info="Median household disposable income for the commune (€ per year)."
      />,
    );

    expect(
      screen.queryByText("Median household disposable income for the commune (€ per year)."),
    ).not.toBeInTheDocument();

    await ue.click(screen.getByRole("button", { name: /about median income/i }));
    expect(
      await screen.findByRole("dialog", { name: /median income details/i }),
    ).toHaveTextContent(
      "Median household disposable income for the commune (€ per year).",
    );
  });

  it("omits info button when not provided", () => {
    render(<MetricRow label="Total equipment" value="12" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows loading pulse styling", () => {
    render(<MetricRow label="Sales" value="…" loading />);
    expect(screen.getByText("…")).toHaveClass("animate-pulse");
  });
});
