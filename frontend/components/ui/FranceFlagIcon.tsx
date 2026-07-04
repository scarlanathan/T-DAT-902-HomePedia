"use client";

import { useId } from "react";

type Props = {
  className?: string;
  title?: string;
};

const FLAG_BLUE = "#1A2FAA";
const FLAG_WHITE = "#FFFFFF";
const FLAG_RED = "#E5252A";

export function FranceFlagIcon({ className = "h-8 w-8", title }: Props) {
  const clipId = useId();

  return (
    <svg
      viewBox="0 0 32 32"
      className={`shrink-0 shadow-sm ${className}`}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <clipPath id={clipId}>
          <rect width="32" height="32" rx="9" ry="9" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <g transform="translate(16 16) rotate(45) translate(-24 -24)">
          <rect x="0" y="0" width="16" height="48" fill={FLAG_BLUE} />
          <rect x="16" y="0" width="16" height="48" fill={FLAG_WHITE} />
          <rect x="32" y="0" width="16" height="48" fill={FLAG_RED} />
        </g>
      </g>
    </svg>
  );
}
