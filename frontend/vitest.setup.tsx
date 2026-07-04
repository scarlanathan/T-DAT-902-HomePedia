import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { mockPathname, mockRouter } from "./test/mock-router";
import React from "react";
import { afterEach, vi } from "vitest";
import { LocaleProvider } from "@/lib/locale-context";
import { ThemeProvider } from "@/lib/theme-context";

function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </LocaleProvider>
  );
}

vi.mock("@testing-library/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@testing-library/react")>();
  return {
    ...actual,
    render: (
      ui: React.ReactElement,
      options?: Parameters<typeof actual.render>[1],
    ) =>
      actual.render(ui, {
        wrapper: AllProviders,
        ...options,
      }),
  };
});

afterEach(() => {
  cleanup();
  mockRouter.replace.mockClear();
  mockRouter.push.mockClear();
  mockRouter.prefetch.mockClear();
  mockRouter.back.mockClear();
  mockPathname.mockReset();
  mockPathname.mockImplementation(() => "/");
});

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockPathname(),
}));

vi.mock("next/link", () => ({
  default ({
    children,
    href,
    ...rest
  }: React.PropsWithChildren<{ href: string; className?: string }>) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
}));

Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});
