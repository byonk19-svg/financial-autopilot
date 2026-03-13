const MAX_SIMPLEFIN_WINDOW_DAYS = 60;

function toUnixSeconds(input: Date): number {
  return Math.floor(input.getTime() / 1000);
}

function addCalendarDays(input: Date, days: number): Date {
  const copy = new Date(input.toISOString());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

export function buildBackfillWindowsExclusive(
  retentionMonths: number,
  nowInput: Date = new Date(),
): Array<{ startDate: number; endDate: number }> {
  const now = new Date(nowInput.toISOString());
  const start = new Date(now.toISOString());
  start.setUTCMonth(start.getUTCMonth() - retentionMonths);

  const endExclusive = addCalendarDays(now, 1);
  const windows: Array<{ startDate: number; endDate: number }> = [];
  let cursor = new Date(start.toISOString());

  while (cursor < endExclusive) {
    const windowStart = new Date(cursor.toISOString());
    const windowEndCandidate = addCalendarDays(windowStart, MAX_SIMPLEFIN_WINDOW_DAYS);
    const windowEndExclusive = windowEndCandidate < endExclusive ? windowEndCandidate : endExclusive;

    windows.push({
      startDate: toUnixSeconds(windowStart),
      endDate: toUnixSeconds(windowEndExclusive),
    });

    cursor = new Date(windowEndExclusive.toISOString());
  }

  return windows;
}
