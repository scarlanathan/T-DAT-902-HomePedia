import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Panel } from "./Panel";

describe("Panel", () => {
  it("renders children with default padding", () => {
    const { container } = render(<Panel>Panel content</Panel>);
    expect(screen.getByText("Panel content")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("p-5");
  });

  it("supports no padding", () => {
    const { container } = render(<Panel padding="none">No padding</Panel>);
    expect(container.firstChild).not.toHaveClass("p-5");
  });
});
