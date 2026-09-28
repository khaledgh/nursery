import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Dict, Locale } from "../i18n";
import { DemoForm } from "./DemoForm";

interface Props {
  t: Dict["form"];
  ranges: Dict["ranges"];
  locale: Locale;
}

/**
 * One modal for the whole page. Any element with `data-demo` opens it;
 * `data-range="30_60"` pre-selects the children range (pricing cards).
 */
export default function DemoModal({ t, ranges, locale }: Props) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState("");
  const [session, setSession] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const trigger = (e.target as HTMLElement).closest<HTMLElement>("[data-demo]");
      if (!trigger) return;
      e.preventDefault();
      openerRef.current = trigger;
      setRange(trigger.dataset.range ?? "");
      setSession((s) => s + 1);
      setOpen(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!open) {
      openerRef.current?.focus();
      return;
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input:not([tabindex="-1"]), select, textarea',
        );
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const timer = setTimeout(() => dialogRef.current?.querySelector<HTMLElement>("input:not([tabindex='-1'])")?.focus(), 250);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      clearTimeout(timer);
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-ink/60" onClick={() => setOpen(false)} aria-hidden="true" />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="demo-modal-title"
            data-lenis-prevent
            initial={{ y: 80, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 160, damping: 20 }}
            className="relative max-h-[92vh] w-full overflow-x-hidden overflow-y-auto rounded-t-[2rem] bg-cream p-6 shadow-2xl sm:max-w-2xl sm:rounded-[2rem] sm:p-8"
          >
            <div className="glow glow-violet pointer-events-none absolute -top-16 -end-16 h-48 w-48" aria-hidden="true" />
            <div className="mb-6 flex items-start gap-4">
              <img src="/mark.webp" alt="" className="h-14 w-14 shrink-0 object-contain" />
              <div className="flex-1">
                <h2 id="demo-modal-title" className="text-2xl font-black text-ink">
                  {t.title}
                </h2>
                <p className="text-sm font-semibold text-muted">{t.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t.close}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-ink shadow-sm hover:bg-slate-50"
              >
                <X size={18} />
              </button>
            </div>
            <DemoForm key={session} t={t} ranges={ranges} locale={locale} initialRange={range} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
