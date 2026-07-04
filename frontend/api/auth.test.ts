import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockFetchJson } from "@/test/mock-fetch";
import {
  fetchCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  updateUserSettings,
} from "./auth";

describe("auth api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchCurrentUser calls /auth/me", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchJson((url) => {
        if (url.includes("/auth/me")) {
          return {
            ok: true,
            body: {
              id: "user-1",
              email: "jane@example.com",
              displayName: "jane",
              locale: "en",
              theme: "light",
            },
          };
        }
        return { ok: false, status: 404, body: {} };
      }),
    );

    const user = await fetchCurrentUser();
    expect(user.email).toBe("jane@example.com");
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain("/auth/me");
  });

  it("loginUser posts credentials", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchJson((url) => {
        if (url.includes("/auth/login")) {
          return {
            ok: true,
            body: {
              id: "user-1",
              email: "jane@example.com",
              displayName: "jane",
              locale: "en",
              theme: "light",
            },
          };
        }
        return { ok: false, status: 404, body: {} };
      }),
    );

    const user = await loginUser({
      email: "jane@example.com",
      password: "password123",
    });
    expect(user.displayName).toBe("jane");
  });

  it("registerUser posts signup payload", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchJson((url) => {
        if (url.includes("/auth/register")) {
          return {
            ok: true,
            body: {
              id: "user-1",
              email: "jane@example.com",
              displayName: "jane",
              locale: "fr",
              theme: "dark",
            },
          };
        }
        return { ok: false, status: 404, body: {} };
      }),
    );

    const user = await registerUser({
      email: "jane@example.com",
      password: "password123",
      display_name: "jane",
      locale: "fr",
      theme: "dark",
    });
    expect(user.locale).toBe("fr");
    expect(user.theme).toBe("dark");
  });

  it("logoutUser posts to /auth/logout", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchJson((url) => {
        if (url.includes("/auth/logout")) {
          return { ok: true, body: { ok: true } };
        }
        return { ok: false, status: 404, body: {} };
      }),
    );

    await expect(logoutUser()).resolves.toEqual({ ok: true });
  });

  it("updateUserSettings patches locale and theme", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchJson((url) => {
        if (url.includes("/auth/me/settings")) {
          return {
            ok: true,
            body: {
              id: "user-1",
              email: "jane@example.com",
              displayName: "jane",
              locale: "fr",
              theme: "dark",
            },
          };
        }
        return { ok: false, status: 404, body: {} };
      }),
    );

    const user = await updateUserSettings({ locale: "fr", theme: "dark" });
    expect(user.theme).toBe("dark");
  });
});
