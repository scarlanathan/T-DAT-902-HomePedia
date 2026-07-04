import { en, type Messages } from "./messages/en";
import { fr } from "./messages/fr";
import type { Locale, NestedKeyOf } from "./types";

export type MessageKey = NestedKeyOf<Messages>;
export type { Locale, Messages };

export const MESSAGES: Record<Locale, Messages> = { en, fr };

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale];
}

function resolvePath(messages: Messages, key: string): string | undefined {
  const parts = key.split(".");
  let current: unknown = messages;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const template = resolvePath(getMessages(locale), key) ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] != null ? String(vars[name]) : `{${name}}`,
  );
}
