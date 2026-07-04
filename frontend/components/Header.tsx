"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserMenu } from "@/components/UserMenu";
import { FranceFlagIcon } from "@/components/ui/FranceFlagIcon";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { APP_PAGE_SHELL_CLASS } from "@/lib/page-layout";

export function Header() {
  const { user, ready } = useAuth();
  const { t } = useLocale();
  const pathname = usePathname();
  const onLoginPage = pathname === "/login";

  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-white/75 shadow-sm backdrop-blur-xl dark:border-ink-800/80 dark:bg-ink-900/80">
      <div className={`${APP_PAGE_SHELL_CLASS} flex h-16 items-center justify-between gap-4 px-4 sm:px-6`}>
        <Link
          href="/"
          aria-label={t("header.brand")}
          className="group flex min-w-0 shrink-0 items-center gap-2.5 font-display text-lg font-bold tracking-tight text-ink-900 dark:text-ink-50"
        >
          <FranceFlagIcon className="h-8 w-8" title={t("header.brand")} />
          <span className="hidden sm:inline">{t("header.brand")}</span>
        </Link>

        <nav className="flex shrink-0 items-center gap-3 text-sm">
          {ready && user ? <UserMenu /> : null}
          {ready && user ? null : onLoginPage ? null : (
            <Link
              href="/login"
              className="rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-2 font-medium text-white shadow-sm transition hover:brightness-105"
            >
              {t("header.login")}
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
