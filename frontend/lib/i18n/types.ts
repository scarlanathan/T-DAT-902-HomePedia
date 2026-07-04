export type Locale = "en" | "fr";

export const INTL_LOCALE: Record<Locale, string> = {
  en: "en-US",
  fr: "fr-FR",
};

export type NestedKeyOf<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : NestedKeyOf<T[K], `${Prefix}${K}.`>;
}[keyof T & string];
