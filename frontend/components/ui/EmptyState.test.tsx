import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders message and optional icon", () => {
    render(
      <EmptyState icon={<span data-testid="empty-icon">pin</span>}>
        Click a department on the map.
      </EmptyState>,
    );

    expect(screen.getByText(/Click a department on the map/i)).toBeInTheDocument();
    expect(screen.getByTestId("empty-icon")).toBeInTheDocument();
  });
});
