"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ApiError,
  fetchCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  saveUserPreferences,
  type AuthUser,
  type SearchPreferences,
} from "@/api";
import type { MessageKey } from "@/lib/i18n";
import { authErrorKey } from "@/lib/auth-errors";

export type { AuthUser };

type AuthContextValue = {
  user: AuthUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<MessageKey | null>;
  register: (
    email: string,
    password: string,
    options?: {
      displayName?: string;
      locale?: "en" | "fr";
      theme?: "light" | "dark";
    },
  ) => Promise<MessageKey | null>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (user: AuthUser) => void;
  savePreferences: (preferences: SearchPreferences) => Promise<MessageKey | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function authErrorMessage(error: unknown): MessageKey {
  if (error instanceof ApiError) return authErrorKey(error.message);
  if (error instanceof Error) return authErrorKey(error.message);
  return "auth.errorGeneric";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  const refreshUser = useCallback(async () => {
    try {
      const me = await fetchCurrentUser();
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchCurrentUser()
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const me = await loginUser({ email, password });
      setUser(me);
      return null;
    } catch (error) {
      return authErrorMessage(error);
    }
  }, []);

  const register = useCallback(
    async (
      email: string,
      password: string,
      options?: {
        displayName?: string;
        locale?: "en" | "fr";
        theme?: "light" | "dark";
      },
    ) => {
      try {
        const me = await registerUser({
          email,
          password,
          display_name: options?.displayName,
          locale: options?.locale,
          theme: options?.theme,
        });
        setUser(me);
        return null;
      } catch (error) {
        return authErrorMessage(error);
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } catch {
      /* clear local session even if API fails */
    }
    setUser(null);
  }, []);

  const updateUser = useCallback((next: AuthUser) => {
    setUser(next);
  }, []);

  const savePreferences = useCallback(
    async (preferences: SearchPreferences) => {
      try {
        const me = await saveUserPreferences(preferences);
        setUser(me);
        return null;
      } catch (error) {
        return authErrorMessage(error);
      }
    },
    [],
  );

  const value = useMemo(
    () => ({
      user,
      ready,
      login,
      register,
      logout,
      refreshUser,
      updateUser,
      savePreferences,
    }),
    [user, ready, login, register, logout, refreshUser, updateUser, savePreferences],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
