"use client";

import { createPortal } from "react-dom";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAnchoredPopover } from "@/components/ui/useAnchoredPopover";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";

const PANEL_WIDTH = 260;

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function UserMenu() {
  const { user, logout } = useAuth();
  const { t } = useLocale();
  const { open, position, panelId, buttonRef, panelRef, toggle, setOpen } =
    useAnchoredPopover(PANEL_WIDTH);

  if (!user) return null;

  const panel =
    open && position ? (
      <div
        id={panelId}
        ref={panelRef}
        role="menu"
        aria-label={t("header.userMenu")}
        style={{
          position: "fixed",
          top: position.top,
          left: position.left,
          width: position.maxWidth,
          zIndex: 60,
        }}
        className="rounded-xl border border-ink-200/90 bg-white p-2 shadow-elevated ring-1 ring-ink-200/50 dark:border-ink-700/90 dark:bg-ink-900 dark:ring-ink-700/50"
      >
        <div className="space-y-1" role="none">
          <div className="px-2 py-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
              {t("header.language")}
            </p>
            <LanguageToggle className="w-full" />
          </div>

          <div className="border-t border-ink-100 px-2 py-2 dark:border-ink-800">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
              {t("header.appearance")}
            </p>
            <ThemeToggle className="w-full" />
          </div>

          <div className="border-t border-ink-100 px-2 py-2 dark:border-ink-800">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="flex w-full items-center justify-center rounded-lg px-2.5 py-2 text-center text-sm font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              {t("header.logout")}
            </button>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label={t("header.userMenu")}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? panelId : undefined}
        className="inline-flex items-center gap-2 rounded-xl border border-ink-200/90 bg-white px-3 py-2 text-sm font-medium text-ink-700 shadow-sm transition hover:border-ink-300 hover:bg-ink-50 dark:border-ink-700/80 dark:bg-ink-800/80 dark:text-ink-100 dark:hover:border-ink-600 dark:hover:bg-ink-700/80"
      >
        <span className="max-w-[10rem] truncate">{user.displayName}</span>
        <IconChevron open={open} />
      </button>
      {typeof document !== "undefined" && panel
        ? createPortal(panel, document.body)
        : null}
    </>
  );
}
