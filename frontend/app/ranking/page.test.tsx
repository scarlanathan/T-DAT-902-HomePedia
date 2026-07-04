import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardViewShell } from "@/components/DashboardViewShell";
import { mockPathname, mockRouter } from "@/test/mock-router";
import { renderWithAuth, toAuthUser } from "@/test/test-utils";

vi.mock("@/components/RankingDashboard", () => ({
  RankingDashboard: () => <div data-testid="ranking-dashboard-mock" />,
}));

describe("DashboardViewShell (ranking)", () => {
  beforeEach(() => {
    mockRouter.replace.mockClear();
    mockPathname.mockReturnValue("/ranking");
  });

  it("redirects to login when there is no session", async () => {
    renderWithAuth(<DashboardViewShell />);
    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith("/login");
    });
  });

  it("renders the ranking dashboard when the user is logged in", async () => {
    renderWithAuth(<DashboardViewShell />, {
      initialUser: toAuthUser({ email: "u@test.fr", displayName: "u" }),
    });
    await waitFor(() => {
      expect(screen.getByTestId("ranking-dashboard-mock")).toBeInTheDocument();
    });
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});
