"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/locale-context";

const navLinkClass =
  "rounded-lg px-3 py-1.5 font-medium transition hover:bg-ink-100 dark:hover:bg-ink-800";
const navLinkActiveClass =
  "bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300";
const navLinkInactiveClass = "text-ink-600 dark:text-ink-300";

export function AppViewNav() {
  const { t } = useLocale();
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("header.navLabel")}
      className="flex justify-center"
    >
      <div className="inline-flex items-center gap-1 rounded-xl border border-ink-200/80 bg-ink-50/80 p-1 text-sm dark:border-ink-700/80 dark:bg-ink-800/50">
        <Link
          href="/"
          aria-current={pathname === "/" ? "page" : undefined}
          className={`${navLinkClass} ${
            pathname === "/" ? navLinkActiveClass : navLinkInactiveClass
          }`}
        >
          {t("header.metrics")}
        </Link>
        <Link
          href="/ranking"
          data-tour="ranking"
          aria-current={pathname === "/ranking" ? "page" : undefined}
          className={`${navLinkClass} ${
            pathname === "/ranking" ? navLinkActiveClass : navLinkInactiveClass
          }`}
        >
          {t("header.ranking")}
        </Link>
      </div>
    </nav>
  );
}
