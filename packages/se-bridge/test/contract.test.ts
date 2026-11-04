import { describe, expect, it } from 'vitest';
import { BRIDGE_IS_STUB, bridge } from '../src';
import { sample } from './helpers';

describe('bridge contract', () => {
  it('exposes every BridgeApi function', () => {
    for (const name of ['suggestMapping', 'importRegistrations', 'exportTeamsCsv', 'exportScheduleCsv', 'rosterList', 'questionPack'] as const) {
      expect(typeof bridge[name]).toBe('function');
    }
    expect(BRIDGE_IS_STUB).toBe(false);
  });

  it('runs every function on the sample season without throwing', () => {
    const data = sample();
    expect(bridge.suggestMapping(['Player First Name'])).toEqual({ playerFirstName: 'Player First Name' });
    expect(bridge.importRegistrations([], {}, data).created).toBe(0);
    expect(bridge.exportTeamsCsv(data, data.teams)).toMatch(/^Season,/);
    expect(bridge.exportScheduleCsv(data, data.teams, [])).toMatch(/^Event Type,/);
    expect(bridge.rosterList(data, [])).toEqual([]);
    expect(bridge.questionPack(data)).toMatch(/^SportsEngine registration questions/);
  });
});
