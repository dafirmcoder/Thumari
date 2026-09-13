export const DEFAULT_LOCALE = 'en-GB';

export function safeLocale(locale: string | undefined, fallback = DEFAULT_LOCALE): string {
  if (!locale) return fallback;
  try {
    const list = Intl.getCanonicalLocales(locale);
    const first = list[0];
    if (!first) return fallback;
    const resolved = new Intl.DateTimeFormat(first).resolvedOptions().locale;
    return resolved.toLowerCase() === first.toLowerCase() ? first : fallback;
  } catch {
    return fallback;
  }
}
