import { DatePicker as HeroDatePicker, type DateValue } from "@heroui/react";
import { parseDate, parseDateTime } from "@internationalized/date";

export interface DatePickerProps {
  /** "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm" */
  value?: string;
  onChange: (isoString: string) => void;
  label?: string;
  placeholder?: string;
  size?: "sm" | "md" | "lg";
  isInvalid?: boolean;
  errorMessage?: string;
  className?: string;
  isDisabled?: boolean;
  isRequired?: boolean;
  ariaLabel?: string;
  /** When true, shows both date and time pickers (replaces datetime-local inputs) */
  hasTime?: boolean;
  granularity?: "day" | "hour" | "minute" | "second";
  minValue?: string;
  maxValue?: string;
}

export function DatePicker({
  value,
  onChange,
  label,
  placeholder,
  size = "md",
  isInvalid,
  errorMessage,
  className,
  isDisabled,
  isRequired,
  ariaLabel,
  hasTime = false,
  granularity,
  minValue,
  maxValue,
}: DatePickerProps) {
  const effectiveGranularity = granularity ?? (hasTime ? "minute" : "day");

  const getParsedDate = (val?: string): DateValue | null => {
    if (!val) return null;
    try {
      const clean = val.replace(/Z$/, "");
      if (hasTime || effectiveGranularity === "minute" || effectiveGranularity === "hour" || effectiveGranularity === "second") {
        if (clean.includes("T")) {
          let str = clean.slice(0, 19);
          if (str.length === 16) str = `${str}:00`;
          return parseDateTime(str) as unknown as DateValue;
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
          return parseDateTime(`${clean}T00:00:00`) as unknown as DateValue;
        }
      } else {
        const dateOnly = clean.slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
          return parseDate(dateOnly) as unknown as DateValue;
        }
      }
    } catch {
      return null;
    }
    return null;
  };

  return (
    <HeroDatePicker
      size={size}
      variant="bordered"
      radius="lg"
      label={label}
      labelPlacement={label ? "outside" : undefined}
      showMonthAndYearPickers
      granularity={effectiveGranularity}
      hideTimeZone
      value={getParsedDate(value) as any}
      minValue={minValue ? (getParsedDate(minValue) as any) : undefined}
      maxValue={maxValue ? (getParsedDate(maxValue) as any) : undefined}
      onChange={(date: any) => {
        if (!date) {
          onChange("");
          return;
        }
        const s = date.toString();
        if (hasTime || effectiveGranularity === "minute" || effectiveGranularity === "hour" || effectiveGranularity === "second") {
          onChange(s.slice(0, 16));
        } else {
          onChange(s.slice(0, 10));
        }
      }}
      isInvalid={isInvalid}
      errorMessage={errorMessage}
      isDisabled={isDisabled}
      isRequired={isRequired}
      aria-label={ariaLabel ?? label ?? placeholder ?? (hasTime ? "Select date and time" : "Select date")}
      className={className ?? "w-full"}
      classNames={{
        base: "w-full",
        calendarContent:
          "bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xl rounded-2xl p-2",
        inputWrapper: `bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 data-[focus=true]:border-primary data-[focus=true]:ring-4 data-[focus=true]:ring-primary/15 shadow-sm rounded-xl transition-all ${
          size === "sm" ? "min-h-[36px] py-1" : "min-h-[42px] py-2"
        }`,
        innerWrapper: "gap-2",
        segment: "text-slate-800 dark:text-slate-100 text-sm font-medium",
        selectorButton: "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200",
        label: "text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 select-none",
        timeInput: "text-sm font-medium text-slate-800 dark:text-slate-100",
        timeInputLabel: "text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400",
      }}
    />
  );
}
