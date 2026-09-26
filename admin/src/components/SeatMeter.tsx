import { AlertTriangle, CreditCard } from "lucide-react";
import { Link } from "react-router-dom";
import { useNursery, useSeats } from "../hooks/useMeContext";
import type { SeatUsage } from "../types/api";

/**
 * Student places used against the plan's cap.
 *
 * Turns amber near the limit and rose at it, so an admin sees the wall coming
 * rather than discovering it when a create fails.
 */
export function SeatMeter({ seats, compact = false }: { seats?: SeatUsage; compact?: boolean }) {
  const fallback = useSeats();
  const usage = seats ?? fallback;
  if (!usage) return null;

  const unlimited = usage.students_max <= 0;
  const pct = unlimited
    ? 0
    : Math.min(100, Math.round((usage.students_used / usage.students_max) * 100));
  const full = !unlimited && usage.students_used >= usage.students_max;
  const near = !full && pct >= 85;

  const barColor = full ? "bg-rose-500" : near ? "bg-amber-500" : "bg-brand-500";
  const textColor = full ? "text-rose-600" : near ? "text-amber-600" : "text-slate-500";

  return (
    <div className={compact ? "" : "card p-5"}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Student places
        </span>
        <span className={`text-xs font-bold ${textColor}`}>
          {unlimited ? `${usage.students_used} · unlimited` : `${usage.students_used} / ${usage.students_max}`}
        </span>
      </div>
      {!unlimited && (
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${Math.max(pct, 2)}%` }}
            role="progressbar"
            aria-valuenow={usage.students_used}
            aria-valuemin={0}
            aria-valuemax={usage.students_max}
          />
        </div>
      )}
      {full && (
        <p className="mt-2 text-xs font-semibold text-rose-600">
          Every place is taken. Remove a student or upgrade to add more.
        </p>
      )}
      {!compact && usage.plan_name && (
        <p className="mt-2 text-xs font-semibold text-slate-400">{usage.plan_name} plan</p>
      )}
    </div>
  );
}

/**
 * Billing & Account State Banner.
 *
 * Shown while a nursery is suspended, past due, or writes are locked.
 */
export function BillingBanner() {
  const seats = useSeats();
  const nursery = useNursery();

  const isSuspended =
    nursery?.status === "suspended" ||
    seats?.status === "suspended" ||
    (seats !== undefined && !seats.allows_writes);

  if (!isSuspended && !seats?.payment_due) return null;

  const locked = isSuspended || (seats ? !seats.allows_writes : false);

  return (
    <div
      role="status"
      className={`mb-6 flex flex-wrap items-center gap-3.5 rounded-2xl border px-5 py-4 shadow-sm ${
        locked
          ? "border-rose-300 bg-rose-50/90 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
          : "border-amber-300 bg-amber-50/90 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
      }`}
    >
      {locked ? (
        <AlertTriangle size={22} className="shrink-0 text-rose-600 dark:text-rose-400" />
      ) : (
        <CreditCard size={22} className="shrink-0 text-amber-600 dark:text-amber-400" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black tracking-tight">
          {locked
            ? "⚠️ Nursery Account Suspended — User Registrations & Modifications Frozen"
            : "Subscription Payment Overdue"}
        </p>
        <p className={`text-xs mt-0.5 font-medium ${locked ? "text-rose-700 dark:text-rose-300" : "text-amber-700 dark:text-amber-300"}`}>
          {locked
            ? "This nursery account has been suspended by the platform administrator. Adding new children, teachers, or modifying records is temporarily disabled. Please contact platform support or settle outstanding subscription invoices to restore full access."
            : seats?.grace_until
              ? `Settle your balance before ${seats.grace_until} to keep registering users without interruption.`
              : "Please settle your subscription invoice to avoid service interruption."}
        </p>
      </div>
      <Link
        to="/billing"
        className={`btn shrink-0 text-xs font-bold ${
          locked
            ? "bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
            : "btn-secondary"
        }`}
      >
        View Billing
      </Link>
    </div>
  );
}
