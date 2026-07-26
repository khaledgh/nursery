import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { parseApiError } from "./apiError";

interface ApplyServerErrorsOptions<T extends FieldValues> {
  /** Server key -> form field, for the few places the names differ. */
  map?: Partial<Record<string, Path<T>>>;
}

/**
 * Moves server-side field errors onto the matching form inputs so FormField
 * renders them where the user can act on them.
 *
 * Returns whatever could not be attached to an input — an empty string when
 * everything landed. Assign it to the page's error banner so global failures
 * (401, 500, network) and unrecognised field names are still shown rather than
 * silently dropped.
 */
export function applyServerErrors<T extends FieldValues>(
  form: UseFormReturn<T>,
  err: unknown,
  opts: ApplyServerErrorsOptions<T> = {},
): string {
  const { message, fields } = parseApiError(err);
  const entries = Object.entries(fields);
  if (entries.length === 0) return message;

  const known = form.getValues();
  const leftovers: string[] = [];
  let firstField: Path<T> | undefined;

  for (const [key, text] of entries) {
    const target = (opts.map?.[key] ?? key) as Path<T>;
    if (!(target in known)) {
      // Reported against something this form does not render: surface it in the
      // banner instead of losing it.
      leftovers.push(`${key} ${text}`);
      continue;
    }
    form.setError(target, { type: "server", message: text });
    firstField ??= target;
  }

  if (firstField) {
    // setFocus throws for fields that are registered but not mounted.
    try {
      form.setFocus(firstField);
    } catch {
      /* not focusable — the inline message is still visible */
    }
  }

  return leftovers.join("; ");
}
