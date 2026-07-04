"use client";

import { useEffect, useRef } from "react";
import { updateUserSettings } from "@/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { useTheme } from "@/lib/theme-context";

export function UserSettingsSync() {
  const { user, updateUser } = useAuth();
  const { locale, setLocale } = useLocale();
  const { theme, setTheme } = useTheme();
  const hydratedRef = useRef(false);
  const skipNextPatchRef = useRef(false);

  useEffect(() => {
    if (!user) {
      hydratedRef.current = false;
      return;
    }
    if (hydratedRef.current) return;

    skipNextPatchRef.current = true;
    if (user.locale !== locale) setLocale(user.locale);
    if (user.theme !== theme) setTheme(user.theme);
    hydratedRef.current = true;
  }, [user, locale, theme, setLocale, setTheme]);

  useEffect(() => {
    if (!user || !hydratedRef.current) return;
    if (skipNextPatchRef.current) {
      skipNextPatchRef.current = false;
      return;
    }
    if (user.locale === locale && user.theme === theme) return;

    void updateUserSettings({ locale, theme })
      .then(updateUser)
      .catch(() => {
        /* keep local preference if sync fails */
      });
  }, [user, locale, theme, updateUser]);

  return null;
}
