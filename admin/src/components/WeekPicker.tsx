import { ChevronLeft, ChevronRight } from "lucide-react";

/** Monday of the given date, normalized to midnight (matches the API's week logic). */
export function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const weekday = out.getDay() === 0 ? 7 : out.getDay();
  out.setDate(out.getDate() + 1 - weekday);
  return out;
}

export function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

interface WeekPickerProps {
  week: Date; // Monday
  onChange: (monday: Date) => void;
}

export function WeekPicker({ week, onChange }: WeekPickerProps) {
  const end = addDays(week, 6);
  const fmt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return (
    <div className="flex items-center gap-2">
      <button type="button" className="btn-secondary !px-2" onClick={() => onChange(addDays(week, -7))} aria-label="Previous week">
        <ChevronLeft size={16} />
      </button>
      <span className="min-w-44 text-center text-sm font-medium">
        {week.toLocaleDateString(undefined, fmt)} – {end.toLocaleDateString(undefined, fmt)}, {end.getFullYear()}
      </span>
      <button type="button" className="btn-secondary !px-2" onClick={() => onChange(addDays(week, 7))} aria-label="Next week">
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
