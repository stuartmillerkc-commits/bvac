/**
 * The question pack: what a BVAC admin types into SportsEngine's
 * Registration Builder so the Saved Report carries everything the companion
 * needs (docs/SPORTSENGINE.md "Better SportsEngine questions").
 */
import { fullName, headCoach, indexSeason, type ID, type ImportField, type SeasonData } from '@bvac/core';
import { practiceTimeOptions, selectableTeams, sortedDivisions, teamOption } from './answers';
import {
  COACH_REQUEST_ANSWERS,
  divisionAnswer,
  FACTOR_ANSWERS,
  ONLY_THESE_DAYS_ANSWERS,
  PRACTICE_DAY_OPTIONS,
  PRACTICE_TIMES_NONE,
  practiceTimeLabel,
  QUESTION_TYPES,
  reportHeader,
  REQUEST_TYPE_ANSWERS,
  SEASONS_PLAYED_OPTIONS,
  SEAT_LIMIT_NOTE,
} from './formats';

export type QuestionType = keyof typeof QUESTION_TYPES;

export interface PackOption {
  label: string;
  /** Seat limit to set on this answer's item (first come, first served divisions). */
  seatLimit?: number;
}

export interface PackDivisionOptions {
  divisionId: ID;
  divisionName: string;
  /** Conditional logic: when to show this division's copy of the question. */
  showWhen: string;
  options: PackOption[];
  notes: string[];
}

export interface PackQuestion {
  /** Import field the answer feeds; the question title is that field's report header. */
  field: ImportField;
  title: string;
  type: QuestionType;
  required: boolean;
  /** False for questions already on BVAC's form. */
  isNew: boolean;
  help?: string;
  /** Options shared by every division. */
  options?: PackOption[];
  /** Options that differ per division, shown with conditional logic. */
  byDivision?: PackDivisionOptions[];
  notes: string[];
}

/** Player request slots the importer reads (IMPORT_FIELDS has two). */
const REQUEST_SLOTS: [ImportField, ImportField][] = [
  ['playerRequest1Name', 'playerRequest1Type'],
  ['playerRequest2Name', 'playerRequest2Type'],
];

