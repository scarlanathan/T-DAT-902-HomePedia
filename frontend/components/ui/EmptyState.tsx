"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  icon?: ReactNode;
};

export function EmptyState({ children, icon }: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200/90 bg-ink-50/50 px-5 py-8 text-center text-base text-ink-600 dark:border-ink-700/80 dark:bg-ink-800/40 dark:text-ink-300">
      {icon ? (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink-500 shadow-sm ring-1 ring-ink-200/80 dark:bg-ink-800 dark:text-ink-300 dark:ring-ink-700/70">
          {icon}
        </div>
      ) : null}
      {children}
    </div>
  );
}
