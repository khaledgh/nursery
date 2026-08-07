import type { ReportMood, ReportRating } from "../../types/api";

/**
 * The daily-report vocabulary, shared by the standalone Reports page and the
 * Reports tab on a child's profile.
 *
 * These lists were previously duplicated verbatim in both places while hitting
 * the same `PUT /children/:id/reports`, so adding a dimension meant editing two
 * files and a drift between them would silently change what teachers could
 * record depending on which screen they opened.
 */

/** The six behaviour dimensions a teacher rates each day. */
export const DIMENSIONS: { key: ReportRating["dimension"]; label: string }[] = [
  { key: "social", label: "Engagement with classmates" },
  { key: "participation", label: "Participation in activities" },
  { key: "listening", label: "Listening to the teacher" },
  { key: "focus", label: "Focus & concentration" },
  { key: "hygiene", label: "Hygiene / self-care" },
  { key: "eating", label: "Meal / eating habits" },
];

export const RATING_OPTIONS: ReportRating["rating"][] = [
  "thriving",
  "doing_well",
  "improving",
  "needs_support",
];

export const MOODS: { key: ReportMood["key"]; label: string }[] = [
  { key: "social", label: "Social" },
  { key: "creative", label: "Creative" },
  { key: "happy", label: "Happy" },
  { key: "calm", label: "Calm" },
];

export const MOOD_OPTIONS: ReportMood["rating"][] = ["great", "good", "okay"];

/** Tints for the behaviour ratings, worst-to-best. */
export const RATING_TINT: Record<string, string> = {
  thriving: "bg-emerald-100 text-emerald-700",
  doing_well: "bg-sky-100 text-sky-700",
  improving: "bg-amber-100 text-amber-700",
  needs_support: "bg-rose-100 text-rose-700",
};

/** Ordinal score per rating, for charting a trend over time. */
export const RATING_SCORE: Record<string, number> = {
  needs_support: 1,
  improving: 2,
  doing_well: 3,
  thriving: 4,
};
