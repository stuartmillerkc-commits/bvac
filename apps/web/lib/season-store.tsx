'use client';

/**
 * Client-side demo state shared by every page.
 *
 * The sample season is generated in the browser (deterministic, a few ms) and
 * the engine runs per division. Everything a person changes in the demo is an
 * "edit" layered on top of the generated season and saved to localStorage:
 * registrations added through the mock form, team changes (coach slot claims,
 * renames), division setting overrides, and fixed placements (admin locks,
 * published rounds). Nothing leaves the browser. Phase 1 swaps this for a real
 * backend behind the same hook.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  indexSeason,
  type CoachAssignment,
  type DivisionSettings,
  type GameTrack,
  type Household,
  type ID,
  type ISODateTime,
  type Person,
  type Placement,
  type PlacementRunResult,
  type Player,
  type Registration,
  type SeasonData,
  type SeasonIndex,
  type Team,
} from '@bvac/core';
import { placeDivision } from '@bvac/engine';
import { generateSeason } from '@bvac/seed';

const STORAGE_KEY = 'bvac-team-builder-demo-v1';

/** Records added during the demo (mock registrations, new coaches). */
export interface AddedRecords {
  people: Person[];
  households: Household[];
  players: Player[];
  registrations: Registration[];
  coachAssignments: CoachAssignment[];
  teams: Team[];
  /** New schedule positions, when a coach claims a slot and every track is taken. */
  gameTracks: GameTrack[];
}

/** A coach's note for the admins: a kid flagged for review, or a proposed swap. */
export interface CoachNote {
  id: ID;
  at: ISODateTime;
  authorPersonId: ID;
  teamId: ID;
  kind: 'flag' | 'swap';
  registrationId: ID;
  /** Swap only: the kid on the other team. */
  otherRegistrationId?: ID;
  text?: string;
  status: 'open' | 'done' | 'dismissed';
}

export interface DemoEdits {
  added: AddedRecords;
  /** Field changes to generated teams, by team id. */
  teamPatches: Record<ID, Partial<Team>>;
  /** Per-division setting overrides. */
  divisionSettings: Record<ID, Partial<DivisionSettings>>;
  /** Placements admins locked or published; the engine never moves these. */
  fixed: Placement[];
  /** Show the season as of this moment (registrations "trickling in"); null = all. */
  asOf: ISODateTime | null;
  /** Field changes to coach assignments (protected picks), by assignment id. */
  coachAssignmentPatches: Record<ID, Partial<CoachAssignment>>;
  /** Notes from coaches to admins. */
  coachNotes: CoachNote[];
  /** Per division, the division's fixed placements before each publish, for "Undo publish". */
  publishSnapshots: Record<ID, Placement[][]>;
}

const EMPTY_EDITS: DemoEdits = {
  added: { people: [], households: [], players: [], registrations: [], coachAssignments: [], teams: [], gameTracks: [] },
  teamPatches: {},
  divisionSettings: {},
  fixed: [],
  asOf: null,
  coachAssignmentPatches: {},
  coachNotes: [],
  publishSnapshots: {},
};

export interface SeasonState {
  /** Generated season with all demo edits applied. */
  data: SeasonData;
  index: SeasonIndex;
  /** Engine output per division, recomputed when inputs change. */
  results: Record<ID, PlacementRunResult>;
  edits: DemoEdits;
  /** Apply any change to the edits; saved automatically. */
  updateEdits: (fn: (prev: DemoEdits) => DemoEdits) => void;
  fixed: Placement[];
  setFixed: (next: Placement[]) => void;
  asOf: ISODateTime | null;
  setAsOf: (next: ISODateTime | null) => void;
  /** Add a family's records from the mock registration form. */
  addRecords: (records: Partial<AddedRecords>) => void;
  patchTeam: (teamId: ID, patch: Partial<Team>) => void;
  setDivisionSettings: (divisionId: ID, patch: Partial<DivisionSettings>) => void;
  resetDemo: () => void;
}

const SeasonContext = createContext<SeasonState | null>(null);

let cachedSeason: SeasonData | null = null;
function baseSeason(): SeasonData {
  cachedSeason ??= generateSeason();
  return cachedSeason;
}

