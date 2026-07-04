import type { MessageKey } from "@/lib/i18n";

const AUTH_ERROR_KEYS: Record<string, MessageKey> = {
  "Invalid email or password": "auth.invalidCredentials",
  "Email already registered": "auth.emailAlreadyRegistered",
  "Invalid request body": "auth.invalidRequest",
};

export function authErrorKey(message: string): MessageKey {
  return AUTH_ERROR_KEYS[message] ?? "auth.errorGeneric";
}
