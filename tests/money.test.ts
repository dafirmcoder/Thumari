import { describe, it, expect } from 'vitest';
import { formatMoney, parseMoneyToCents, centsToDecimalString } from '../src/lib/money.js';

describe('Money utilities', () => {
  it('formats cents into localized currency strings', () => {
    expect(formatMoney(150000, { symbol: 'TSh', locale: 'en-GB' })).toBe('TSh 1,500');
    expect(formatMoney(150050, { symbol: 'TSh', locale: 'en-GB' })).toBe('TSh 1,500.50');
    expect(formatMoney(0, { symbol: 'TSh', locale: 'en-GB' })).toBe('TSh 0');
  });

  it('parses formatted strings and numbers to cents', () => {
    expect(parseMoneyToCents('1,500')).toBe(150000);
    expect(parseMoneyToCents('1,500.50')).toBe(150050);
    expect(parseMoneyToCents('50000')).toBe(5000000);
    expect(parseMoneyToCents(100.25)).toBe(10025);
    expect(parseMoneyToCents('')).toBeNull();
    expect(parseMoneyToCents('invalid')).toBeNull();
  });

  it('converts cents to decimal string', () => {
    expect(centsToDecimalString(150000)).toBe('1500.00');
    expect(centsToDecimalString(150050)).toBe('1500.50');
    expect(centsToDecimalString(-250)).toBe('-2.50');
  });
});
