// ============================================================
// fina functions - Vietnam time
//
// Functions run in UTC on Google's servers. Every check about "22:00" or
// "today" must use Asia/Ho_Chi_Minh, never the server clock.
//
// functions/ deploys separately and CANNOT import the app's src/ code.
// This is the only copy, and test/functions-time.test.ts checks it against
// Intl hour by hour - change one side and forget the other, the test fails.
// ============================================================

export const TIMEZONE = 'Asia/Ho_Chi_Minh';

export interface VnParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export function vnParts(date: Date): VnParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  // en-GB returns 24:00 for midnight in some ICU versions; map it to 0.
  const hour = get('hour') % 24;

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour,
    minute: get('minute'),
  };
}

/** '2026-09-02' in Vietnam time. Used as the duplicate-send key. */
export function dayKey(date: Date): string {
  const p = vnParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/**
 * Whether the reminder time falls in the current run's window.
 *
 * The job runs every `windowMinutes` minutes, so "exactly 22:00" almost never
 * hits. Catch the whole window [22:00, 22:00 + window).
 */
export function isReminderWindow(date: Date, hour: number, windowMinutes: number): boolean {
  const p = vnParts(date);
  return p.hour === hour && p.minute < windowMinutes;
}

/** Whole days between two timestamps. */
export function daysBetween(fromMs: number, toMs: number): number {
  return Math.floor((toMs - fromMs) / 86_400_000);
}
