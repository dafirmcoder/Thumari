import { safeLocale } from './locale.js';

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = dtfCache.get(timeZone);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      f = new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    }
    dtfCache.set(timeZone, f);
  }
  return f;
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  let hour = get('hour');
  if (hour === 24) hour = 0;
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour,
    minute: get('minute'),
    second: get('second'),
  };
}

function offsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

export function zonedTimeToInstant(wall: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number }, timeZone: string): Date {
  const hour = wall.hour ?? 0;
  const minute = wall.minute ?? 0;
  const second = wall.second ?? 0;
  const utcGuess = Date.UTC(wall.year, wall.month - 1, wall.day, hour, minute, second);
  let result = utcGuess - offsetMs(new Date(utcGuess), timeZone);
  result = utcGuess - offsetMs(new Date(result), timeZone);
  return new Date(result);
}

export function startOfDay(date: Date, timeZone: string): Date {
  const p = zonedParts(date, timeZone);
  return zonedTimeToInstant({ year: p.year, month: p.month, day: p.day }, timeZone);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function calendarAddMonths(year: number, month: number, day: number, addMonths: number): { year: number; month: number; day: number } {
  const zeroBased = (month - 1) + addMonths;
  const y = year + Math.floor(zeroBased / 12);
  const m = ((zeroBased % 12) + 12) % 12;
  const lastDay = daysInMonth(y, m + 1);
  return { year: y, month: m + 1, day: Math.min(day, lastDay) };
}

export function installmentDueDate(firstDueDate: Date, installmentIndex: number, timeZone: string): Date {
  const p = zonedParts(firstDueDate, timeZone);
  const next = calendarAddMonths(p.year, p.month, p.day, installmentIndex);
  return zonedTimeToInstant({ year: next.year, month: next.month, day: next.day, hour: p.hour, minute: p.minute }, timeZone);
}

export function periodKey(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${p.month.toString().padStart(2, '0')}`;
}

export function periodKeyToStart(period: string, timeZone: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return zonedTimeToInstant({ year, month, day: 1 }, timeZone);
}

export function calendarDaysBetween(from: Date, to: Date, timeZone: string): number {
  const a = startOfDay(from, timeZone).getTime();
  const b = startOfDay(to, timeZone).getTime();
  return Math.round((b - a) / 86400000);
}

export function toDateInputValue(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${p.month.toString().padStart(2, '0')}-${p.day.toString().padStart(2, '0')}`;
}

export function fromDateInputValue(str: string, timeZone: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return zonedTimeToInstant({ year, month, day }, timeZone);
}

export function formatDate(date: Date | string | null | undefined, timeZone = 'Africa/Nairobi', locale = 'en-GB'): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  const loc = safeLocale(locale);
  return new Intl.DateTimeFormat(loc, {
    timeZone,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(date: Date | string | null | undefined, timeZone = 'Africa/Nairobi', locale = 'en-GB'): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  const loc = safeLocale(locale);
  return new Intl.DateTimeFormat(loc, {
    timeZone,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}


export function formatPeriodLabel(period: string, timeZone: string, locale = 'en-GB'): string {
  const start = periodKeyToStart(period, timeZone);
  if (!start) return period;
  const loc = safeLocale(locale);
  return new Intl.DateTimeFormat(loc, {
    timeZone,
    month: 'short',
    year: 'numeric',
  }).format(start);
}
