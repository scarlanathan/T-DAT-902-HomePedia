"use client";

import { inputClassName } from "@/components/ui/field-styles";
import { PAGE_SIZE_OPTIONS, type PageSize } from "@/lib/ranking";
import { useLocale } from "@/lib/locale-context";

type Props = {
  page: number;
  pageSize: PageSize;
  total: number;
  totalPages: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
};

export function RankingPagination({
  page,
  pageSize,
  total,
  totalPages,
  loading,
  onPageChange,
  onPageSizeChange,
}: Props) {
  const { t } = useLocale();

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const canGoPrevious = page > 1 && !loading;
  const canGoNext = page < totalPages && !loading;

  return (
    <div className="flex items-center justify-between gap-3 overflow-x-auto border-t border-ink-200 pt-4 dark:border-ink-700">
      <p className="shrink-0 text-sm whitespace-nowrap text-ink-700 dark:text-ink-300">
        {total === 0
          ? t("ranking.paginationEmpty")
          : t("ranking.paginationRange", { from, to, total })}
      </p>

      <div className="flex shrink-0 items-center gap-3 whitespace-nowrap">
        <label className="flex items-center gap-2">
          <span className="text-xs text-ink-600 dark:text-ink-400">
            {t("ranking.perPage")}
          </span>
          <select
            className={`${inputClassName} py-1.5 text-sm`}
            value={pageSize}
            disabled={loading}
            aria-label={t("ranking.perPageSrOnly")}
            onChange={(e) =>
              onPageSizeChange(Number(e.target.value) as PageSize)
            }
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-xl border border-ink-200/90 bg-white px-3 py-1.5 text-sm font-medium text-ink-700 shadow-sm transition hover:border-ink-300 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-ink-700/80 dark:bg-ink-800/80 dark:text-ink-100 dark:hover:border-ink-600 dark:hover:bg-ink-700/80"
            disabled={!canGoPrevious}
            onClick={() => onPageChange(page - 1)}
          >
            {t("ranking.previous")}
          </button>
          <span className="text-sm tabular-nums text-ink-700 dark:text-ink-300">
            {t("ranking.pageOf", { page, totalPages })}
          </span>
          <button
            type="button"
            className="rounded-xl border border-ink-200/90 bg-white px-3 py-1.5 text-sm font-medium text-ink-700 shadow-sm transition hover:border-ink-300 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-ink-700/80 dark:bg-ink-800/80 dark:text-ink-100 dark:hover:border-ink-600 dark:hover:bg-ink-700/80"
            disabled={!canGoNext}
            onClick={() => onPageChange(page + 1)}
          >
            {t("ranking.next")}
          </button>
        </div>
      </div>
    </div>
  );
}