/** Structured question pack, in form order. */
export function questionPackItems(data: SeasonData): PackQuestion[] {
  const index = indexSeason(data);
  const divisions = sortedDivisions(data);
  const title = (f: ImportField) => reportHeader(f, data.season);
  const showWhen = (d: (typeof divisions)[number]) => `"${title('divisionAnswer')}" is "${divisionAnswer(d)}"`;
  const opts = (labels: string[]): PackOption[] => labels.map((label) => ({ label }));

  const qs: PackQuestion[] = [];
  qs.push({
    field: 'divisionAnswer',
    title: title('divisionAnswer'),
    type: 'pulldown',
    required: true,
    isNew: false,
    options: opts(divisions.map(divisionAnswer)),
    notes: ['Already on the form. Keep these answers exactly: the team questions below show or hide based on them.'],
  });
  qs.push({
    field: 'practiceDays',
    title: title('practiceDays'),
    type: 'checkbox',
    required: true,
    isNew: true,
    help: 'Check every day your player could practice.',
    options: opts(PRACTICE_DAY_OPTIONS.map((o) => o.label)),
    notes: [],
  });
  qs.push({
    field: 'onlyTheseDays',
    title: title('onlyTheseDays'),
    type: 'radio',
    required: true,
    isNew: true,
    options: opts([ONLY_THESE_DAYS_ANSWERS.yes, ONLY_THESE_DAYS_ANSWERS.no]),
    notes: ['"Yes" is the one hard limit the team builder never breaks.'],
  });
  qs.push({
    field: 'practiceTimes',
    title: title('practiceTimes'),
    type: 'checkbox',
    required: true,
    isNew: true,
    help: 'Check every practice time that works on the days above.',
    byDivision: divisions.map((d) => ({
      divisionId: d.id,
      divisionName: d.name,
      showWhen: showWhen(d),
      options: opts([...practiceTimeOptions(data, d.id).map((r) => practiceTimeLabel(r.start, r.end)), PRACTICE_TIMES_NONE]),
      notes: [],
    })),
    notes: [
      'These are the practice times coaches can claim in each division.',
      `Keep "${PRACTICE_TIMES_NONE}" and make the question required, so a blank answer can't be mistaken for "any time".`,
    ],
  });

  for (const [field, rank] of [['firstChoiceTeam', 1], ['secondChoiceTeam', 2]] as const) {
    qs.push({
      field,
      title: title(field),
      type: 'pulldown',
      required: false,
      isNew: true,
      help:
        rank === 1
          ? 'Pick the team option you want most (see every option in the Team Finder). Leave blank if any team on your days is fine.'
          : 'Optional: your next choice if the first is full.',
      byDivision: divisions.map((d) => {
        const fcfs = d.settings.model === 'fcfs';
        const notes: string[] = [];
        if (rank === 1 && fcfs) notes.push(`Make this copy required: the answer is what holds the seat. ${SEAT_LIMIT_NOTE(d.settings.teamSize.max)}`);
        if (rank === 1 && !fcfs) notes.push('No seat limit: in this division seats are assigned by the placement rules, so counts are estimates.');
        return {
          divisionId: d.id,
          divisionName: d.name,
          showWhen: showWhen(d),
          options: selectableTeams(data, d.id).map((t) => ({
            label: teamOption(index, t),
            ...(rank === 1 && fcfs ? { seatLimit: d.settings.teamSize.max } : {}),
          })),
          notes,
        };
      }),
      notes:
        rank === 1
          ? ['First come, first served divisions hold a seat at payment through the seat limit on this answer.']
          : [],
    });
  }

  qs.push({
    field: 'coachRequest',
    title: title('coachRequest'),
    type: 'pulldown',
    required: false,
    isNew: true,
    byDivision: divisions.map((d) => {
      const coaches = d.settings.showCoachNames
        ? selectableTeams(data, d.id)
            .map((t) => headCoach(index, t.id))
            .filter((p) => !!p)
            .map((p) => fullName(p!))
        : [];
      return {
        divisionId: d.id,
        divisionName: d.name,
        showWhen: showWhen(d),
        options: opts([...new Set(coaches)].concat([COACH_REQUEST_ANSWERS.sameAsLastSeason, COACH_REQUEST_ANSWERS.noPreference])),
        notes: d.settings.showCoachNames ? [] : ['Coach names are hidden for this division, so only the two general answers are offered.'],
      };
    }),
    notes: [],
  });

  const maxRequests = Math.min(REQUEST_SLOTS.length, Math.max(0, ...divisions.map((d) => d.settings.maxPlayerRequests)));
  REQUEST_SLOTS.slice(0, maxRequests).forEach(([nameField, typeField], i) => {
    qs.push({
      field: nameField,
      title: title(nameField),
      type: 'text',
      required: false,
      isNew: true,
      help: i === 0 ? "A brother, sister or friend your player wants to be with. First and last name, as they'd register." : 'Another player request (optional).',
      notes: [],
    });
    qs.push({
      field: typeField,
      title: title(typeField),
      type: 'radio',
      required: false,
      isNew: true,
      options: opts([REQUEST_TYPE_ANSWERS.sibling, REQUEST_TYPE_ANSWERS.friend]),
      notes: [`Show only when "${title(nameField)}" is filled in.`],
    });
  });

  qs.push({
    field: 'mostImportant',
    title: title('mostImportant'),
    type: 'pulldown',
    required: false,
    isNew: true,
    help: 'When we can’t give everything, what should we protect first?',
    options: opts(Object.values(FACTOR_ANSWERS)),
    notes: ['SportsEngine has no drag-to-rank, so a 1st and 2nd pulldown stand in for it.'],
  });
  qs.push({
    field: 'secondMostImportant',
    title: title('secondMostImportant'),
    type: 'pulldown',
    required: false,
    isNew: true,
    options: opts(Object.values(FACTOR_ANSWERS)),
    notes: [],
  });
  qs.push({
    field: 'seasonsPlayed',
    title: title('seasonsPlayed'),
    type: 'pulldown',
    required: false,
    isNew: true,
    options: opts(SEASONS_PLAYED_OPTIONS),
    notes: ['Needed only until the team builder has past rosters to work from.'],
  });
  qs.push({
    field: 'lastSeasonCoach',
    title: title('lastSeasonCoach'),
    type: 'text',
    required: false,
    isNew: true,
    notes: [],
  });
  qs.push({
    field: 'requestText',
    title: title('requestText'),
    type: 'text',
    required: false,
    isNew: false,
    notes: ['Already on the form (long text). Keep it for anything else.'],
  });
  return qs;
}

function renderOptions(options: readonly PackOption[], indent: string): string[] {
  return options.map((o) => `${indent}- ${o.label}${o.seatLimit !== undefined ? `  [seat limit: ${o.seatLimit}]` : ''}`);
}

/** The question pack as plain text to paste from. */
export function questionPack(data: SeasonData): string {
  const items = questionPackItems(data);
  const lines: string[] = [
    `SportsEngine registration questions: ${data.season.name}`,
    '',
    'Add these to the soccer registration in the Registration Builder. Use each title exactly as written:',
    "it becomes the column name in the Saved Report, and the team builder's import looks for it.",
    'Where options differ by division, add one copy of the question per division with conditional logic',
    '(the import combines the copies).',
  ];
  let n = 0;
  for (const q of items) {
    lines.push('');
    const label = q.isNew ? `${++n}.` : '(existing)';
    lines.push(`${label} ${q.title}`);
    lines.push(`   Type: ${QUESTION_TYPES[q.type]}${q.required ? ' · required' : ' · optional'}`);
    if (q.help) lines.push(`   Help text: ${q.help}`);
    if (q.options?.length) {
      lines.push('   Options:');
      lines.push(...renderOptions(q.options, '   '));
    }
    for (const d of q.byDivision ?? []) {
      lines.push(`   ${d.divisionName}: show when ${d.showWhen}`);
      if (d.options.length) lines.push(...renderOptions(d.options, '     '));
      else lines.push('     (no options yet)');
      for (const note of d.notes) lines.push(`     Note: ${note}`);
    }
    for (const note of q.notes) lines.push(`   Note: ${note}`);
  }
  lines.push('');
  lines.push('Last page text (editable in SportsEngine): "Want to rank every team option or check a friend request? Continue to team preferences."');
  return lines.join('\n') + '\n';
}
