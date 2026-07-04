import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppViewNav } from "./AppViewNav";
import { mockPathname } from "@/test/mock-router";
import { renderWithAuth, toAuthUser } from "@/test/test-utils";

describe("AppViewNav", () => {
  it("highlights Metrics on the home page", async () => {
    mockPathname.mockReturnValue("/");
    renderWithAuth(<AppViewNav />, {
      initialUser: toAuthUser({ email: "jane@x.fr", displayName: "jane" }),
    });

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Metrics" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    });
    expect(screen.getByRole("link", { name: "Ranking" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("highlights Ranking on the ranking page", async () => {
    mockPathname.mockReturnValue("/ranking");
    renderWithAuth(<AppViewNav />, {
      initialUser: toAuthUser({ email: "jane@x.fr", displayName: "jane" }),
    });

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Ranking" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    });
    expect(screen.getByRole("link", { name: "Metrics" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Ranking" })).toHaveAttribute(
      "href",
      "/ranking",
    );
  });
});
