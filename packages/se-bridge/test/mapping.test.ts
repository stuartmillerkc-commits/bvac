import { describe, expect, it } from 'vitest';
import { IMPORT_FIELDS } from '@bvac/core';
import { formats, sampleReportHeaders, suggestMapping } from '../src';
import { sample } from './helpers';

describe('suggestMapping', () => {
  it('maps every field on the sample Saved Report headers correctly and leaves the extra columns alone', () => {
    const data = sample();
    const headers = sampleReportHeaders(data);
    const mapping = suggestMapping(headers);
    for (const field of IMPORT_FIELDS) expect(mapping[field], field).toBe(formats.reportHeader(field, data.season));
    const mapped = new Set(Object.values(mapping));
    for (const extra of Object.values(formats.REPORT_EXTRA_COLUMNS)) expect(mapped.has(extra), extra).toBe(false);
  });

  it('does not depend on column order', () => {
    const headers = sampleReportHeaders(sample());
    const reversed = suggestMapping([...headers].reverse());
    expect(reversed).toEqual(suggestMapping(headers));
  });

  it('ignores case, punctuation and the school year', () => {
    const mapping = suggestMapping([
      'PLAYER FIRST NAME',
      'player last name',
      'What age / grade is the player during the 2027-28 school year',
      '1st Choice Team',
      'sibling or friend (2)',
    ]);
    expect(mapping).toEqual({
      playerFirstName: 'PLAYER FIRST NAME',
      playerLastName: 'player last name',
      divisionAnswer: 'What age / grade is the player during the 2027-28 school year',
      firstChoiceTeam: '1st Choice Team',
      playerRequest2Type: 'sibling or friend (2)',
    });
  });

  it('uses synonyms for other exports', () => {
    const mapping = suggestMapping(['First Name', 'Last Name', 'DOB', 'Email Address', 'Grade', 'Confirmation Number', 'Second choice', 'Comments']);
    expect(mapping).toEqual({
      playerFirstName: 'First Name',
      playerLastName: 'Last Name',
      playerBirthdate: 'DOB',
      guardianEmail: 'Email Address',
      divisionAnswer: 'Grade',
      externalId: 'Confirmation Number',
      secondChoiceTeam: 'Second choice',
      requestText: 'Comments',
    });
  });

  it('tolerates small typos', () => {
    expect(suggestMapping(['Player Frist Name', 'Practise days available'])).toEqual({
      playerFirstName: 'Player Frist Name',
      practiceDays: 'Practise days available',
    });
  });

  it('never swaps numbered fields', () => {
    const mapping = suggestMapping(['Player request 2', 'Sibling or friend? (2)']);
    expect(mapping).toEqual({ playerRequest2Name: 'Player request 2', playerRequest2Type: 'Sibling or friend? (2)' });
  });

  it('leaves unrelated headers unmapped and uses each header once', () => {
    const mapping = suggestMapping(['Waiver Accepted', 'Amount Paid', 'Medical Notes', 'Email', 'Email']);
    expect(mapping).toEqual({ guardianEmail: 'Email' });
  });
});
