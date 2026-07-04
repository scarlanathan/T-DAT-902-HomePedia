"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAnchoredPopover } from "@/components/ui/useAnchoredPopover";

type Props = {
  ariaLabel: string;
  dialogLabel: string;
  children: ReactNode;
  contentKey?: string;
  size?: "sm" | "md";
  variant?: "info" | "question";
};

const PANEL_WIDTH = { sm: 280, md: 320 } as const;

export function InfoPopoverButton({
  ariaLabel,
  dialogLabel,
  children,
  contentKey = "",
  size = "sm",
  variant = "info",
}: Props) {
  const panelWidth = PANEL_WIDTH[size];
  const { open, position, panelId, buttonRef, panelRef, toggle } =
    useAnchoredPopover(panelWidth, contentKey);

  const buttonClass =
    size === "sm"
      ? "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-ink-200/90 bg-white/90 text-[10px] font-bold not-italic leading-none text-ink-400 shadow-sm transition hover:border-ink-300 hover:bg-ink-50 hover:text-ink-600 dark:border-ink-600/80 dark:bg-ink-800/90 dark:text-ink-400 dark:hover:border-ink-500 dark:hover:bg-ink-700/80 dark:hover:text-ink-200"
      : "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-ink-200/90 bg-white/90 text-sm font-semibold text-ink-500 shadow-sm transition hover:border-ink-300 hover:bg-ink-50 hover:text-ink-700 dark:border-ink-700/80 dark:bg-ink-800/90 dark:text-ink-300 dark:hover:border-ink-600 dark:hover:bg-ink-700/80 dark:hover:text-ink-100";

  const panel =
    open && position ? (
      <div
        id={panelId}
        ref={panelRef}
        role="dialog"
        aria-label={dialogLabel}
        style={{
          position: "fixed",
          top: position.top,
          left: position.left,
          width: position.maxWidth,
          zIndex: 60,
        }}
        className="rounded-xl border border-ink-200/90 bg-white p-3 text-left shadow-elevated ring-1 ring-ink-200/50 dark:border-ink-700/90 dark:bg-ink-900 dark:ring-ink-700/50"
      >
        <div className="text-sm leading-relaxed text-ink-600 dark:text-ink-300">
          {children}
        </div>
      </div>
    ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={toggle}
        className={buttonClass}
      >
        {variant === "question" ? "?" : "i"}
      </button>
      {typeof document !== "undefined" && panel
        ? createPortal(panel, document.body)
        : null}
    </>
  );
}
