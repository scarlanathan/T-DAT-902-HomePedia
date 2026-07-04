"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export type PanelPosition = {
  top: number;
  left: number;
  maxWidth: number;
};

const VIEWPORT_MARGIN = 12;
const GAP = 8;

export function useAnchoredPopover(panelWidth: number, contentKey = "") {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    const panel = panelRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const panelHeight = panel?.offsetHeight ?? 120;
    const maxWidth = Math.min(
      panelWidth,
      window.innerWidth - VIEWPORT_MARGIN * 2,
    );

    let left = rect.right - maxWidth;
    left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(left, window.innerWidth - maxWidth - VIEWPORT_MARGIN),
    );

    const spaceBelow = window.innerHeight - rect.bottom - GAP - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - GAP - VIEWPORT_MARGIN;
    const placeAbove = spaceBelow < panelHeight && spaceAbove > spaceBelow;

    let top = placeAbove
      ? rect.top - GAP - panelHeight
      : rect.bottom + GAP;
    top = Math.max(
      VIEWPORT_MARGIN,
      Math.min(top, window.innerHeight - panelHeight - VIEWPORT_MARGIN),
    );

    setPosition({ top, left, maxWidth });
  }, [panelWidth]);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    updatePosition();
    const frame = requestAnimationFrame(() => updatePosition());
    return () => cancelAnimationFrame(frame);
  }, [open, updatePosition, contentKey]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function onReposition() {
      updatePosition();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, updatePosition]);

  return {
    open,
    setOpen,
    position,
    panelId,
    buttonRef,
    panelRef,
    toggle: () => setOpen((prev) => !prev),
  };
}
