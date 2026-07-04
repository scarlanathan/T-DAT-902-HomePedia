import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Header } from "./Header";
import { mockPathname } from "@/test/mock-router";
import { renderWithAuth, toAuthUser } from "@/test/test-utils";

describe("Header", () => {
  it("shows Log in when logged out", async () => {
    renderWithAuth(<Header />);
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
        "href",
        "/login",
      );
    });
  });

  it("hides Log in on the login page when logged out", async () => {
    mockPathname.mockReturnValue("/login");
    renderWithAuth(<Header />);
    await waitFor(() => {
      expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
    });
  });

  it("hides user menu when logged out", async () => {
    renderWithAuth(<Header />);
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Account menu" }),
      ).not.toBeInTheDocument();
    });
  });

  it("shows user menu with logout when logged in", async () => {
    const ue = userEvent.setup();
    renderWithAuth(<Header />, {
      initialUser: toAuthUser({ email: "jane@x.fr", displayName: "jane" }),
    });

    await waitFor(() => {
      expect(screen.getByText("jane")).toBeInTheDocument();
    });
    await ue.click(screen.getByRole("button", { name: "Account menu" }));

    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: "Log out" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
  });

  it("shows language options inside the user menu when logged in", async () => {
    const ue = userEvent.setup();
    renderWithAuth(<Header />, {
      initialUser: toAuthUser({ email: "jane@x.fr", displayName: "jane" }),
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Account menu" })).toBeInTheDocument();
    });
    await ue.click(screen.getByRole("button", { name: "Account menu" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "EN" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "FR" })).toBeInTheDocument();
    });
  });

  it("HOMEPEDIA links to home", async () => {
    renderWithAuth(<Header />);
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "HOMEPEDIA" })).toHaveAttribute(
        "href",
        "/",
      );
    });
  });
});
