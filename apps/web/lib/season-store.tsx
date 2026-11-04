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
  type Game,
  type GameTrack,
  type Household,
  type ID,
  type ISODateTime,
  type Person,
  type Placement,
  type PlacementRunResult,
  type Player,
  type Registration,
  type ScheduleBuildResult,
  type SeasonData,
  type SeasonIndex,
  type Team,
} from '@bvac/core';
import { placeDivision } from '@bvac/engine';
import { buildSeasonSchedules } from '@bvac/schedule';
import { applyImport } from '@bvac/se-bridge';
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
  /** Field changes to registrations (generated or added), by id: e.g. the family preferences page. */
  registrationPatches: Record<ID, Partial<Registration>>;
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
  /** Records from SportsEngine imports, merged by id over everything above (new and updated). */
  imported: ImportedRecords;
}

/** Upserts from the admin Import page (the bridge's `ImportResult.upserts`). */
export interface ImportedRecords {
  people: Person[];
  households: Household[];
  players: Player[];
  registrations: Registration[];
}

const EMPTY_EDITS: DemoEdits = {
  added: { people: [], households: [], players: [], registrations: [], coachAssignments: [], teams: [], gameTracks: [] },
  teamPatches: {},
  registrationPatches: {},
  divisionSettings: {},
  fixed: [],
  asOf: null,
  coachAssignmentPatches: {},
  coachNotes: [],
  publishSnapshots: {},
  imported: { people: [], households: [], players: [], registrations: [] },
};

export interface SeasonState {
  /** Generated season with all demo edits applied. */
  data: SeasonData;
  index: SeasonIndex;
  /** Engine output per division, recomputed when inputs change. */
  results: Record<ID, PlacementRunResult>;
  /** Game schedule per division from the schedule builder (by schedule position; stable as kids move). */
  schedules: ScheduleBuildResult[];
  /** Every game in the season, all divisions. */
  games: Game[];
  /** Plain-words game pattern per game track ("Mostly 9am · 2 games at 10am"). */
  trackDescriptions: Map<ID, string>;
  edits: DemoEdits;
  /** False until saved edits are read from localStorage after mount (pages can wait before saying "not found"). */
  loaded: boolean;
  /** Apply any change to the edits; saved automatically. */
  updateEdits: (fn: (prev: DemoEdits) => DemoEdits) => void;
  fixed: Placement[];
  setFixed: (next: Placement[]) => void;
  asOf: ISODateTime | null;
  setAsOf: (next: ISODateTime | null) => void;
  /** Add a family's records from the mock registration form. */
  addRecords: (records: Partial<AddedRecords>) => void;
  patchTeam: (teamId: ID, patch: Partial<Team>) => void;
  /** Update fields of one registration (family preferences, confirmed friend matches). */
  patchRegistration: (registrationId: ID, patch: Partial<Registration>) => void;
  setDivisionSettings: (divisionId: ID, patch: Partial<DivisionSettings>) => void;
  /** Merge records from a SportsEngine import (new ones appended, existing ones replaced). */
  applyImported: (records: ImportedRecords) => void;
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
      return {
        ...EMPTY_EDITS,
        ...parsed,
        added: { ...EMPTY_EDITS.added, ...parsed.added },
        imported: { ...EMPTY_EDITS.imported, ...parsed.imported },
      };
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
  const merged: SeasonData = {
    ...base,
    divisions: base.divisions.map((d) =>
      edits.divisionSettings[d.id] ? { ...d, settings: { ...d.settings, ...edits.divisionSettings[d.id] } } : d,
    ),
    teams: [...base.teams, ...a.teams].map((t) => (edits.teamPatches[t.id] ? { ...t, ...edits.teamPatches[t.id] } : t)),
    gameTracks: [...base.gameTracks, ...a.gameTracks],
    people: [...base.people, ...a.people],
    households: [...base.households, ...a.households],
    players: [...base.players, ...a.players],
    registrations: [...base.registrations, ...a.registrations].map((r) =>
      edits.registrationPatches?.[r.id] ? { ...r, ...edits.registrationPatches[r.id] } : r,
    ),
    coachAssignments: [...base.coachAssignments, ...a.coachAssignments].map((c) =>
      edits.coachAssignmentPatches?.[c.id] ? { ...c, ...edits.coachAssignmentPatches[c.id] } : c,
    ),
  };
  const im = edits.imported;
  if (!im || im.people.length + im.households.length + im.players.length + im.registrations.length === 0) return merged;
  // Imported records replace by id, then preferences-page patches still apply on top.
  const withImport = applyImport(merged, { upserts: im });
  return {
    ...withImport,
    registrations: withImport.registrations.map((r) => (edits.registrationPatches?.[r.id] ? { ...r, ...edits.registrationPatches[r.id] } : r)),
  };
}

