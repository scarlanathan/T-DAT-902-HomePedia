"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type PreferencesModalContextValue = {
  open: boolean;
  openPreferences: () => void;
  closePreferences: () => void;
};

const PreferencesModalContext =
  createContext<PreferencesModalContextValue | null>(null);

export function PreferencesModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const openPreferences = useCallback(() => setOpen(true), []);
  const closePreferences = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ open, openPreferences, closePreferences }),
    [open, openPreferences, closePreferences],
  );

  return (
    <PreferencesModalContext.Provider value={value}>
      {children}
    </PreferencesModalContext.Provider>
  );
}

export function usePreferencesModal(): PreferencesModalContextValue {
  const ctx = useContext(PreferencesModalContext);
  if (!ctx)
    throw new Error(
      "usePreferencesModal must be used within PreferencesModalProvider",
    );
  return ctx;
}
