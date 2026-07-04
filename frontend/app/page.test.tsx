import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardViewShell } from "@/components/DashboardViewShell";

vi.mock("@/components/FranceMap", () => ({
  FranceMap: () => <div data-testid="france-map-page-mock" />,
}));

vi.mock("@/components/PriceTrendChart", () => ({
  PriceTrendChart: () => <div data-testid="price-trend-page-mock" />,
}));
import { mockPathname, mockRouter } from "@/test/mock-router";
import { renderWithAuth, toAuthUser } from "@/test/test-utils";

describe("DashboardViewShell (metrics)", () => {
  beforeEach(() => {
    mockRouter.replace.mockClear();
    mockPathname.mockReturnValue("/");
  });

  it("redirects to login when there is no session", async () => {
    renderWithAuth(<DashboardViewShell />);
    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith("/login");
    });
  });

  it("renders the dashboard when the user is logged in", async () => {
    renderWithAuth(<DashboardViewShell />, {
      initialUser: toAuthUser({ email: "u@test.fr", displayName: "u" }),
    });
    await waitFor(() => {
      expect(screen.getByTestId("france-map-page-mock")).toBeInTheDocument();
    });
    expect(
      screen.getByPlaceholderText(/Search commune by name or postal code/i),
    ).toBeInTheDocument();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});
