import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardViewShell } from "@/components/DashboardViewShell";
import { mockPathname, mockRouter } from "@/test/mock-router";
import { renderWithAuth, toAuthUser } from "@/test/test-utils";

vi.mock("@/components/ForecastDashboard", () => ({
  ForecastDashboard: () => <div data-testid="forecast-dashboard-mock" />,
}));

vi.mock("@/components/HomeDashboard", () => ({
  HomeDashboard: () => <div data-testid="home-dashboard-mock" />,
}));

describe("DashboardViewShell (predictions)", () => {
  beforeEach(() => {
    mockRouter.replace.mockClear();
    mockPathname.mockReturnValue("/predictions");
  });

  it("redirects to login when there is no session", async () => {
    renderWithAuth(<DashboardViewShell />);
    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith("/login");
    });
  });

  it("renders the forecast dashboard and not the metrics view when logged in", async () => {
    renderWithAuth(<DashboardViewShell />, {
      initialUser: toAuthUser({ email: "u@test.fr", displayName: "u" }),
    });
    await waitFor(() => {
      expect(screen.getByTestId("forecast-dashboard-mock")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("home-dashboard-mock")).not.toBeInTheDocument();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});
