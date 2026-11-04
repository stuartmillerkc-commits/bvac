import { describe, expect, it } from 'vitest';
import { bridge } from '../src';

describe('bridge contract', () => {
  it('exposes every BridgeApi function', () => {
    for (const name of ['suggestMapping', 'importRegistrations', 'exportTeamsCsv', 'exportScheduleCsv', 'rosterList', 'questionPack'] as const) {
      expect(typeof bridge[name]).toBe('function');
    }
  });
});
