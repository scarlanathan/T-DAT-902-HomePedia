import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "@/api";
import LoginPage from "@/app/login/page";
import { mockRouter } from "@/test/mock-router";
import { renderWithAuth, toAuthUser } from "@/test/test-utils";

describe("LoginPage", () => {
  beforeEach(() => {
    mockRouter.replace.mockClear();
    vi.restoreAllMocks();
    localStorage.setItem("homepedia_locale", "en");
    document.documentElement.lang = "en";
  });

  it("redirects to home when already authenticated", async () => {
    renderWithAuth(<LoginPage />, {
      initialUser: toAuthUser({ email: "x@y.z", displayName: "x" }),
    });
    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith("/");
    });
  });

  it("signs in with credentials and navigates home", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const ue = userEvent.setup();
    vi.spyOn(api, "loginUser").mockResolvedValue({
      id: "user-1",
      email: "user@test.dev",
      displayName: "user",
      locale: "en",
      theme: "light",
    });
    renderWithAuth(<LoginPage />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Log in/i })).toBeInTheDocument();
    });
    await ue.type(screen.getByRole("textbox", { name: /email/i }), "user@test.dev");
    await ue.type(screen.getByLabelText(/password/i), "password123");
    await ue.click(screen.getByRole("button", { name: /Log in/i }));
    await waitFor(() => {
      expect(api.loginUser).toHaveBeenCalledWith({
        email: "user@test.dev",
        password: "password123",
      });
      expect(mockRouter.replace).toHaveBeenCalledWith("/");
    });
  });

  it("shows API error without route suffix", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const ue = userEvent.setup();
    vi.spyOn(api, "loginUser").mockRejectedValue(
      new api.ApiError("Invalid email or password", 401),
    );
    renderWithAuth(<LoginPage />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Log in/i })).toBeInTheDocument();
    });
    await ue.type(screen.getByRole("textbox", { name: /email/i }), "user@test.dev");
    await ue.type(screen.getByLabelText(/password/i), "wrong");
    await ue.click(screen.getByRole("button", { name: /Log in/i }));
    expect(
      await screen.findByText("Invalid email or password."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\/auth\/login/)).not.toBeInTheDocument();
  });

  it("shows login errors in French when locale is fr", async () => {
    localStorage.setItem("homepedia_locale", "fr");
    const { userEvent } = await import("@testing-library/user-event");
    const ue = userEvent.setup();
    vi.spyOn(api, "loginUser").mockRejectedValue(
      new api.ApiError("Invalid email or password", 401),
    );
    renderWithAuth(<LoginPage />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Connexion/i })).toBeInTheDocument();
    });
    await ue.type(screen.getByRole("textbox", { name: /e-mail/i }), "user@test.dev");
    await ue.type(screen.getByLabelText(/mot de passe/i), "wrong");
    await ue.click(screen.getByRole("button", { name: /Connexion/i }));
    expect(
      await screen.findByText("E-mail ou mot de passe incorrect."),
    ).toBeInTheDocument();
  });

  it("requires email before submit", async () => {
    renderWithAuth(<LoginPage />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Log in/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("textbox", { name: /email/i })).toBeRequired();
    expect(screen.getByLabelText(/password/i)).toBeRequired();
  });
});
