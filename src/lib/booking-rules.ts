// Consultation hours in Brasília time (UTC-3, no daylight saving).
export const SLOT_MINUTES = 60;
export const DAY_START_HOUR = 9;
export const DAY_END_HOUR = 18; // last slot starts at 17:00
export const WORK_DAYS = [1, 2, 3, 4, 5]; // Mon–Fri
export const DAYS_AHEAD = 14;
export const MIN_NOTICE_HOURS = 12;
const OFFSET_MS = 3 * 3600000;

/** Candidate slot start times (UTC ms) before removing busy times. */
export function candidateSlots(now: number): number[] {
  const out: number[] = [];
  const local = new Date(now - OFFSET_MS);
  const base = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  for (let d = 0; d <= DAYS_AHEAD; d++) {
    const dayLocal = base + d * 86400000;
    if (!WORK_DAYS.includes(new Date(dayLocal).getUTCDay())) continue;
    for (let h = DAY_START_HOUR; h + SLOT_MINUTES / 60 <= DAY_END_HOUR; h++) {
      const start = dayLocal + h * 3600000 + OFFSET_MS;
      if (start >= now + MIN_NOTICE_HOURS * 3600000) out.push(start);
    }
  }
  return out;
}

export function freeSlots(now: number, busy: { start: number; end: number }[]): number[] {
  const len = SLOT_MINUTES * 60000;
  return candidateSlots(now).filter((s) => !busy.some((b) => s < b.end && s + len > b.start));
}
