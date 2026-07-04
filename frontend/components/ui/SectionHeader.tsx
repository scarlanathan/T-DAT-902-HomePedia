"use client";

import type { ReactNode } from "react";
import {
  DatasetInfoButton,
  type DatasetSourceInfo,
} from "@/components/ui/DatasetInfoButton";

type Props = {
  title: string;
  description?: string;
  sourceInfo?: DatasetSourceInfo;
  icon?: ReactNode;
  badge?: string;
};

export function SectionHeader({ title, description, sourceInfo, icon, badge }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {icon ? (
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/90 text-brand-600 shadow-sm ring-1 ring-ink-200/80 dark:bg-ink-800/90 dark:text-brand-400 dark:ring-ink-700/70">
            {icon}
          </div>
        ) : null}
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-ink-900 dark:text-ink-50 sm:text-xl">
              {title}
            </h2>
            {sourceInfo ? (
              <DatasetInfoButton title={title} source={sourceInfo} />
            ) : null}
          </div>
          {description ? (
            <p className="mt-1 text-sm text-ink-600 dark:text-ink-300 sm:text-base">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {badge ? (
        <span className="rounded-full bg-brand-500/10 px-3 py-1.5 text-sm font-medium text-brand-700 ring-1 ring-brand-500/20 dark:text-brand-300">
          {badge}
        </span>
      ) : null}
    </div>
  );
}
