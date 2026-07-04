import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "@/api";
import SignupPage from "@/app/signup/page";
import { mockRouter } from "@/test/mock-router";
import { renderWithAuth, toAuthUser } from "@/test/test-utils";

describe("SignupPage", () => {
  beforeEach(() => {
    mockRouter.replace.mockClear();
    vi.restoreAllMocks();
  });

  it("redirects to home when already authenticated", async () => {
    renderWithAuth(<SignupPage />, {
      initialUser: toAuthUser({ email: "x@y.z", displayName: "x" }),
    });
    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith("/");
    });
  });

  it("registers with credentials and navigates home", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const ue = userEvent.setup();
    vi.spyOn(api, "registerUser").mockResolvedValue({
      id: "user-1",
      email: "user@test.dev",
      displayName: "User",
      locale: "en",
      theme: "light",
    });
    renderWithAuth(<SignupPage />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Create account/i })).toBeInTheDocument();
    });
    await ue.type(screen.getByRole("textbox", { name: /display name/i }), "User");
    await ue.type(screen.getByRole("textbox", { name: /email/i }), "user@test.dev");
    await ue.type(screen.getByLabelText(/^Password$/i), "password123");
    await ue.click(screen.getByRole("button", { name: /Sign up/i }));
    await waitFor(() => {
      expect(api.registerUser).toHaveBeenCalledWith({
        email: "user@test.dev",
        password: "password123",
        display_name: "User",
        locale: "en",
        theme: "light",
      });
      expect(mockRouter.replace).toHaveBeenCalledWith("/");
    });
  });

  it("shows duplicate email error from API", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const ue = userEvent.setup();
    vi.spyOn(api, "registerUser").mockRejectedValue(
      new api.ApiError("Email already registered", 409),
    );
    renderWithAuth(<SignupPage />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Create account/i })).toBeInTheDocument();
    });
    await ue.type(screen.getByRole("textbox", { name: /email/i }), "user@test.dev");
    await ue.type(screen.getByLabelText(/^Password$/i), "password123");
    await ue.click(screen.getByRole("button", { name: /Sign up/i }));
    expect(
      await screen.findByText("Email already registered."),
    ).toBeInTheDocument();
  });

  it("shows password length validation", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const ue = userEvent.setup();
    renderWithAuth(<SignupPage />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Create account/i })).toBeInTheDocument();
    });
    await ue.type(screen.getByRole("textbox", { name: /email/i }), "user@test.dev");
    await ue.type(screen.getByLabelText(/^Password$/i), "short");
    const form = screen
      .getByRole("button", { name: /Sign up/i })
      .closest("form") as HTMLFormElement;
    form.noValidate = true;
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.submit(form);
    expect(
      await screen.findByText("Password must be at least 8 characters."),
    ).toBeInTheDocument();
  });
});