function mergeById<T extends { id: ID }>(list: readonly T[], next: readonly T[]): T[] {
  const byId = new Map(list.map((x) => [x.id, x]));
  for (const x of next) byId.set(x.id, x);
  return [...byId.values()];
}

/**
 * Game schedules for the whole season. Built by schedule position, without
 * placements, so game times don't shift while kids move between teams.
 */
export function seasonSchedules(data: SeasonData): ScheduleBuildResult[] {
  try {
    return buildSeasonSchedules(data);
  } catch {
    // A schedule problem should never take down the demo.
    return [];
  }
}

export function SeasonProvider({ children }: { children: ReactNode }) {
  const [edits, setEdits] = useState<DemoEdits>(EMPTY_EDITS);
  const [loaded, setLoaded] = useState(false);

  // Load saved edits after mount so the server render and first client render match.
  useEffect(() => {
    setEdits(load());
    setLoaded(true);
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

  // Only rebuild schedules when what they depend on changes (teams, tracks, coaches, settings).
  const scheduleKey = useMemo(
    () => JSON.stringify([data.teams, data.gameTracks, data.coachAssignments.map((c) => [c.personId, c.teamId, c.role]), data.divisions.map((d) => d.settings.gameTimeStyle)]),
    [data],
  );
  const schedules = useMemo(() => seasonSchedules(data), [scheduleKey]);
  const games = useMemo(() => schedules.flatMap((r) => r.games), [schedules]);
  const trackDescriptions = useMemo(() => {
    const out = new Map<ID, string>();
    for (const r of schedules) for (const t of r.tracks) if (t.description) out.set(t.id, t.description);
    return out;
  }, [schedules]);

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
      schedules,
      games,
      trackDescriptions,
      edits,
      loaded,
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
      patchRegistration: (registrationId, patch) =>
        updateEdits((e) => ({
          ...e,
          registrationPatches: {
            ...e.registrationPatches,
            [registrationId]: { ...e.registrationPatches?.[registrationId], ...patch },
          },
        })),
      setDivisionSettings: (divisionId, patch) =>
        updateEdits((e) => ({
          ...e,
          divisionSettings: { ...e.divisionSettings, [divisionId]: { ...e.divisionSettings[divisionId], ...patch } },
        })),
      applyImported: (records) =>
        updateEdits((e) => ({
          ...e,
          imported: {
            people: mergeById(e.imported.people, records.people),
            households: mergeById(e.imported.households, records.households),
            players: mergeById(e.imported.players, records.players),
            registrations: mergeById(e.imported.registrations, records.registrations),
          },
        })),
      resetDemo: () => updateEdits(() => EMPTY_EDITS),
    }),
    [data, index, results, schedules, games, trackDescriptions, edits, loaded, updateEdits],
  );
  return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>;
}

export function useSeason(): SeasonState {
  const ctx = useContext(SeasonContext);
  if (!ctx) throw new Error('useSeason must be used inside <SeasonProvider>');
  return ctx;
}
