// @ts-nocheck -- Bun test-only runtime hooks are not part of the app's TypeScript project.
import { describe, expect, test } from 'bun:test';

import { getPeriodWindow, getTimeLeft } from '../shared/leaguePeriod';

describe('League selected period query boundaries', () => {
  test('month begins on the first and ends today', () => {
    expect(getPeriodWindow('month', new Date(2026, 9, 5))).toEqual({
      startDate: '2026-10-01',
      endDate: '2026-10-05',
      yearMonth: '2026-10',
    });
  });
  test('week uses Monday, including a Sunday crossing a month', () => {
    expect(getPeriodWindow('week', new Date(2026, 10, 1))).toEqual({
      startDate: '2026-10-26',
      endDate: '2026-11-01',
      yearMonth: '2026-11',
    });
  });
  test('Monday starts a new week', () => {
    expect(getPeriodWindow('week', new Date(2026, 9, 5)).startDate).toBe('2026-10-05');
  });
  test('today and month key cross the year together', () => {
    expect(getPeriodWindow('today', new Date(2027, 0, 1))).toEqual({
      startDate: '2027-01-01',
      endDate: '2027-01-01',
      yearMonth: '2027-01',
    });
  });
  test('leap-year month countdown includes its last day', () => {
    expect(getTimeLeft('month', new Date(2028, 1, 28))).toBe('2 days left');
    expect(getTimeLeft('month', new Date(2028, 1, 29))).toBe('1 day left');
  });
  test('week countdown runs from seven on Monday to one on Sunday', () => {
    expect(getTimeLeft('week', new Date(2026, 9, 5))).toBe('7 days left');
    expect(getTimeLeft('week', new Date(2026, 9, 11))).toBe('1 day left');
  });
  test('today countdown handles hour and minute boundaries', () => {
    expect(getTimeLeft('today', new Date(2026, 9, 5, 23, 0))).toBe('1 hour left');
    expect(getTimeLeft('today', new Date(2026, 9, 5, 22, 30))).toBe('1h 30m left');
    expect(getTimeLeft('today', new Date(2026, 9, 5, 23, 59, 59))).toBe('1 min left');
  });
});
