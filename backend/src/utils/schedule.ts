/**
 * Channel schedule helpers.
 *
 * Schedule JSON shape:
 * {
 *   enabled:  boolean,
 *   timezone: string,           // IANA, e.g. "Europe/Lisbon"
 *   weekdays: { start: "HH:MM", end: "HH:MM" } | null,  // null = always open on weekdays
 *   weekends: { start: "HH:MM", end: "HH:MM" } | null,  // null = always open on weekends
 * }
 *
 * A window where start > end crosses midnight (e.g. "18:00"–"08:59").
 */

export interface ChannelSchedule {
  enabled: boolean;
  timezone: string;
  weekdays: { start: string; end: string } | null;
  weekends: { start: string; end: string } | null;
}

function parseHHMM(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function isInWindow(nowMin: number, start: string, end: string): boolean {
  const s = parseHHMM(start);
  const e = parseHHMM(end);
  if (s <= e) {
    // same-day window (e.g. 09:00–18:00)
    return nowMin >= s && nowMin <= e;
  } else {
    // crosses midnight (e.g. 18:00–08:59)
    return nowMin >= s || nowMin <= e;
  }
}

/**
 * Returns true if the agent should respond right now according to its schedule.
 * If schedule is null / disabled, always returns true.
 */
export function isWithinSchedule(schedule: unknown): boolean {
  if (!schedule || typeof schedule !== 'object') return true;
  const s = schedule as ChannelSchedule;
  if (!s.enabled) return true;

  const tz = s.timezone ?? 'UTC';

  // Get current time in the configured timezone
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(now);

  const hourPart   = parts.find(p => p.type === 'hour')?.value ?? '0';
  const minutePart = parts.find(p => p.type === 'minute')?.value ?? '0';
  const weekday    = parts.find(p => p.type === 'weekday')?.value ?? 'Mon';

  const nowMin = parseInt(hourPart) * 60 + parseInt(minutePart);
  const isWeekend = weekday === 'Sat' || weekday === 'Sun';

  const window = isWeekend ? s.weekends : s.weekdays;

  // null window = always open for this day type
  if (window === null || window === undefined) return true;

  return isInWindow(nowMin, window.start, window.end);
}
