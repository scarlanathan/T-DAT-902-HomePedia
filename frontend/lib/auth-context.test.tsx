import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "@/api";
import { AuthProvider, useAuth } from "./auth-context";

function Consumer() {
  const { user, ready, login, logout, register } = useAuth();
  return (
    <div>
      <span data-testid="ready">{String(ready)}</span>
      <span data-testid="email">{user?.email ?? "none"}</span>
      <button type="button" onClick={() => void login("x@test.com", "password123")}>
        login
      </button>
      <button
        type="button"
        onClick={() =>
          void register("new@test.com", "password123", {
            displayName: "New",
            locale: "fr",
            theme: "dark",
          })
        }
      >
        register
      </button>
      <button type="button" onClick={() => void logout()}>
        logout
      </button>
    </div>
  );
}

describe("AuthProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hydrates user from /auth/me", async () => {
    vi.spyOn(api, "fetchCurrentUser").mockResolvedValue({
      id: "user-1",
      email: "a@b.co",
      displayName: "alpha",
      locale: "en",
      theme: "light",
    });
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("ready").textContent).toBe("true");
    });
    expect(screen.getByTestId("email").textContent).toBe("a@b.co");
  });

  it("login updates state from API", async () => {
    vi.spyOn(api, "fetchCurrentUser").mockRejectedValue(new api.ApiError("Unauthorized", 401));
    vi.spyOn(api, "loginUser").mockResolvedValue({
      id: "user-1",
      email: "x@test.com",
      displayName: "x",
      locale: "en",
      theme: "light",
    });
    const ue = userEvent.setup();
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("ready").textContent).toBe("true"),
    );
    await ue.click(screen.getByRole("button", { name: "login" }));
    await waitFor(() =>
      expect(screen.getByTestId("email").textContent).toBe("x@test.com"),
    );
  });

  it("register updates state from API", async () => {
    vi.spyOn(api, "fetchCurrentUser").mockRejectedValue(new api.ApiError("Unauthorized", 401));
    vi.spyOn(api, "registerUser").mockResolvedValue({
      id: "user-2",
      email: "new@test.com",
      displayName: "New",
      locale: "fr",
      theme: "dark",
    });
    const ue = userEvent.setup();
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("ready").textContent).toBe("true"),
    );
    await ue.click(screen.getByRole("button", { name: "register" }));
    await waitFor(() =>
      expect(screen.getByTestId("email").textContent).toBe("new@test.com"),
    );
    expect(api.registerUser).toHaveBeenCalledWith({
      email: "new@test.com",
      password: "password123",
      display_name: "New",
      locale: "fr",
      theme: "dark",
    });
  });

  it("logout clears user", async () => {
    vi.spyOn(api, "fetchCurrentUser").mockResolvedValue({
      id: "user-1",
      email: "a@b.co",
      displayName: "a",
      locale: "en",
      theme: "light",
    });
    vi.spyOn(api, "logoutUser").mockResolvedValue({ ok: true });
    const ue = userEvent.setup();
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("email").textContent).toBe("a@b.co"),
    );
    await ue.click(screen.getByRole("button", { name: "logout" }));
    await waitFor(() =>
      expect(screen.getByTestId("email").textContent).toBe("none"),
    );
  });
});
