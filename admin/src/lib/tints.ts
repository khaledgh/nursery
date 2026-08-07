/**
 * Shared badge tints.
 *
 * These maps were previously copy-pasted into five feature pages, so the same
 * status could render in different colours depending on which screen you were
 * looking at. Import from here instead of redeclaring.
 */

const NEUTRAL = "bg-slate-100 text-slate-600";

export const ROLE_TINT: Record<string, string> = {
  superadmin: "bg-amber-100 text-amber-800",
  admin: "bg-purple-100 text-purple-700",
  teacher: "bg-sky-100 text-sky-700",
  parent: "bg-emerald-100 text-emerald-700",
};

export const INVOICE_STATUS_TINT: Record<string, string> = {
  due: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  overdue: "bg-rose-100 text-rose-700",
  cancelled: NEUTRAL,
};

export const SUBSCRIPTION_STATUS_TINT: Record<string, string> = {
  trialing: "bg-sky-100 text-sky-700",
  active: "bg-emerald-100 text-emerald-700",
  past_due: "bg-amber-100 text-amber-700",
  suspended: "bg-rose-100 text-rose-700",
  cancelled: NEUTRAL,
};

export const EVENT_STATUS_TINT: Record<string, string> = {
  scheduled: "bg-sky-100 text-sky-700",
  ongoing: "bg-emerald-100 text-emerald-700",
  completed: NEUTRAL,
  cancelled: "bg-rose-100 text-rose-700",
};

export const CATEGORY_TINT: Record<string, string> = {
  updates: "bg-sky-100 text-sky-700",
  reminders: "bg-amber-100 text-amber-700",
  events: "bg-purple-100 text-purple-700",
  health: "bg-rose-100 text-rose-700",
  general: NEUTRAL,
};

export const ACTION_TINT: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-700",
  update: "bg-sky-100 text-sky-700",
  delete: "bg-rose-100 text-rose-700",
  restore: "bg-emerald-100 text-emerald-700",
  purge: "bg-rose-200 text-rose-800",
  impersonate: "bg-amber-100 text-amber-800",
  login: NEUTRAL,
};

export const PRESENCE_TINT: Record<string, string> = {
  checked_in: "bg-emerald-100 text-emerald-700",
  checked_out: NEUTRAL,
  absent: "bg-rose-100 text-rose-700",
};

/** Looks up a tint, falling back to neutral for values we don't style. */
export function tint(map: Record<string, string>, key: string | undefined | null): string {
  return (key && map[key]) || NEUTRAL;
}
