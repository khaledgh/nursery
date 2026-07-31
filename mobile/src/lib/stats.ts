// Pure date/derivation helpers shared across screens.

import type { Guardian, MealLog } from "../api/types";

/** Monday of the given date at local midnight (matches the API's week logic). */
export function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const weekday = out.getDay() === 0 ? 7 : out.getDay();
  out.setDate(out.getDate() + 1 - weekday);
  return out;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * RFC3339 timestamp carrying the device's UTC offset.
 *
 * Date.prototype.toISOString() converts to UTC and appends "Z", which silently
 * moves an 18:00 nap into the following day for eastern offsets — the server
 * buckets care logs by calendar date, so that lands the entry on the wrong day.
 */
export function toLocalRFC3339(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const zone = offsetMin === 0 ? "Z" : `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${zone}`
  );
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Range params for one Monday-start week. */
export function weekRange(weekStart: Date): { from: string; to: string } {
  return { from: toISODate(weekStart), to: toISODate(addDays(weekStart, 6)) };
}

const MEAL_SCORE: Record<string, number> = { ate_well: 100, ate_half: 50, ate_little: 25, didnt_eat: 0 };

/** Average appetite percentage across meal logs (0 when no meals). */
export function appetitePct(meals: MealLog[]): number {
  if (!meals.length) return 0;
  const sum = meals.reduce((acc, m) => acc + (MEAL_SCORE[m.status] ?? 0), 0);
  return Math.round(sum / meals.length);
}

/** Groups time-stamped rows by local calendar day ("YYYY-MM-DD"). */
export function groupByDay<T>(rows: T[], getTime: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const key = toISODate(new Date(getTime(row)));
    const list = out.get(key);
    if (list) list.push(row);
    else out.set(key, [row]);
  }
  return out;
}

/** "4y 3m" style age label from a date of birth. */
export function childAgeLabel(dob: string): string {
  const birth = new Date(dob);
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem}m`;
  return rem === 0 ? `${years}y` : `${years}y ${rem}m`;
}

/** "Mom" / "Dad" / "Family" for the home greeting, from the child's guardian rows. */
export function relationshipLabel(guardians: Guardian[] | undefined, userId: number | undefined): string {
  const mine = guardians?.find((g) => g.parent_user_id === userId);
  switch (mine?.relationship) {
    case "mother":
      return "Mom";
    case "father":
      return "Dad";
    default:
      return "Family";
  }
}

export function formatTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}

export function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
}

export function minutesLabel(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Money in minor units → localized currency string. */
export function formatMoney(minor: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: currency || "SEK" }).format(minor / 100);
}
