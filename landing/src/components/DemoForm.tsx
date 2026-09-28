import { Loader2, PartyPopper, Send } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useState } from "react";
import type { Dict, Locale } from "../i18n";
import { submitDemoRequest } from "../lib/api";

type Field =
  | "full_name"
  | "nursery_name"
  | "email"
  | "phone"
  | "city"
  | "country"
  | "children_range"
  | "preferred_contact_time"
  | "message";

type Values = Record<Field, string> & { website: string };

const empty: Values = {
  full_name: "",
  nursery_name: "",
  email: "",
  phone: "",
  city: "",
  country: "",
  children_range: "",
  preferred_contact_time: "",
  message: "",
  website: "",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface Props {
  t: Dict["form"];
  ranges: Dict["ranges"];
  locale: Locale;
  initialRange?: string;
  compact?: boolean;
}

export function DemoForm({ t, ranges, locale, initialRange = "", compact = false }: Props) {
  const id = useId();
  const [values, setValues] = useState<Values>({ ...empty, children_range: initialRange });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (initialRange) setValues((v) => ({ ...v, children_range: initialRange }));
  }, [initialRange]);

  const set = (field: Field | "website") => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    if (field !== "website" && errors[field]) setErrors((er) => ({ ...er, [field]: undefined }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<Field, string>> = {};
    if (values.full_name.trim().length < 2) next.full_name = t.errors.required;
    if (values.nursery_name.trim().length < 2) next.nursery_name = t.errors.required;
    if (!EMAIL_RE.test(values.email.trim())) next.email = values.email.trim() ? t.errors.email : t.errors.required;
    if (values.phone.replace(/[^\d]/g, "").length < 6) next.phone = values.phone.trim() ? t.errors.phone : t.errors.required;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setFormError("");
    if (!validate()) return;
    setStatus("sending");
    const res = await submitDemoRequest({ ...values, locale });
    if (res.ok) {
      setStatus("done");
      return;
    }
    setStatus("idle");
    if (res.kind === "validation") {
      const mapped: Partial<Record<Field, string>> = {};
      for (const key of Object.keys(res.fields) as Field[]) {
        mapped[key] = key === "email" ? t.errors.email : key === "phone" ? t.errors.phone : t.errors.required;
      }
      setErrors(mapped);
    } else {
      setFormError(res.kind === "rate_limited" ? t.errors.rateLimited : t.errors.generic);
    }
  };

  const input =
    "w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-[15px] font-semibold text-ink placeholder:text-slate-400 outline-none transition focus:border-teal focus:ring-4 focus:ring-teal/15";

  const field = (name: Field, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, required = false) => (
    <div>
      <label htmlFor={`${id}-${name}`} className="mb-1.5 block text-sm font-extrabold text-ink/80">
        {label}
        {required && <span className="text-coral"> *</span>}
      </label>
      <input
        id={`${id}-${name}`}
        name={name}
        value={values[name]}
        onChange={set(name)}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? `${id}-${name}-err` : undefined}
        className={`${input} ${errors[name] ? "!border-coral" : ""}`}
        {...props}
      />
      {errors[name] && (
        <p id={`${id}-${name}-err`} className="mt-1 text-xs font-bold text-coral">
          {errors[name]}
        </p>
      )}
    </div>
  );

  return (
    <AnimatePresence mode="wait">
      {status === "done" ? (
        <motion.div
          key="done"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center py-10 text-center"
          role="status"
        >
          <motion.span
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 10, delay: 0.1 }}
            className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-teal to-violet text-white shadow-lg"
          >
            <PartyPopper size={36} />
          </motion.span>
          <h3 className="mt-5 text-2xl font-black text-ink">{t.successTitle}</h3>
          <p className="mt-2 max-w-sm text-muted">{t.successBody}</p>
          <button
            type="button"
            onClick={() => {
              setValues(empty);
              setStatus("idle");
            }}
            className="btn-ghost mt-6 text-sm"
          >
            {t.again}
          </button>
        </motion.div>
      ) : (
        <motion.form key="form" noValidate onSubmit={onSubmit} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative space-y-4">
          {/* Honeypot: invisible to people, tempting to bots. */}
          <div className="sr-only" aria-hidden="true">
            <label>
              Website
              <input tabIndex={-1} autoComplete="off" name="website" value={values.website} onChange={set("website")} />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {field("full_name", t.fullName, { autoComplete: "name", maxLength: 120 }, true)}
            {field("nursery_name", t.nurseryName, { autoComplete: "organization", maxLength: 160 }, true)}
            {field("email", t.email, { type: "email", autoComplete: "email", inputMode: "email", maxLength: 190, dir: "ltr" }, true)}
            {field("phone", t.phone, { type: "tel", autoComplete: "tel", inputMode: "tel", maxLength: 40, dir: "ltr" }, true)}
            {!compact && field("city", t.city, { autoComplete: "address-level2", maxLength: 100 })}
            {!compact && field("country", t.country, { autoComplete: "country-name", maxLength: 100 })}
            <div>
              <label htmlFor={`${id}-range`} className="mb-1.5 block text-sm font-extrabold text-ink/80">
                {t.children}
              </label>
              <select id={`${id}-range`} value={values.children_range} onChange={set("children_range")} className={input}>
                <option value="">{t.childrenPlaceholder}</option>
                {(Object.keys(ranges) as (keyof typeof ranges)[]).map((k) => (
                  <option key={k} value={k}>
                    {ranges[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${id}-time`} className="mb-1.5 block text-sm font-extrabold text-ink/80">
                {t.preferredTime}
              </label>
              <select id={`${id}-time`} value={values.preferred_contact_time} onChange={set("preferred_contact_time")} className={input}>
                {(Object.keys(t.preferredTimeOptions) as (keyof typeof t.preferredTimeOptions)[]).map((k) => (
                  <option key={k} value={k === "anytime" ? "" : k}>
                    {t.preferredTimeOptions[k]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor={`${id}-message`} className="mb-1.5 block text-sm font-extrabold text-ink/80">
              {t.message}
            </label>
            <textarea
              id={`${id}-message`}
              rows={compact ? 3 : 4}
              maxLength={2000}
              value={values.message}
              onChange={set("message")}
              placeholder={t.messagePlaceholder}
              className={`${input} resize-none`}
            />
          </div>

          {formError && (
            <p role="alert" className="rounded-2xl bg-coral/10 px-4 py-3 text-sm font-bold text-coral">
              {formError}
            </p>
          )}

          <button type="submit" disabled={status === "sending"} className="btn-primary w-full text-base disabled:opacity-70">
            {status === "sending" ? (
              <>
                <Loader2 size={18} className="animate-spin" /> {t.sending}
              </>
            ) : (
              <>
                {t.submit} <Send size={17} className="rtl:-scale-x-100" />
              </>
            )}
          </button>
        </motion.form>
      )}
    </AnimatePresence>
  );
}

export default DemoForm;
