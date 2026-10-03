import "server-only";

/**
 * Timezone-aware date helpers.
 *
 * Everything is stored in UTC (timestamptz) and converted to the user's zone
 * only when a *calendar day* boundary is needed — that is what makes "today's
 * study" correct for someone in Asia/Dhaka while the server runs anywhere.
 */

const dayFormatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${timeZone}|${JSON.stringify(options)}`;
  let cached = dayFormatterCache.get(key);
  if (!cached) {
    cached = new Intl.DateTimeFormat("en-CA", { timeZone, ...options });
    dayFormatterCache.set(key, cached);
  }
  return cached;
}

/** Minutes to add to UTC to get local wall-clock time in `timeZone`. */
export function tzOffsetMinutes(date: Date, timeZone: string): number {
  const parts = formatter(timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** "YYYY-MM-DD" as seen in `timeZone`. */
export function toLocalDayKey(date: Date, timeZone: string): string {
  return formatter(timeZone, { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function localHour(date: Date, timeZone: string): number {
  return Number(formatter(timeZone, { hour: "2-digit", hour12: false }).format(date)) % 24;
}

export function localMinute(date: Date, timeZone: string): number {
  return Number(formatter(timeZone, { minute: "2-digit" }).format(date));
}

/** 0 = Sunday … 6 = Saturday, in the user's timezone. */
export function localWeekday(date: Date, timeZone: string): number {
  const key = toLocalDayKey(date, timeZone);
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function weekdayOfKey(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function shiftDayKey(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split("-").map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return toLocalDayKey(next, "UTC");
}

export function startOfMonthKey(dayKey: string): string {
  return `${dayKey.slice(0, 7)}-01`;
}

/** The UTC instant at which `HH:mm:ss` occurs on `dayKey` in `timeZone`. */
export function instantFromLocal(dayKey: string, timeOfDay: string, timeZone: string): Date {
  const naive = Date.parse(`${dayKey}T${timeOfDay.length === 5 ? `${timeOfDay}:00` : timeOfDay}`);
  const guess = new Date(naive);
  const firstOffset = tzOffsetMinutes(guess, timeZone);
  let result = new Date(naive - firstOffset * 60000);
  // Second pass keeps DST transitions correct.
  const secondOffset = tzOffsetMinutes(result, timeZone);
  if (secondOffset !== firstOffset) result = new Date(naive - secondOffset * 60000);
  return result;
}

export type DayRange = { dayKey: string; start: Date; end: Date };

/** Half-open UTC range [start, end) covering one local calendar day. */
export function dayRange(dayKey: string, timeZone: string): DayRange {
  return {
    dayKey,
    start: instantFromLocal(dayKey, "00:00:00", timeZone),
    end: instantFromLocal(shiftDayKey(dayKey, 1), "00:00:00", timeZone),
  };
}

export function todayKey(timeZone: string, now = new Date()): string {
  return toLocalDayKey(now, timeZone);
}

export function weekRange(dayKey: string, timeZone: string, weekStartsOn = 6): DayRange & { dayKeys: string[] } {
  const weekday = weekdayOfKey(dayKey);
  const diff = (weekday - weekStartsOn + 7) % 7;
  const first = shiftDayKey(dayKey, -diff);
  const dayKeys = Array.from({ length: 7 }, (_, i) => shiftDayKey(first, i));
  return {
    dayKey,
    start: instantFromLocal(first, "00:00:00", timeZone),
    end: instantFromLocal(shiftDayKey(first, 7), "00:00:00", timeZone),
    dayKeys,
  };
}

export function monthRange(dayKey: string, timeZone: string) {
  const first = startOfMonthKey(dayKey);
  const [y, m] = first.split("-").map(Number) as [number, number];
  const nextMonthFirst = new Date(Date.UTC(y, m, 1));
  const last = toLocalDayKey(nextMonthFirst, "UTC");
  return {
    dayKey,
    first,
    last,
    start: instantFromLocal(first, "00:00:00", timeZone),
    end: instantFromLocal(last, "00:00:00", timeZone),
  };
}

/** "HH:mm:ss" → minutes past midnight. */
export function timeStringToMinutes(value: string): number {
  const [h = "0", m = "0", s = "0"] = value.split(":");
  return Number(h) * 60 + Number(m) + Number(s) / 60;
}

export function minutesToTimeString(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

/** Combine a day key and "HH:mm" into an absolute instant. */
export function combine(dayKey: string, timeOfDay: string, timeZone: string): Date {
  return instantFromLocal(dayKey, timeOfDay, timeZone);
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
    return true;
  } catch {
    return false;
  }
}
