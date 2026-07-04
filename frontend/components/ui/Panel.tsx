"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md";
};

const paddingClass = {
  none: "",
  sm: "p-4",
  md: "p-5 sm:p-6",
};

export function Panel({ children, className = "", padding = "md" }: Props) {
  return (
    <div className={`hp-panel ${paddingClass[padding]} ${className}`}>
      {children}
    </div>
  );
}
