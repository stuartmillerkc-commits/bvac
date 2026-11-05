'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  dayShort,
  FACTOR_LABELS,
  FACTORS,
  formatDate,
  formatWindow,
  fullName,
  headCoach,
  teamPracticeWindow,
  type CoachRequest,
  type Division,
  type Factor,
  type Gender,
  type Household,
  type ID,
  type Person,
  type Player,
  type PlayerRequest,
  type PlayerRequestType,
  type Registration,
  type RegistrationWindow,
  type Team,
  type VolunteerRole,
  type Weekday,
} from '@bvac/core';
import { useSeason } from '@/lib/season-store';
import {
  answersForTeam,
  availabilityFromAnswers,
  centralTimestamp,
  divisionForGrade,
  FORM_DAYS,
  FORM_TIMES,
  gradeFromBirthdate,
  gradeText,
  isFirstComeFirstServed,
  matchPlayerName,
  playerLine,
  registeredPlayers,
  schoolYearLabel,
  seatInfo,
  teamFits,
  teamOptionText,
  visibleTeams,
  windowFor,
  type NameMatch,
} from './helpers';
import s from './family.module.css';

const STEPS = ['Who are you registering?', 'Player information', 'Soccer questions', 'Review and pay'] as const;
const SHIRT_SIZES = ['Youth XS', 'Youth Small', 'Youth Medium', 'Youth Large', 'Youth XL', 'Adult Small', 'Adult Medium'];
const SEASONS_PLAYED = ['0', '1', '2', '3', '4', '5+'];
const FEE = 100;
/** SportsEngine processing fee example from SPORTSENGINE.md: 3.25% + $1.50, paid by the family. */
const PROCESSING_FEE = Math.round((FEE * 0.0325 + 1.5) * 100) / 100;
const VOLUNTEER_LABELS: Record<VolunteerRole, string> = {
  headCoach: 'Head coach',
  assistantCoach: 'Assistant coach',
  teamParent: 'Team parent',
};

