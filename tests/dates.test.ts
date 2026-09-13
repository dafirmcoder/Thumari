import { describe, it, expect } from 'vitest';
import {
  periodKey,
  periodKeyToStart,
  formatDate,
  calendarDaysBetween,
  toDateInputValue,
  fromDateInputValue,
} from '../src/lib/dates.js';

const TZ = 'Africa/Dar_es_Salaam';

describe('Date & Calendar utilities', () => {
  it('generates consistent YYYY-MM period keys', () => {
    const d = new Date('2026-09-13T10:00:00Z');
    expect(periodKey(d, TZ)).toBe('2026-09');
  });

  it('converts period key to start date', () => {
    const start = periodKeyToStart('2026-09', TZ);
    expect(start).not.toBeNull();
    expect(periodKey(start!, TZ)).toBe('2026-09');
  });

  it('computes days between calendar dates', () => {
    const d1 = new Date('2026-09-01T00:00:00Z');
    const d2 = new Date('2026-09-16T00:00:00Z');
    expect(calendarDaysBetween(d1, d2, TZ)).toBe(15);
  });

  it('handles HTML date input values', () => {
    const d = fromDateInputValue('2026-09-13', TZ);
    expect(d).not.toBeNull();
    expect(toDateInputValue(d!, TZ)).toBe('2026-09-13');
  });
});