function load(): DemoEdits {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DemoEdits>;
      return { ...EMPTY_EDITS, ...parsed, added: { ...EMPTY_EDITS.added, ...parsed.added } };
    }
  } catch {
    // Private windows or blocked storage: start fresh.
  }
  return EMPTY_EDITS;
}

function save(edits: DemoEdits) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(edits));
  } catch {
    // Ignore; the demo still works without persistence.
  }
}

/** Generated season + edits. Pure, so tests and future server code can reuse it. */
export function applyEdits(base: SeasonData, edits: DemoEdits): SeasonData {
  const a = edits.added;
  return {
    ...base,
    divisions: base.divisions.map((d) =>
      edits.divisionSettings[d.id] ? { ...d, settings: { ...d.settings, ...edits.divisionSettings[d.id] } } : d,
    ),
    teams: [...base.teams, ...a.teams].map((t) => (edits.teamPatches[t.id] ? { ...t, ...edits.teamPatches[t.id] } : t)),
    gameTracks: [...base.gameTracks, ...a.gameTracks],
    people: [...base.people, ...a.people],
    households: [...base.households, ...a.households],
    players: [...base.players, ...a.players],
    registrations: [...base.registrations, ...a.registrations],
    coachAssignments: [...base.coachAssignments, ...a.coachAssignments].map((c) =>
      edits.coachAssignmentPatches[c.id] ? { ...c, ...edits.coachAssignmentPatches[c.id] } : c,
    ),
  };
}

export function SeasonProvider({ children }: { children: ReactNode }) {
  const [edits, setEdits] = useState<DemoEdits>(EMPTY_EDITS);

  // Load saved edits after mount so the server render and first client render match.
  useEffect(() => {
    setEdits(load());
  }, []);

  const updateEdits = useCallback((fn: (prev: DemoEdits) => DemoEdits) => {
    setEdits((prev) => {
      const next = fn(prev);
      save(next);
      return next;
    });
  }, []);

  const data = useMemo(() => applyEdits(baseSeason(), edits), [edits]);
  const index = useMemo(() => indexSeason(data), [data]);

  const results = useMemo(() => {
    const out: Record<ID, PlacementRunResult> = {};
    for (const d of data.divisions) {
      out[d.id] = placeDivision({
        data,
        divisionId: d.id,
        round: 2,
        fixed: edits.fixed.filter((p) => index.registration.get(p.registrationId)?.divisionId === d.id),
        ...(edits.asOf ? { asOf: edits.asOf } : {}),
      });
    }
    return out;
  }, [data, index, edits.fixed, edits.asOf]);

  const value = useMemo<SeasonState>(
    () => ({
      data,
      index,
      results,
      edits,
      updateEdits,
      fixed: edits.fixed,
      setFixed: (next) => updateEdits((e) => ({ ...e, fixed: next })),
      asOf: edits.asOf,
      setAsOf: (next) => updateEdits((e) => ({ ...e, asOf: next })),
      addRecords: (records) =>
        updateEdits((e) => ({
          ...e,
          added: {
            people: [...e.added.people, ...(records.people ?? [])],
            households: [...e.added.households, ...(records.households ?? [])],
            players: [...e.added.players, ...(records.players ?? [])],
            registrations: [...e.added.registrations, ...(records.registrations ?? [])],
            coachAssignments: [...e.added.coachAssignments, ...(records.coachAssignments ?? [])],
            teams: [...e.added.teams, ...(records.teams ?? [])],
            gameTracks: [...e.added.gameTracks, ...(records.gameTracks ?? [])],
          },
        })),
      patchTeam: (teamId, patch) =>
        updateEdits((e) => ({ ...e, teamPatches: { ...e.teamPatches, [teamId]: { ...e.teamPatches[teamId], ...patch } } })),
      setDivisionSettings: (divisionId, patch) =>
        updateEdits((e) => ({
          ...e,
          divisionSettings: { ...e.divisionSettings, [divisionId]: { ...e.divisionSettings[divisionId], ...patch } },
        })),
      resetDemo: () => updateEdits(() => EMPTY_EDITS),
    }),
    [data, index, results, edits, updateEdits],
  );
  return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>;
}

export function useSeason(): SeasonState {
  const ctx = useContext(SeasonContext);
  if (!ctx) throw new Error('useSeason must be used inside <SeasonProvider>');
  return ctx;
}
