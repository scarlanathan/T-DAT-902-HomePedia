"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { useTheme } from "@/lib/theme-context";

export default function SignupPage() {
  const { user, ready, register } = useAuth();
  const { locale, t } = useLocale();
  const { theme } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace("/");
  }, [ready, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (password.length < 8) {
      setMessage(t("signup.passwordTooShort"));
      return;
    }
    setSubmitting(true);
    const error = await register(email, password, {
      displayName: displayName.trim() || undefined,
      locale,
      theme,
    });
    setSubmitting(false);
    if (error) {
      setMessage(t(error));
      return;
    }
    router.replace("/");
  }

  if (!ready) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-ink-700 dark:text-ink-300">
        {t("common.loading")}
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-ink-700 dark:text-ink-300">
        {t("common.redirecting")}
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-xl font-semibold text-ink-900 dark:text-ink-50">
        {t("signup.title")}
      </h1>
      <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
        {t("signup.description")}
      </p>
      <form
        onSubmit={onSubmit}
        className="mt-8 space-y-4 rounded-xl border border-ink-200 bg-surface p-6 shadow-sm dark:border-ink-700 dark:bg-ink-900/90"
      >
        <label className="block text-sm font-medium text-ink-700 dark:text-ink-300">
          {t("signup.displayName")}
          <input
            type="text"
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="hp-input mt-1"
          />
        </label>
        <label className="block text-sm font-medium text-ink-700 dark:text-ink-300">
          {t("signup.email")}
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="hp-input mt-1"
            required
          />
        </label>
        <label className="block text-sm font-medium text-ink-700 dark:text-ink-300">
          {t("signup.password")}
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="hp-input mt-1"
            minLength={8}
            required
          />
        </label>
        {message ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {message}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-accent py-2.5 font-medium text-white transition hover:bg-blue-600 disabled:opacity-60"
        >
          {submitting ? t("common.loading") : t("signup.submit")}
        </button>
        <p className="text-center text-sm text-ink-600 dark:text-ink-300">
          {t("signup.haveAccount")}{" "}
          <Link href="/login" className="font-medium text-brand-600 hover:underline dark:text-brand-300">
            {t("signup.logInLink")}
          </Link>
        </p>
      </form>
    </div>
  );
}