interface GuardianAnswers {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface PlayerAnswers {
  firstName: string;
  lastName: string;
  birthdate: string;
  divisionId: ID;
  gender: Gender | '';
  shirtSize: string;
  city: string;
}

interface RequestAnswer {
  name: string;
  type: PlayerRequestType;
}

interface QuestionAnswers {
  days: Weekday[];
  onlyTheseDays: 'yes' | 'no' | '';
  times: string[];
  firstChoice: ID;
  secondChoice: ID;
  anyFitting: boolean;
  /** '' no preference, 'same' same as last season, or a coach person id. */
  coach: string;
  requests: RequestAnswer[];
  mostImportant: Factor | '';
  secondMostImportant: Factor | '';
  seasonsPlayed: string;
  lastSeasonCoach: string;
  requestText: string;
  volunteer: VolunteerRole[];
}

const EMPTY_GUARDIAN: GuardianAnswers = { firstName: '', lastName: '', email: '', phone: '' };
const emptyPlayer = (divisionId: ID, lastName = '', city = ''): PlayerAnswers => ({
  firstName: '',
  lastName,
  birthdate: '',
  divisionId,
  gender: '',
  shirtSize: '',
  city,
});
const emptyQuestions = (firstChoice: ID = ''): QuestionAnswers => ({
  days: [],
  onlyTheseDays: '',
  times: [],
  firstChoice,
  secondChoice: '',
  anyFitting: true,
  coach: '',
  requests: [
    { name: '', type: 'friend' },
    { name: '', type: 'friend' },
  ],
  mostImportant: '',
  secondMostImportant: '',
  seasonsPlayed: '',
  lastSeasonCoach: '',
  requestText: '',
  volunteer: [],
});

type Errors = Record<string, string>;

interface Submitted {
  registration: Registration;
  player: Player;
  guardian: Person;
  household: Household;
  confirmation: string;
}

const SAMPLE_KIDS: [string, Gender][] = [
  ['Riley', 'F'],
  ['Rowan', 'M'],
  ['Emerson', 'F'],
  ['Parker', 'M'],
  ['Hayden', 'F'],
];

export function RegisterForm() {
  const { data, index, addRecords, edits } = useSeason();
  const params = useSearchParams();
  const divisions = useMemo(() => [...data.divisions].sort((a, b) => a.sortOrder - b.sortOrder), [data.divisions]);
  const urlDivision = divisions.find((d) => d.code === params.get('division') || d.id === params.get('division'));
  const urlFirst = params.get('first') ?? '';
  const initialFirst = urlDivision && index.team.get(urlFirst)?.divisionId === urlDivision.id ? urlFirst : '';

  const [step, setStep] = useState(0);
  const [guardian, setGuardian] = useState<GuardianAnswers>(EMPTY_GUARDIAN);
  const [player, setPlayer] = useState<PlayerAnswers>(() => emptyPlayer(urlDivision?.id ?? ''));
  const prefillTeam = initialFirst ? index.team.get(initialFirst) : undefined;
  const [q, setQ] = useState<QuestionAnswers>(() => ({
    ...emptyQuestions(initialFirst),
    ...(prefillTeam ? answersForTeam(index, prefillTeam) : {}),
  }));
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState<Submitted | null>(null);
  /** Household and guardian carried over when registering a sibling. */
  const [household, setHousehold] = useState<{ household: Household; guardian: Person } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
    headingRef.current?.scrollIntoView({ block: 'start' });
  }, [step, submitted]);

  const division = index.division.get(player.divisionId);
  const season = data.season;

  const householdKids = household
    ? (index.playersByHousehold.get(household.household.id) ?? []).filter((p) => index.registrationByPlayer.has(p.id))
    : [];

  // -------------------------------------------------------------- validation

  const validate = (which: number): Errors => {
    const e: Errors = {};
    if (which === 0) {
      if (!guardian.firstName.trim()) e.gFirst = 'Enter your first name.';
      if (!guardian.lastName.trim()) e.gLast = 'Enter your last name.';
      if (!/^\S+@\S+\.\S+$/.test(guardian.email.trim())) e.gEmail = 'Enter an email address.';
    }
    if (which === 1) {
      if (!player.firstName.trim()) e.pFirst = "Enter the player's first name.";
      if (!player.lastName.trim()) e.pLast = "Enter the player's last name.";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(player.birthdate)) e.pBirth = 'Enter a birthdate.';
      if (!player.divisionId) e.pDivision = 'Choose an age/grade.';
      if (!player.gender) e.pGender = 'Choose one.';
      if (!player.shirtSize) e.pShirt = 'Choose a shirt size.';
      const dup = data.players.find(
        (p) =>
          p.firstName.trim().toLowerCase() === player.firstName.trim().toLowerCase() &&
          p.lastName.trim().toLowerCase() === player.lastName.trim().toLowerCase() &&
          p.birthdate === player.birthdate &&
          index.registrationByPlayer.has(p.id),
      );
      if (dup) e.pFirst = `${fullName(dup)} is already registered this season.`;
    }
    if (which === 2) {
      if (!q.days.length) e.days = 'Check at least one day.';
      if (!q.onlyTheseDays) e.only = 'Choose one.';
      if (!q.times.length) e.times = 'Check at least one time.';
      if (!q.firstChoice) e.first = 'Choose a 1st choice team.';
      if (q.secondChoice && q.secondChoice === q.firstChoice) e.second = 'Pick a different team, or "No 2nd choice".';
    }
    return e;
  };

  const next = () => {
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setStep((x) => Math.min(x + 1, STEPS.length - 1));
  };
  const back = () => {
    setErrors({});
    setStep((x) => Math.max(0, x - 1));
  };

  // -------------------------------------------------------------- submit

  const submit = () => {
    if (!division) return;
    const now = Date.now();
    const stamp = now.toString(36);
    const submittedAt = centralTimestamp(now);
    const guardianPerson: Person = household?.guardian ?? {
      id: `person_web_${stamp}`,
      firstName: guardian.firstName.trim(),
      lastName: guardian.lastName.trim(),
      email: guardian.email.trim(),
      ...(guardian.phone.trim() ? { phone: guardian.phone.trim() } : {}),
    };
    const hh: Household = household?.household ?? {
      id: `hh_web_${stamp}`,
      guardianIds: [guardianPerson.id],
      ...(player.city.trim() ? { city: player.city.trim() } : {}),
    };
    const estGrade = gradeFromBirthdate(player.birthdate, season);
    const grade = estGrade !== null && estGrade >= division.minGrade && estGrade <= division.maxGrade ? estGrade : division.minGrade;
    const newPlayer: Player = {
      id: `plr_web_${stamp}`,
      householdId: hh.id,
      firstName: player.firstName.trim(),
      lastName: player.lastName.trim(),
      birthdate: player.birthdate,
      gender: player.gender as Gender,
      grade,
      shirtSize: player.shirtSize,
    };
    const pools = registeredPlayers(index, division.id);
    const requests: PlayerRequest[] = q.requests
      .slice(0, division.settings.maxPlayerRequests)
      .filter((r) => r.name.trim())
      .map((r, i) => {
        const m = matchPlayerName(r.name, pools.same, pools.others);
        return {
          id: `req_web_${stamp}_${i + 1}`,
          type: r.type,
          targetName: r.name.trim(),
          matchStatus: m.status,
          ...(m.status === 'matched' ? { targetPlayerId: m.candidates[0]!.id } : {}),
          ...(m.status === 'ambiguous' ? { candidatePlayerIds: m.candidates.map((c) => c.id) } : {}),
        };
      });
    let coachRequest: CoachRequest | undefined;
    if (q.coach === 'same') coachRequest = { sameAsLastSeason: true };
    else if (q.coach) coachRequest = { coachPersonId: q.coach };
    const selfReported =
      q.seasonsPlayed || q.lastSeasonCoach.trim()
        ? `Self-reported: ${q.seasonsPlayed ? `${q.seasonsPlayed} seasons at BVAC` : 'seasons not given'}${
            q.lastSeasonCoach.trim() ? ` · last season's coach: ${q.lastSeasonCoach.trim()}` : ''
          }`
        : '';
    const note = [q.requestText.trim(), selfReported].filter(Boolean).join('\n');
    const factorRanking = [q.mostImportant, q.secondMostImportant].filter((f): f is Factor => !!f);
    const choices = [q.firstChoice, q.secondChoice].filter(Boolean).map((teamId, i) => ({ teamId, rank: i + 1 }));
    const registration: Registration = {
      id: `reg_web_${stamp}`,
      seasonId: season.id,
      playerId: newPlayer.id,
      divisionId: division.id,
      window: windowFor(season, submittedAt),
      submittedAt,
      source: 'native',
      status: 'active',
      availability: availabilityFromAnswers(q.days, q.times),
      availabilityRequired: q.onlyTheseDays === 'yes',
      choices,
      acceptAnyFittingTeam: q.anyFitting || choices.length === 0,
      requests,
      ...(coachRequest ? { coachRequest } : {}),
      factorRanking,
      siblingsTogetherOptOut: false,
      ...(note ? { note } : {}),
      volunteer: q.volunteer,
    };
    addRecords({
      people: household ? [] : [guardianPerson],
      households: household ? [] : [hh],
      players: [newPlayer],
      registrations: [registration],
    });
    setHousehold({ household: hh, guardian: guardianPerson });
    setSubmitted({
      registration,
      player: newPlayer,
      guardian: guardianPerson,
      household: hh,
      confirmation: `BVAC-${String(now).slice(-7)}`,
    });
  };

  const registerSibling = () => {
    if (!submitted) return;
    setPlayer(emptyPlayer('', submitted.player.lastName, submitted.household.city ?? ''));
    setQ(emptyQuestions());
    setErrors({});
    setSubmitted(null);
    setStep(0);
  };

  const fillSample = () => {
    const d = division ?? divisions[2] ?? divisions[0];
    if (!d) return;
    const n = edits.added.registrations.length;
    const [kid, gender] = SAMPLE_KIDS[n % SAMPLE_KIDS.length]!;
    const grade = d.minGrade;
    const birthYear = 2020 - grade + (n % 2 === 0 ? 1 : 0);
    const birthdate = `${birthYear}-${n % 2 === 0 ? '03' : '10'}-1${n % 9}`;
    // Keep a team the family already picked (e.g. from the Team Finder) and answer with its night.
    const kept = q.firstChoice && index.team.get(q.firstChoice)?.divisionId === d.id ? index.team.get(q.firstChoice) : undefined;
    const keptAnswers = kept ? answersForTeam(index, kept) : undefined;
    const sampleDays: Weekday[] = keptAnswers?.days.length ? keptAnswers.days : ['tue', 'thu'];
    const sampleTimes = keptAnswers?.days.length ? keptAnswers.times : ['17', '18'];
    const sampleAvailability = availabilityFromAnswers(sampleDays, sampleTimes);
    const tueThu = visibleTeams(index, d.id).filter((t) => teamFits(index, t, sampleAvailability));
    const first = kept?.id || tueThu[0]?.id || '';
    const friend = registeredPlayers(index, d.id).same[3 + n];
    if (!household) setGuardian({ firstName: 'Jordan', lastName: 'Sample', email: 'jordan.sample@example.com', phone: '816-555-0142' });
    setPlayer({
      firstName: kid,
      lastName: household?.guardian.lastName ?? 'Sample',
      birthdate,
      divisionId: d.id,
      gender,
      shirtSize: 'Youth Small',
      city: household?.household.city ?? 'Independence',
    });
    setQ({
      ...emptyQuestions(first),
      days: sampleDays,
      onlyTheseDays: 'yes',
      times: sampleTimes,
      secondChoice: tueThu.find((t) => t.id !== first)?.id ?? '',
      requests: [
        { name: friend ? `${friend.nickname ?? friend.firstName} ${friend.lastName[0]}.` : '', type: 'friend' },
        { name: '', type: 'friend' },
      ],
      mostImportant: 'practiceTime',
      secondMostImportant: 'friends',
      seasonsPlayed: '0',
    });
    setErrors({});
  };

  // -------------------------------------------------------------- render

  if (submitted) {
    return (
      <div className={`${s.page} ${s.seForm}`}>
        <MockBanner />
        <Receipt submitted={submitted} headingRef={headingRef} onSibling={registerSibling} />
      </div>
    );
  }

  return (
    <div className={`${s.page} ${s.seForm}`}>
      <MockBanner />
      <header className={s.seHeader}>
        <p className="muted" style={{ margin: 0 }}>
          Blue Valley Activity Center
        </p>
        <h1>{season.name} Registration</h1>
        <ol className={s.stepper} aria-label="Registration steps">
          {STEPS.map((label, i) => (
            <li key={label} data-state={i < step ? 'done' : i === step ? 'current' : 'todo'} aria-current={i === step ? 'step' : undefined}>
              <span className={s.stepNum}>Step {i + 1}</span>
              {label}
            </li>
          ))}
        </ol>
      </header>

      <form
        className={`card ${s.panel}`}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (step < STEPS.length - 1) next();
          else submit();
        }}
      >
        <div className={s.row} style={{ justifyContent: 'space-between' }}>
          <h2 ref={headingRef} tabIndex={-1}>
            {STEPS[step]}
          </h2>
          {step < 3 ? (
            <button type="button" className={s.linkButton} onClick={fillSample}>
              Fill in sample answers
            </button>
          ) : null}
        </div>

        {step === 0 ? (
          <StepWho guardian={guardian} setGuardian={setGuardian} errors={errors} carried={household?.guardian ?? null} householdKids={householdKids} />
        ) : null}
        {step === 1 ? <StepPlayer player={player} setPlayer={setPlayer} errors={errors} divisions={divisions} q={q} setQ={setQ} /> : null}
        {step === 2 && division ? <StepQuestions
            division={division}
            q={q}
            setQ={setQ}
            errors={errors}
            playerFirst={player.firstName}
            prefillTeam={prefillTeam?.divisionId === division.id ? prefillTeam : undefined}
          /> : null}
        {step === 3 && division ? (
          <StepReview division={division} guardian={household?.guardian ?? guardian} player={player} q={q} goTo={setStep} />
        ) : null}

        <div className={s.navRow}>
          {step > 0 ? (
            <button type="button" className="button secondary" onClick={back}>
              Back
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="button">
            {step < STEPS.length - 1 ? 'Continue' : `Pay $${(FEE + PROCESSING_FEE).toFixed(2)} (mock)`}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function MockBanner() {
  return (
    <div className={s.mockBanner} role="note">
      <strong>This is a mock of BVAC&apos;s SportsEngine soccer form.</strong>
      It shows the existing questions plus the 7 new ones BVAC could add in SportsEngine&apos;s registration builder. Nothing is charged
      and nothing leaves this browser; the registration goes straight into the demo season so you can see it on the admin board.
    </div>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  required,
  children,
}: {
  id: string;
  label: ReactNode;
  error?: string | undefined;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={s.field}>
      <label className={s.label} htmlFor={id}>
        {label}
        {required ? (
          <span className={s.required} aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint ? (
        <p className={s.hint} id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className={s.error} id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function inputProps(id: string, error: string | undefined, required = false) {
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : undefined,
    'aria-required': required || undefined,
  } as const;
}

function StepWho({
  guardian,
  setGuardian,
  errors,
  carried,
  householdKids,
}: {
  guardian: GuardianAnswers;
  setGuardian: (g: GuardianAnswers) => void;
  errors: Errors;
  carried: Person | null;
  householdKids: Player[];
}) {
  if (carried) {
    return (
      <div className={s.stack}>
        <p style={{ margin: 0 }}>
          Signed in as <strong>{fullName(carried)}</strong> ({carried.email}).
        </p>
        <fieldset className={s.fieldset}>
          <legend className={s.label}>Who are you registering?</legend>
          {householdKids.map((p) => (
            <label key={p.id} className={s.check}>
              <input type="radio" name="who" disabled />
              {fullName(p)} <span className="badge good">Registered</span>
            </label>
          ))}
          <label className={s.check}>
            <input type="radio" name="who" defaultChecked />
            Add a new player to your household
          </label>
        </fieldset>
        <p className={s.hint}>Siblings in one household are linked automatically, so you don&apos;t need to request them.</p>
      </div>
    );
  }
  const set = (k: keyof GuardianAnswers) => (e: { target: { value: string } }) => setGuardian({ ...guardian, [k]: e.target.value });
  return (
    <div className={s.stack}>
      <p className="muted" style={{ margin: 0 }}>
        In SportsEngine you sign in to your household account here. For the demo, enter a made-up parent or guardian.
      </p>
      <div className={s.formGrid}>
        <Field id="g-first" label="Parent/guardian first name" required error={errors.gFirst}>
          <input type="text" autoComplete="given-name" value={guardian.firstName} onChange={set('firstName')} {...inputProps('g-first', errors.gFirst, true)} />
        </Field>
        <Field id="g-last" label="Parent/guardian last name" required error={errors.gLast}>
          <input type="text" autoComplete="family-name" value={guardian.lastName} onChange={set('lastName')} {...inputProps('g-last', errors.gLast, true)} />
        </Field>
        <Field id="g-email" label="Email" required error={errors.gEmail} hint="Demo: use a made-up example.com address.">
          <input type="email" autoComplete="off" value={guardian.email} onChange={set('email')} {...inputProps('g-email', errors.gEmail, true)} />
        </Field>
        <Field id="g-phone" label="Phone" hint="Optional. Demo: use a 555 number.">
          <input type="tel" autoComplete="off" value={guardian.phone} onChange={set('phone')} {...inputProps('g-phone', undefined)} />
        </Field>
      </div>
      <fieldset className={s.fieldset}>
        <legend className={s.label}>Who are you registering?</legend>
        <label className={s.check}>
          <input type="radio" name="who" defaultChecked />
          Add a new player to your household
        </label>
      </fieldset>
    </div>
  );
}

function StepPlayer({
  player,
  setPlayer,
  errors,
  divisions,
  q,
  setQ,
}: {
  player: PlayerAnswers;
  setPlayer: (p: PlayerAnswers) => void;
  errors: Errors;
  divisions: Division[];
  q: QuestionAnswers;
  setQ: (q: QuestionAnswers) => void;
}) {
  const { data, index } = useSeason();
  const set = (k: keyof PlayerAnswers) => (e: { target: { value: string } }) => setPlayer({ ...player, [k]: e.target.value });
  const estGrade = player.birthdate ? gradeFromBirthdate(player.birthdate, data.season) : null;
  const estDivision = estGrade !== null ? divisionForGrade(divisions, estGrade) : undefined;
  const chooseDivision = (divisionId: ID) => {
    setPlayer({ ...player, divisionId });
    // Team choices belong to one division; clear them if the division changes.
    const keep = (id: ID) => (id && index.team.get(id)?.divisionId === divisionId ? id : '');
    setQ({ ...q, firstChoice: keep(q.firstChoice), secondChoice: keep(q.secondChoice), coach: '' });
  };
  return (
    <div className={s.stack}>
      <div className={s.formGrid}>
        <Field id="p-first" label="Player first name" required error={errors.pFirst}>
          <input type="text" autoComplete="off" value={player.firstName} onChange={set('firstName')} {...inputProps('p-first', errors.pFirst, true)} />
        </Field>
        <Field id="p-last" label="Player last name" required error={errors.pLast}>
          <input type="text" autoComplete="off" value={player.lastName} onChange={set('lastName')} {...inputProps('p-last', errors.pLast, true)} />
        </Field>
        <Field id="p-birth" label="Date of birth" required error={errors.pBirth}>
          <input type="date" value={player.birthdate} onChange={set('birthdate')} {...inputProps('p-birth', errors.pBirth, true)} />
        </Field>
      </div>

      <fieldset className={s.fieldset} aria-invalid={errors.pDivision ? true : undefined}>
        <legend className={s.label}>
          What age/grade is the player during the {schoolYearLabel(data.season)} school year?<span className={s.required} aria-hidden="true">*</span>
        </legend>
        <div className={s.choiceStack}>
          {divisions.map((d) => (
            <label key={d.id} className={s.check}>
              <input type="radio" name="division" value={d.id} checked={player.divisionId === d.id} onChange={() => chooseDivision(d.id)} />
              {d.label}
            </label>
          ))}
        </div>
        {estDivision && player.divisionId && estDivision.id !== player.divisionId ? (
          <p className={s.hint}>
            From the birthdate we&apos;d guess {estDivision.label}. BVAC places by school grade, so keep your answer if it&apos;s right.
          </p>
        ) : null}
        {errors.pDivision ? <p className={s.error}>{errors.pDivision}</p> : null}
      </fieldset>

      <fieldset className={s.fieldset}>
        <legend className={s.label}>
          Gender<span className={s.required} aria-hidden="true">*</span>
        </legend>
        <div className={s.choices}>
          {(
            [
              ['M', 'Male'],
              ['F', 'Female'],
            ] as const
          ).map(([v, label]) => (
            <label key={v} className={s.check}>
              <input
                type="radio"
                name="gender"
                checked={player.gender === v}
                onChange={() => setPlayer({ ...player, gender: v })}
                aria-invalid={errors.pGender ? true : undefined}
              />
              {label}
            </label>
          ))}
        </div>
        {errors.pGender ? <p className={s.error}>{errors.pGender}</p> : null}
      </fieldset>

      <div className={s.formGrid}>
        <Field id="p-shirt" label="Shirt size" required error={errors.pShirt}>
          <select value={player.shirtSize} onChange={set('shirtSize')} {...inputProps('p-shirt', errors.pShirt, true)}>
            <option value="">Select…</option>
            {SHIRT_SIZES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
        <Field id="p-city" label="City" hint="The real form asks for a full address; the demo keeps only the city.">
          <input type="text" autoComplete="off" value={player.city} onChange={set('city')} {...inputProps('p-city', undefined)} />
        </Field>
      </div>
    </div>
  );
}

function StepQuestions({
  division,
  q,
  setQ,
  errors,
  playerFirst,
  prefillTeam,
}: {
  division: Division;
  q: QuestionAnswers;
  setQ: (q: QuestionAnswers) => void;
  errors: Errors;
  playerFirst: string;
  /** The team the family clicked in the Team Finder; its night is pre-checked. */
  prefillTeam?: Team | undefined;
}) {
  const { index, results } = useSeason();
  const teams = visibleTeams(index, division.id);
  const fcfs = isFirstComeFirstServed(division);
  const availability = availabilityFromAnswers(q.days, q.times);
  const pools = useMemo(() => registeredPlayers(index, division.id), [index, division.id]);
  const who = playerFirst.trim() || 'the player';

  const toggle = <T,>(list: T[], v: T, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v));

  const optionText = (teamId: ID) => {
    const t = index.team.get(teamId);
    if (!t) return '';
    const info = seatInfo(index, results, t);
    const seat = fcfs
      ? info.status === 'waitlist'
        ? ' (full, waitlist)'
        : ` (${info.left} left)`
      : info.status === 'waitlist'
        ? ' (likely full)'
        : info.status === 'filling'
          ? ' (filling)'
          : '';
    return `${teamOptionText(index, t)}${seat}`;
  };

  const fitNote = (teamId: ID) => {
    const t = index.team.get(teamId);
    if (!t || !availability.length) return null;
    return teamFits(index, t, availability) ? (
      <span className={s.fit}>✓ Fits the days and times you checked</span>
    ) : (
      <span className={s.noFit}>✗ Outside the days and times you checked{q.onlyTheseDays === 'yes' ? ', so it can’t be used' : ''}</span>
    );
  };

  const coaches = division.settings.showCoachNames
    ? teams.flatMap((t) => {
        const c = headCoach(index, t.id);
        return c ? [{ id: c.id, text: `Coach ${fullName(c)} (${t.label})` }] : [];
      })
    : [];

  return (
    <div className={s.stack}>
      <p className="muted" style={{ margin: 0 }}>
        {division.name} · {division.label}. Questions marked <span className={s.newTag}>New</span> are the structured ones BVAC would add, so
        teams can be built from answers instead of a free-text box. Not sure which team?{' '}
        <Link href={`/finder/?division=${division.code}`} target="_blank">
          Open the Team Finder
        </Link>
        .
      </p>

      <fieldset className={`${s.fieldset} ${s.question}`}>
        <legend className={s.label}>
          <span className={s.qNum}>1.</span>Practice days available<span className={s.newTag}>New</span>
        </legend>
        <div className={s.choices}>
          {FORM_DAYS.map((d) => (
            <label key={d} className={s.pill}>
              <input
                type="checkbox"
                checked={q.days.includes(d)}
                onChange={(e) => setQ({ ...q, days: toggle(q.days, d, e.target.checked) })}
                aria-invalid={errors.days ? true : undefined}
              />
              {dayShort(d)}
            </label>
          ))}
        </div>
        {prefillTeam ? (
          <p className={s.hint}>
            We checked {dayShort(teamPracticeWindow(index, prefillTeam).day)} because {prefillTeam.label} practices{' '}
            {formatWindow(teamPracticeWindow(index, prefillTeam))}. Check any other days that work too: more days means more teams to choose
            from.
          </p>
        ) : null}
        {errors.days ? <p className={s.error}>{errors.days}</p> : null}
      </fieldset>

      <fieldset className={`${s.fieldset} ${s.question}`}>
        <legend className={s.label}>
          <span className={s.qNum}>2.</span>Are these the only days that work?<span className={s.newTag}>New</span>
        </legend>
        <div className={s.choiceStack}>
          <label className={s.check}>
            <input type="radio" name="only" checked={q.onlyTheseDays === 'yes'} onChange={() => setQ({ ...q, onlyTheseDays: 'yes' })} aria-invalid={errors.only ? true : undefined} />
            Yes, only the days checked
          </label>
          <label className={s.check}>
            <input type="radio" name="only" checked={q.onlyTheseDays === 'no'} onChange={() => setQ({ ...q, onlyTheseDays: 'no' })} aria-invalid={errors.only ? true : undefined} />
            No, they&apos;re preferences
          </label>
        </div>
        <p className={s.hint}>&quot;Yes&quot; means {who} is never placed on a team that practices on another day.</p>
        {errors.only ? <p className={s.error}>{errors.only}</p> : null}
      </fieldset>

      <div className={s.question}>
        <fieldset className={s.fieldset}>
          <legend className={s.label}>
            <span className={s.qNum}>3.</span>Practice times available<span className={s.newTag}>New</span>
          </legend>
          <div className={s.choices}>
            {FORM_TIMES.map((t) => (
              <label key={t.id} className={s.pill}>
                <input
                  type="checkbox"
                  checked={q.times.includes(t.id)}
                  onChange={(e) => setQ({ ...q, times: toggle(q.times, t.id, e.target.checked) })}
                  aria-invalid={errors.times ? true : undefined}
                />
                {t.label}
              </label>
            ))}
          </div>
          <p className={s.hint}>
            Check every hour you could be at the field. A practice from 6:30 to 7:30pm needs both 6:00–7:00 and 7:00–8:00 checked.
          </p>
          {errors.times ? <p className={s.error}>{errors.times}</p> : null}
          {availability.length ? <p className={s.hint}>Works for: {availability.map(formatWindow).join(', ')}</p> : null}
        </fieldset>
        <div className={s.formGrid} style={{ marginTop: 8 }}>
          <Field id="q-first" label="1st choice team" required error={errors.first} hint={fitNote(q.firstChoice)}>
            <select value={q.firstChoice} onChange={(e) => setQ({ ...q, firstChoice: e.target.value })} {...inputProps('q-first', errors.first, true)}>
              <option value="">Select a team option…</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {optionText(t.id)}
                </option>
              ))}
            </select>
          </Field>
          <Field id="q-second" label="2nd choice team" error={errors.second} hint={fitNote(q.secondChoice)}>
            <select value={q.secondChoice} onChange={(e) => setQ({ ...q, secondChoice: e.target.value })} {...inputProps('q-second', errors.second)}>
              <option value="">No 2nd choice</option>
              {teams
                .filter((t) => t.id !== q.firstChoice)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {optionText(t.id)}
                  </option>
                ))}
            </select>
          </Field>
        </div>
        <label className={s.check}>
          <input type="checkbox" checked={q.anyFitting} onChange={(e) => setQ({ ...q, anyFitting: e.target.checked })} />
          If my choices are full, any team on the days I checked is fine
        </label>
        <p className={s.hint}>
          {fcfs
            ? 'This division is first come, first served: your 1st choice holds a seat when you pay.'
            : 'Choices are placed by BVAC’s published rules, so a seat isn’t guaranteed until rosters come out.'}{' '}
          You can rank every option on the preferences page after you register.
        </p>
      </div>

      <div className={s.question}>
        <Field id="q-coach" label={<><span className={s.qNum}>4.</span>Coach request<span className={s.newTag}>New</span></>}>
          <select value={q.coach} onChange={(e) => setQ({ ...q, coach: e.target.value })} {...inputProps('q-coach', undefined)}>
            <option value="">No preference</option>
            <option value="same">Same coach as last season</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.text}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset className={`${s.fieldset} ${s.question}`}>
        <legend className={s.label}>
          <span className={s.qNum}>5.</span>Player requests<span className={s.newTag}>New</span>
        </legend>
        <p className={s.hint}>
          Up to {division.settings.maxPlayerRequests} kids {who} would like to play with. Siblings in your household are linked automatically.
        </p>
        {q.requests.slice(0, division.settings.maxPlayerRequests).map((r, i) => (
          <RequestField
            key={i}
            n={i + 1}
            value={r}
            pools={pools}
            onChange={(v) => setQ({ ...q, requests: q.requests.map((x, j) => (j === i ? v : x)) })}
          />
        ))}
      </fieldset>

      <div className={`${s.question}`}>
        <span className={s.label}>
          <span className={s.qNum}>6.</span>What matters most?<span className={s.newTag}>New</span>
        </span>
        <div className={s.formGrid}>
          <Field id="q-most" label="Most important">
            <select
              value={q.mostImportant}
              onChange={(e) => {
                const v = e.target.value as Factor | '';
                setQ({ ...q, mostImportant: v, secondMostImportant: q.secondMostImportant === v ? '' : q.secondMostImportant });
              }}
              {...inputProps('q-most', undefined)}
            >
              <option value="">Select…</option>
              {FACTORS.map((f) => (
                <option key={f} value={f}>
                  {FACTOR_LABELS[f]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="q-most2" label="Second most important">
            <select value={q.secondMostImportant} onChange={(e) => setQ({ ...q, secondMostImportant: e.target.value as Factor | '' })} {...inputProps('q-most2', undefined)}>
              <option value="">Select…</option>
              {FACTORS.filter((f) => f !== q.mostImportant).map((f) => (
                <option key={f} value={f}>
                  {FACTOR_LABELS[f]}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div className={s.question}>
        <span className={s.label}>
          <span className={s.qNum}>7.</span>Seasons played at BVAC<span className={s.newTag}>New</span>
        </span>
        <div className={s.formGrid}>
          <Field id="q-seasons" label="Seasons played">
            <select value={q.seasonsPlayed} onChange={(e) => setQ({ ...q, seasonsPlayed: e.target.value })} {...inputProps('q-seasons', undefined)}>
              <option value="">Select…</option>
              {SEASONS_PLAYED.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field id="q-lastcoach" label="Last season's coach">
            <input type="text" autoComplete="off" value={q.lastSeasonCoach} onChange={(e) => setQ({ ...q, lastSeasonCoach: e.target.value })} {...inputProps('q-lastcoach', undefined)} />
          </Field>
        </div>
      </div>

      <div className={s.question}>
        <Field id="q-request" label="Request" hint="BVAC's existing box, kept for anything else.">
          <textarea value={q.requestText} onChange={(e) => setQ({ ...q, requestText: e.target.value })} {...inputProps('q-request', undefined)} />
        </Field>
        <fieldset className={s.fieldset}>
          <legend className={s.label}>Can you help? (optional)</legend>
          <div className={s.choices}>
            {(Object.keys(VOLUNTEER_LABELS) as VolunteerRole[]).map((v) => (
              <label key={v} className={s.check}>
                <input type="checkbox" checked={q.volunteer.includes(v)} onChange={(e) => setQ({ ...q, volunteer: toggle(q.volunteer, v, e.target.checked) })} />
                {VOLUNTEER_LABELS[v]}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
}

function RequestField({
  n,
  value,
  pools,
  onChange,
}: {
  n: number;
  value: RequestAnswer;
  pools: { same: Player[]; others: Player[] };
  onChange: (v: RequestAnswer) => void;
}) {
  const { index } = useSeason();
  const typed = value.name.trim();
  const match: NameMatch | null = typed.length >= 2 ? matchPlayerName(typed, pools.same, pools.others) : null;
  const id = `q-req-${n}`;
  return (
    <div className={s.requestBox}>
      <div className={s.formGrid}>
        <div className={s.field}>
          <label className={s.label} htmlFor={id}>
            Player request {n}: name
          </label>
          <input
            id={id}
            type="text"
            autoComplete="off"
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            aria-describedby={`${id}-match`}
          />
        </div>
        <fieldset className={s.fieldset}>
          <legend className={s.label}>Sibling or friend? ({n})</legend>
          <div className={s.choices}>
            {(['sibling', 'friend'] as const).map((t) => (
              <label key={t} className={s.check}>
                <input type="radio" name={`req-type-${n}`} checked={value.type === t} onChange={() => onChange({ ...value, type: t })} />
                {t === 'sibling' ? 'Sibling' : 'Friend'}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <div id={`${id}-match`} aria-live="polite">
        {match ? <MatchText match={match} typed={typed} line={(p) => playerLine(index, p)} /> : null}
      </div>
    </div>
  );
}

export function MatchText({ match, typed, line }: { match: NameMatch; typed: string; line: (p: Player) => string }) {
  if (match.status === 'matched') return <p className={s.matchFound}>✓ We found: {line(match.candidates[0]!)}</p>;
  if (match.status === 'ambiguous')
    return (
      <p className={s.matchMaybe}>
        {match.candidates.length === 1
          ? `Did you mean ${line(match.candidates[0]!)}? We’ll ask you to confirm on the team preferences page after you register.`
          : `More than one registered player could be “${typed}”: ${match.candidates.slice(0, 3).map(line).join('; ')}. You can pick the right one on the team preferences page after you register.`}
      </p>
    );
  return (
    <p className={s.matchNone}>
      No registered player named “{typed}” yet. That&apos;s fine: if they register later, an admin matches them.
    </p>
  );
}

function StepReview({
  division,
  guardian,
  player,
  q,
  goTo,
}: {
  division: Division;
  guardian: GuardianAnswers | Person;
  player: PlayerAnswers;
  q: QuestionAnswers;
  goTo: (step: number) => void;
}) {
  const { data, index } = useSeason();
  const season = data.season;
  const window = windowFor(season, centralTimestamp(Date.now()));
  const availability = availabilityFromAnswers(q.days, q.times);
  const team = (id: ID) => (id ? teamOptionText(index, index.team.get(id)!) : 'None');
  const coachText = q.coach === 'same' ? 'Same coach as last season' : q.coach ? `Coach ${fullName(index.person.get(q.coach)!)}` : 'No preference';
  const requests = q.requests.filter((r) => r.name.trim()).map((r) => `${r.name.trim()} (${r.type})`);
  return (
    <div className={s.stack}>
      <dl className={s.summary}>
        <dt>Parent/guardian</dt>
        <dd>
          {guardian.firstName} {guardian.lastName} · {guardian.email}
        </dd>
        <dt>Player</dt>
        <dd>
          {player.firstName} {player.lastName} · born {player.birthdate ? formatDate(player.birthdate) : '—'} {player.birthdate.slice(0, 4)} ·{' '}
          {player.shirtSize}
        </dd>
        <dt>Division</dt>
        <dd>
          {division.name} · {division.label}
        </dd>
        <dt>Practice days</dt>
        <dd>
          {availability.map(formatWindow).join(', ') || '—'} · {q.onlyTheseDays === 'yes' ? 'only these days' : 'preferences'}
        </dd>
        <dt>1st choice</dt>
        <dd>{team(q.firstChoice)}</dd>
        <dt>2nd choice</dt>
        <dd>{team(q.secondChoice)}</dd>
        <dt>If full</dt>
        <dd>{q.anyFitting ? 'Any team on these days is fine' : 'Waitlist for my choices'}</dd>
        <dt>Coach request</dt>
        <dd>{coachText}</dd>
        <dt>Player requests</dt>
        <dd>{requests.join(', ') || 'None'}</dd>
        <dt>Matters most</dt>
        <dd>{[q.mostImportant, q.secondMostImportant].filter((f): f is Factor => !!f).map((f) => FACTOR_LABELS[f]).join(', then ') || '—'}</dd>
      </dl>
      <div className={s.row}>
        <button type="button" className={s.linkButton} onClick={() => goTo(1)}>
          Edit player
        </button>
        <button type="button" className={s.linkButton} onClick={() => goTo(2)}>
          Edit soccer questions
        </button>
      </div>
      <p className={s.ruleNote}>
        <WindowText window={window} />
      </p>
      <div className={s.totals} aria-label="Order total">
        <div>
          <span>Soccer · Spring 2027 registration</span>
          <span>${FEE.toFixed(2)}</span>
        </div>
        <div>
          <span>Processing fee</span>
          <span>${PROCESSING_FEE.toFixed(2)}</span>
        </div>
        <div className={s.total}>
          <span>Total</span>
          <span>${(FEE + PROCESSING_FEE).toFixed(2)}</span>
        </div>
      </div>
      <p className={s.hint}>Payment is mocked: no card is asked for and nothing is charged. In the real form, SportsEngine takes payment here.</p>
    </div>
  );
}

function WindowText({ window }: { window: RegistrationWindow }) {
  const { data } = useSeason();
  const season = data.season;
  if (window === 'early')
    return (
      <>
        <strong>Early registration.</strong> Fully refundable until round 1 publishes on {formatDate(season.round1Publish)}. Early registrants are
        placed first, and you&apos;ll hear which team on {formatDate(season.round1Publish)}.
      </>
    );
  if (window === 'late')
    return (
      <>
        <strong>Late registration.</strong> Registration closed {formatDate(season.windows.regular.end)}, so this goes to the waitlist and is offered
        a seat as one opens.
      </>
    );
  return (
    <>
      <strong>Regular registration.</strong> Placed in round 2; rosters come out {formatDate(season.round2Publish)}. (Early registration runs{' '}
      {formatDate(season.windows.early.start)} – {formatDate(season.windows.early.end)}.)
    </>
  );
}

function Receipt({
  submitted,
  headingRef,
  onSibling,
}: {
  submitted: Submitted;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onSibling: () => void;
}) {
  const { index } = useSeason();
  const { registration: r, player, guardian, confirmation } = submitted;
  const division = index.division.get(r.divisionId);
  const first = r.choices[0] ? index.team.get(r.choices[0].teamId) : undefined;
  return (
    <section className={`card ${s.receipt}`}>
      <div className={s.receiptCheck} aria-hidden="true">
        ✓
      </div>
      <h1 ref={headingRef} tabIndex={-1} style={{ fontSize: 'var(--text-2xl)' }}>
        Thank you, {guardian.firstName}! Your registration is complete.
      </h1>
      <dl className={s.summary}>
        <dt>Confirmation</dt>
        <dd>{confirmation}</dd>
        <dt>Player</dt>
        <dd>{fullName(player)}</dd>
        <dt>Program</dt>
        <dd>
          Soccer · Spring 2027 · {division?.name} ({division?.label})
        </dd>
        <dt>1st choice</dt>
        <dd>{first ? teamOptionText(index, first) : 'None'}</dd>
        <dt>Paid</dt>
        <dd>${(FEE + PROCESSING_FEE).toFixed(2)} (mock)</dd>
      </dl>
      <p className={s.ruleNote}>
        <WindowText window={r.window} />
      </p>
      <div className={s.continueBox}>
        <strong>Want to rank every team option or check a friend request?</strong>
        <span className="muted">Takes about 3 minutes. You can change it until the day after Meet the Coaches.</span>
        <div>
          <Link className="button" href={`/preferences/?ref=${r.id}`}>
            Continue to team preferences
          </Link>
        </div>
      </div>
      <div className={s.row}>
        <button type="button" className="button secondary" onClick={onSibling}>
          Register another player
        </button>
        <Link href={`/finder/?division=${division?.code ?? ''}`}>Back to the Team Finder</Link>
      </div>
    </section>
  );
}
