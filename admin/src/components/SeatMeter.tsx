import { AlertTriangle, CreditCard } from "lucide-react";
import { Link } from "react-router-dom";
import { useSeats } from "../hooks/useMeContext";
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
 * Billing state banner.
 *
 * Shown while a subscription is past due or suspended. Writes may already be
 * blocked server-side, so this explains a failure the admin would otherwise
 * meet with no context.
 */
export function BillingBanner() {
  const seats = useSeats();
  if (!seats?.payment_due) return null;

  const locked = !seats.allows_writes;
  return (
    <div
      role="status"
      className={`mb-6 flex flex-wrap items-center gap-3 rounded-2xl border px-5 py-4 ${
        locked ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"
      }`}
    >
      {locked ? (
        <AlertTriangle size={18} className="shrink-0 text-rose-600" />
      ) : (
        <CreditCard size={18} className="shrink-0 text-amber-600" />
      )}
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-bold ${locked ? "text-rose-800" : "text-amber-800"}`}>
          {locked
            ? "Subscription inactive — new records cannot be added"
            : "Subscription payment is overdue"}
        </p>
        <p className={`text-xs font-semibold ${locked ? "text-rose-600" : "text-amber-700"}`}>
          {locked
            ? "Your existing records stay available to read. Settle the invoice to restore full access."
            : seats.grace_until
              ? `Settle before ${seats.grace_until} to keep adding records.`
              : "Settle the invoice to avoid interruption."}
        </p>
      </div>
      <Link to="/billing" className="btn btn-secondary shrink-0 text-xs">
        View billing
      </Link>
    </div>
  );
}
