import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SectionHeader } from "./SectionHeader";

describe("SectionHeader", () => {
  it("renders title, description, icon and badge", () => {
    render(
      <SectionHeader
        title="History price / m²"
        description="Monthly trend"
        icon={<span data-testid="icon">chart</span>}
        badge="Beta"
      />,
    );

    expect(
      screen.getByRole("heading", { name: /History price \/ m²/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Monthly trend")).toBeInTheDocument();
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });
});
