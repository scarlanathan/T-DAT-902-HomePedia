import type { ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { vi } from "vitest";
import type { AuthUser } from "@/api";
import * as api from "@/api";
import { AuthProvider } from "@/lib/auth-context";
import { LocaleProvider } from "@/lib/locale-context";
import { PreferencesModalProvider } from "@/lib/preferences-modal-context";
import { ThemeProvider } from "@/lib/theme-context";

type AuthOpts = {
  initialUser?: AuthUser | null;
};

function toAuthUser(partial: {
  email: string;
  displayName: string;
  id?: string;
  locale?: "en" | "fr";
  theme?: "light" | "dark";
}): AuthUser {
  return {
    id: partial.id ?? "test-user",
    email: partial.email,
    displayName: partial.displayName,
    locale: partial.locale ?? "en",
    theme: partial.theme ?? "light",
  };
}

function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <ThemeProvider>
        <AuthProvider>
          <PreferencesModalProvider>{children}</PreferencesModalProvider>
        </AuthProvider>
      </ThemeProvider>
    </LocaleProvider>
  );
}

export function renderWithAuth(
  ui: ReactElement,
  {
    initialUser = null,
    ...options
  }: AuthOpts & Omit<RenderOptions, "wrapper"> = {},
) {
  vi.spyOn(api, "fetchCurrentUser").mockImplementation(async () => {
    if (!initialUser) throw new api.ApiError("Unauthorized", 401);
    return initialUser;
  });
  vi.spyOn(api, "logoutUser").mockResolvedValue({ ok: true });

  return render(ui, {
    ...options,
    wrapper: ({ children }) => <AllProviders>{children}</AllProviders>,
  });
}

export { toAuthUser };
