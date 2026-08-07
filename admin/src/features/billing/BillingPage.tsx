import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../components/PageHeader";
import { SeatMeter } from "../../components/SeatMeter";
import { useMeContext } from "../../hooks/useMeContext";
import { api } from "../../lib/api";
import { SUBSCRIPTION_STATUS_TINT, tint } from "../../lib/tints";
import type { SeatUsage } from "../../types/api";

function money(minor: number, currency = "SEK") {
  return `${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currency}`;
}

/**
 * The nursery's own subscription: plan, seats, and payment state.
 *
 * Read-only by design — billing is arranged with the provider rather than
 * self-serve, so this explains the position instead of offering a checkout.
 */
export function BillingPage() {
  const { data: ctx } = useMeContext();

  const { data: seats } = useQuery({
    queryKey: ["seats"],
    queryFn: async () => (await api.get<{ data: SeatUsage }>("/me/seats")).data.data,
  });

  const usage = seats ?? ctx?.seats;

  return (
    <>
      <PageHeader
        title="Subscription & billing"
        subtitle={ctx?.nursery?.name ? `Plan and usage for ${ctx.nursery.name}` : undefined}
      />

      {!usage ? (
        <p className="text-sm font-semibold text-slate-500">Loading…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="card space-y-1 p-6">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Plan</p>
            <p className="text-2xl font-extrabold text-slate-900">{usage.plan_name || "—"}</p>
            <span className={`badge mt-2 inline-block ${tint(SUBSCRIPTION_STATUS_TINT, usage.status)}`}>
              {usage.status.replace("_", " ")}
            </span>
          </div>

          <SeatMeter seats={usage} />

          <div className="card space-y-1 p-6">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Staff places</p>
            <p className="text-2xl font-extrabold text-slate-900">
              {usage.staff_max <= 0 ? `${usage.staff_used}` : `${usage.staff_used} / ${usage.staff_max}`}
            </p>
            <p className="text-xs font-semibold text-slate-400">
              {usage.staff_max <= 0 ? "Unlimited on this plan" : "Admins and teachers"}
            </p>
          </div>

          <div className="card p-6 lg:col-span-3">
            <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-slate-700">
              Current period
            </h2>
            <dl className="grid gap-6 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Renews</dt>
                <dd className="mt-1 text-sm font-bold text-slate-800">{usage.period_end ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Grace until</dt>
                <dd className="mt-1 text-sm font-bold text-slate-800">{usage.grace_until ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Adding records
                </dt>
                <dd
                  className={`mt-1 text-sm font-bold ${
                    usage.allows_writes ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {usage.allows_writes ? "Enabled" : "Paused until settled"}
                </dd>
              </div>
            </dl>
            {!usage.allows_writes && (
              <p className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
                Existing records stay fully readable — only creating and editing is paused.
                Contact your provider to restore access.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export { money };
