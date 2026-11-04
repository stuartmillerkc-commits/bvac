import { describe, expect, it } from 'vitest';
import { addDays, fitsAvailability, formatDate, formatTime, formatWindow, toMinutes, weekdayOf, windowsOverlap } from '../src';

describe('time helpers', () => {
  it('converts and formats times', () => {
    expect(toMinutes('17:30')).toBe(1050);
    expect(formatTime(1050)).toBe('5:30pm');
    expect(formatTime(540)).toBe('9am');
    expect(formatTime(720)).toBe('12pm');
    expect(() => toMinutes('25:00')).toThrow();
  });

  it('formats windows compactly', () => {
    expect(formatWindow({ day: 'tue', start: 1050, end: 1110 })).toBe('Tue 5:30–6:30pm');
    expect(formatWindow({ day: 'sat', start: 660, end: 780 })).toBe('Sat 11am–1pm');
  });

  it('handles dates without timezone drift', () => {
    expect(formatDate('2027-04-03')).toBe('Sat Apr 3');
    expect(weekdayOf('2027-04-03')).toBe('sat');
    expect(addDays('2027-02-27', 2)).toBe('2027-03-01');
  });

  it('checks availability fit', () => {
    const practice = { day: 'tue' as const, start: 1050, end: 1110 };
    expect(fitsAvailability(practice, [{ day: 'tue', start: 1020, end: 1140 }])).toBe(true);
    expect(fitsAvailability(practice, [{ day: 'tue', start: 1080, end: 1200 }])).toBe(false);
    expect(fitsAvailability(practice, [{ day: 'wed', start: 900, end: 1200 }])).toBe(false);
    expect(windowsOverlap(practice, { day: 'tue', start: 1100, end: 1200 })).toBe(true);
  });
});
