import { safeLocale } from './locale.js';

export interface CurrencyFormatOptions {
  symbol?: string;
  code?: string;
  locale?: string;
}

export function formatMoney(cents: number, opts: CurrencyFormatOptions = {}): string {
  const symbol = opts.symbol ?? 'KES';
  const locale = safeLocale(opts.locale);
  const units = cents / 100;
  
  const hasDecimals = cents % 100 !== 0;
  const formattedNumber = new Intl.NumberFormat(locale, {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(units);

  return `${symbol} ${formattedNumber}`;
}

export function parseMoneyToCents(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0) return null;
    return Math.round(input * 100);
  }

  const str = input.trim();
  if (!str) return null;

  // Remove currency symbol, whitespace, etc. Keep only digits, dots, commas, minus
  const cleaned = str.replace(/[^0-9.,-]/g, '');
  if (!cleaned || cleaned === '.' || cleaned === ',') return null;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let normalised = cleaned;

  if (lastComma > lastDot) {
    const afterComma = cleaned.slice(lastComma + 1);
    // Decimal comma (e.g. 1500,50 or 1.500,50)
    if (/^\d{1,2}$/.test(afterComma)) {
      normalised = cleaned.replace(/\./g, '').replace(/,/g, '.');
    } else {
      // Thousands separator comma (e.g. 1,500 or 1,500,000)
      normalised = cleaned.replace(/,/g, '');
    }
  } else if (lastDot > lastComma) {
    const afterDot = cleaned.slice(lastDot + 1);
    if (/^\d{1,2}$/.test(afterDot)) {
      // Decimal dot
      normalised = cleaned.replace(/,/g, '');
    } else {
      // Thousands separator dot (e.g. 1.500 or 1.500.000)
      normalised = cleaned.replace(/\./g, '');
    }
  } else {
    // Neither dot nor comma
    normalised = cleaned;
  }

  const num = parseFloat(normalised);
  if (Number.isNaN(num) || num < 0) return null;

  return Math.round(num * 100);
}

export function centsToDecimalString(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const fraction = abs % 100;
  return `${sign}${whole}.${fraction.toString().padStart(2, '0')}`;
}
