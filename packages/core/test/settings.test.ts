import { describe, expect, it } from 'vitest';
import { completeFactorRanking, defaultDivisionSettings, factorMultiplier, gradeLabel } from '../src';

describe('settings', () => {
  it('uses the design doc defaults', () => {
    const s = defaultDivisionSettings({ min: 8, preferred: 10, max: 12 });
    expect(s.priority.earlyWindow).toBe(30);
    expect(s.factorWeights).toEqual({ practiceTime: 40, coach: 25, friends: 20, lastTeam: 15 });
    expect(s.model).toBe('hybrid');
    expect(defaultDivisionSettings({ min: 1, preferred: 2, max: 3 }, { model: 'fcfs' }).model).toBe('fcfs');
  });

  it('turns a family ranking into multipliers 4/3/2/1', () => {
    expect(factorMultiplier(['friends', 'coach'], 'friends')).toBe(4);
    expect(factorMultiplier(['friends', 'coach'], 'coach')).toBe(3);
    expect(factorMultiplier(['friends', 'coach'], 'lastTeam')).toBe(1);
    expect(completeFactorRanking(['coach'])).toEqual(['coach', 'practiceTime', 'friends', 'lastTeam']);
  });

  it('labels grades', () => {
    expect([-2, -1, 0, 1, 2, 3, 11].map(gradeLabel)).toEqual(['Age 3', 'Age 4', 'K', '1st', '2nd', '3rd', '11th']);
  });
});
