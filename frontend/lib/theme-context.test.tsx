import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocaleProvider } from "./locale-context";
import { ThemeProvider, THEME_STORAGE_KEY, useTheme } from "./theme-context";

function ThemeProbe() {
  const { theme, toggleTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button type="button" onClick={toggleTheme}>
        toggle
      </button>
      <button type="button" onClick={() => setTheme("dark")}>
        set-dark
      </button>
    </div>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("reads stored theme on mount", async () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    render(
      <LocaleProvider>
        <ThemeProvider>
          <ThemeProbe />
        </ThemeProvider>
      </LocaleProvider>,
    );

    expect(await screen.findByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("toggles theme and persists to localStorage", async () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    const ue = userEvent.setup();
    render(
      <LocaleProvider>
        <ThemeProvider>
          <ThemeProbe />
        </ThemeProvider>
      </LocaleProvider>,
    );

    await ue.click(screen.getByRole("button", { name: /toggle/i }));
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("throws when useTheme is used outside provider", () => {
    expect(() => renderToString(createElement(ThemeProbe))).toThrow(
      /useTheme must be used within ThemeProvider/i,
    );
  });
});
