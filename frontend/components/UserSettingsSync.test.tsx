import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "@/api";
import { AuthProvider } from "@/lib/auth-context";
import { LocaleProvider, useLocale } from "@/lib/locale-context";
import { ThemeProvider, useTheme } from "@/lib/theme-context";
import { UserSettingsSync } from "./UserSettingsSync";

function SettingsProbe() {
  const { locale, setLocale } = useLocale();
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="theme">{theme}</span>
      <button type="button" onClick={() => setLocale("fr")}>
        set-fr
      </button>
      <button type="button" onClick={() => setTheme("dark")}>
        set-dark
      </button>
    </div>
  );
}

function renderSettingsSync(initialUser: api.AuthUser | null) {
  vi.spyOn(api, "fetchCurrentUser").mockImplementation(async () => {
    if (!initialUser) throw new api.ApiError("Unauthorized", 401);
    return initialUser;
  });

  return render(
    <LocaleProvider>
      <ThemeProvider>
        <AuthProvider>
          <UserSettingsSync />
          <SettingsProbe />
        </AuthProvider>
      </ThemeProvider>
    </LocaleProvider>,
  );
}

describe("UserSettingsSync", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("hydrates locale and theme from the user profile", async () => {
    vi.spyOn(api, "updateUserSettings");
    localStorage.setItem("homepedia_locale", "en");
    localStorage.setItem("homepedia_theme", "light");

    renderSettingsSync({
      id: "user-1",
      email: "jane@example.com",
      displayName: "jane",
      locale: "fr",
      theme: "dark",
    });

    await waitFor(() => {
      expect(screen.getByTestId("locale")).toHaveTextContent("fr");
      expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    });
    expect(api.updateUserSettings).not.toHaveBeenCalled();
  });

  it("patches settings when locale or theme changes", async () => {
    vi.spyOn(api, "updateUserSettings").mockResolvedValue({
      id: "user-1",
      email: "jane@example.com",
      displayName: "jane",
      locale: "fr",
      theme: "light",
    });

    renderSettingsSync({
      id: "user-1",
      email: "jane@example.com",
      displayName: "jane",
      locale: "en",
      theme: "light",
    });

    await waitFor(() => {
      expect(screen.getByTestId("locale")).toHaveTextContent("en");
    });

    const ue = userEvent.setup();
    await ue.click(screen.getByRole("button", { name: "set-fr" }));

    await waitFor(() => {
      expect(api.updateUserSettings).toHaveBeenCalledWith({
        locale: "fr",
        theme: "light",
      });
    });
  });
});
