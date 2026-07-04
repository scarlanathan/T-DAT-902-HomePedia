import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import * as api from "@/api";
import { UserMenu } from "./UserMenu";
import { renderWithAuth, toAuthUser } from "@/test/test-utils";

describe("UserMenu", () => {
  it("renders nothing when logged out", () => {
    const { container } = renderWithAuth(<UserMenu />);
    expect(container).toBeEmptyDOMElement();
  });

  it("opens menu with language, appearance, and logout when logged in", async () => {
    const ue = userEvent.setup();
    renderWithAuth(<UserMenu />, {
      initialUser: toAuthUser({ email: "jane@x.fr", displayName: "jane" }),
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Account menu" })).toBeInTheDocument();
    });
    await ue.click(screen.getByRole("button", { name: "Account menu" }));

    expect(screen.getByText("Language")).toBeInTheDocument();
    expect(screen.getByText("Appearance")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "EN" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "FR" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Light" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dark" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Log out" })).toBeInTheDocument();
  });

  it("logs out when logout is clicked", async () => {
    const ue = userEvent.setup();
    renderWithAuth(<UserMenu />, {
      initialUser: toAuthUser({ email: "jane@x.fr", displayName: "jane" }),
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Account menu" })).toBeInTheDocument();
    });
    await ue.click(screen.getByRole("button", { name: "Account menu" }));
    await ue.click(screen.getByRole("menuitem", { name: "Log out" }));

    expect(api.logoutUser).toHaveBeenCalled();
  });
});
