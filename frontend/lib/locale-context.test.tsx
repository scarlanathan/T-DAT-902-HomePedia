import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocaleProvider, LOCALE_STORAGE_KEY, useLocale } from "./locale-context";

function LocaleProbe() {
  const { locale, setLocale, t } = useLocale();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="greeting">{t("header.login")}</span>
      <button type="button" onClick={() => setLocale("fr")}>
        set-fr
      </button>
      <button type="button" onClick={() => setLocale("en")}>
        set-en
      </button>
    </div>
  );
}

describe("LocaleProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = "en";
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.lang = "en";
  });

  it("reads stored locale on mount", async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, "fr");
    render(
      <LocaleProvider>
        <LocaleProbe />
      </LocaleProvider>,
    );

    expect(await screen.findByTestId("locale")).toHaveTextContent("fr");
    expect(screen.getByTestId("greeting")).toHaveTextContent("Connexion");
    expect(document.documentElement.lang).toBe("fr");
  });

  it("switches locale and persists to localStorage", async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, "en");
    const ue = userEvent.setup();
    render(
      <LocaleProvider>
        <LocaleProbe />
      </LocaleProvider>,
    );

    await ue.click(screen.getByRole("button", { name: /set-fr/i }));
    expect(screen.getByTestId("locale")).toHaveTextContent("fr");
    expect(screen.getByTestId("greeting")).toHaveTextContent("Connexion");
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("fr");
    expect(document.documentElement.lang).toBe("fr");
  });

  it("throws when useLocale is used outside provider", () => {
    expect(() => renderToString(createElement(LocaleProbe))).toThrow(
      /useLocale must be used within LocaleProvider/i,
    );
  });
});
