import type { SeatInfo } from './helpers';
import s from './family.module.css';

/**
 * Seat status for a team option. First come, first served divisions hold a
 * seat at registration, so counts are firm; ranked divisions show estimates.
 */
export function SeatChip({ info, fcfs }: { info: SeatInfo; fcfs: boolean }) {
  const text =
    info.status === 'open'
      ? fcfs
        ? `Open · ${info.left} ${info.left === 1 ? 'seat' : 'seats'} left`
        : 'Seats open'
      : info.status === 'filling'
        ? fcfs
          ? `Filling · ${info.left} left`
          : 'Filling'
        : fcfs
          ? 'Full · waitlist'
          : 'Likely full · waitlist';
  const title = fcfs
    ? `${info.count} of ${info.max} seats taken. Seats are held when you register.`
    : `About ${info.count} of ${info.max} (estimate). Priority rules can still change who gets a seat.`;
  return (
    <span className={`${s.chip} ${s[info.status]}`} title={title}>
      {text}
      <span className={s.srOnly}>. {title}</span>
    </span>
  );
}

/** One line under the division explaining what the chips mean. */
export function seatRuleText(fcfs: boolean): string {
  return fcfs
    ? 'First come, first served: your 1st choice holds a seat as soon as you register and pay. Full options go to a waitlist.'
    : 'Seat counts are estimates. Teams are set by BVAC’s published rules (early registration, returning players, siblings), so a returning player can still take a seat until rosters are published.';
}
