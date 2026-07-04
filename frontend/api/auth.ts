import { apiGet, apiPatch, apiPost } from "./client";
import type { AuthUser, SearchPreferences } from "./types";

export function fetchCurrentUser(): Promise<AuthUser> {
  return apiGet<AuthUser>("/auth/me");
}

export function registerUser(params: {
  email: string;
  password: string;
  display_name?: string;
  locale?: "en" | "fr";
  theme?: "light" | "dark";
}): Promise<AuthUser> {
  return apiPost<AuthUser>("/auth/register", params);
}

export function loginUser(params: {
  email: string;
  password: string;
}): Promise<AuthUser> {
  return apiPost<AuthUser>("/auth/login", params);
}

export function logoutUser(): Promise<{ ok: boolean }> {
  return apiPost<{ ok: boolean }>("/auth/logout");
}

export function updateUserSettings(params: {
  locale?: "en" | "fr";
  theme?: "light" | "dark";
}): Promise<AuthUser> {
  return apiPatch<AuthUser>("/auth/me/settings", params);
}

export function saveUserPreferences(
  preferences: SearchPreferences,
): Promise<AuthUser> {
  return apiPatch<AuthUser>("/auth/me/preferences", preferences);
}
