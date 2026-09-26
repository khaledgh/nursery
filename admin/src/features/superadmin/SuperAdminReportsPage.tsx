import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  Layers,
  Printer,
  Receipt,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { api } from "../../lib/api";
import { useCurrency } from "../../hooks/useCurrency";
import { useAuthStore } from "../../store/auth";
import type { PlatformReport } from "../../types/api";

export function SuperAdminReportsPage() {
  const { formatMoney, formatMoneyCompact } = useCurrency();
  const accessToken = useAuthStore((s) => s.accessToken);

  const report = useQuery({
    queryKey: ["platform-reports"],
    queryFn: async () => (await api.get<{ data: PlatformReport }>("/superadmin/reports")).data.data,
    enabled: Boolean(accessToken),
  });

  const rep = report.data;
  const isLoading = report.isLoading;

  const totalInvoicedAmount = (rep?.paid_amount_minor ?? 0) + (rep?.overdue_amount_minor ?? 0);
  const collectionRate =
    totalInvoicedAmount > 0
      ? ((rep?.paid_amount_minor ?? 0) / totalInvoicedAmount) * 100
      : rep && rep.total_invoices > 0
      ? (rep.paid_invoices / rep.total_invoices) * 100
      : 100;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12 print:space-y-4 print:pb-0">
      <PageHeader
        title="Platform Financial & Capacity Reports"
        subtitle="Audited financial health, subscription tiers revenue, and network-wide childcare capacity."
        actions={
          <button
            onClick={handlePrint}
            className="btn btn-secondary text-xs sm:text-sm py-2 px-3 shadow-none border-slate-200/80 hover:border-teal-300 print:hidden"
          >
            <Printer size={14} />
            <span>Print Report</span>
          </button>
        }
      />

      {/* Top 4 Compact Executive Financial Metrics */}
      <div className="grid gap-3.5 grid-cols-2 lg:grid-cols-4">
        {/* Metric 1 */}
        <div className="card p-4 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Monthly Run Rate (MRR)
            </span>
            <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600">
              <TrendingUp size={15} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            {isLoading ? (
              <div className="h-7 w-20 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            ) : (
              <>
                <span className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  {formatMoneyCompact(rep?.mrr_minor ?? 0)}
                </span>
                <span className="text-xs font-semibold text-slate-400">/mo</span>
              </>
            )}
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-2 text-[11px]">
            <span className="text-slate-400">Annual Run Rate</span>
            <span className="font-extrabold text-teal-600 dark:text-teal-400">
              {formatMoneyCompact(rep?.arr_minor ?? (rep?.mrr_minor ?? 0) * 12)}/yr
            </span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="card p-4 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Network Capacity
            </span>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600">
              <Users size={15} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            {isLoading ? (
              <div className="h-7 w-20 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            ) : (
              <>
                <span className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  {rep?.total_children ?? 0}
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  / {rep?.total_capacity ?? 0} seats
                </span>
              </>
            )}
          </div>
          <div className="mt-2.5 space-y-1 border-t border-slate-100 dark:border-slate-800/60 pt-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Seat Utilization</span>
              <span className="font-extrabold text-slate-700 dark:text-slate-300">
                {rep?.capacity_used_pct ? rep.capacity_used_pct.toFixed(0) : "0"}%
              </span>
            </div>
            <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(rep?.capacity_used_pct ?? 0, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="card p-4 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Collection Health
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
              <CheckCircle2 size={15} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            {isLoading ? (
              <div className="h-7 w-16 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            ) : (
              <>
                <span className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  {collectionRate.toFixed(0)}%
                </span>
                <span className="text-xs font-semibold text-slate-400">efficiency</span>
              </>
            )}
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-2 text-[11px]">
            <span className="text-slate-400">Overdue balance</span>
            <span
              className={`font-extrabold ${
                (rep?.overdue_amount_minor ?? 0) > 0 ? "text-rose-600" : "text-teal-600"
              }`}
            >
              {formatMoney(rep?.overdue_amount_minor ?? 0)}
            </span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="card p-4 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Nurseries
            </span>
            <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <Building2 size={15} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            {isLoading ? (
              <div className="h-7 w-12 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            ) : (
              <>
                <span className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  {rep?.total_nurseries ?? 0}
                </span>
                <span className="text-xs font-semibold text-slate-400">childcare centers</span>
              </>
            )}
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-2 text-[11px]">
            <span className="text-slate-400">Good standing</span>
            <span className="font-extrabold text-teal-600">
              {(rep?.total_nurseries ?? 0) - (rep?.past_due_nurseries ?? 0)} active
            </span>
          </div>
        </div>
      </div>

      {/* Invoicing Health Balance Bar */}
      <div className="card p-5 sm:p-6 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt size={16} className="text-teal-600" />
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">
              Platform Invoicing & Collections Balance
            </h2>
          </div>
          <span className="text-xs font-bold text-slate-500">
            {rep?.total_invoices ?? 0} Total Invoices Raised
          </span>
        </div>

        {/* Visual progress bar of paid vs overdue */}
        <div className="space-y-1.5">
          <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-teal-500 transition-all duration-500"
              style={{ width: `${Math.min(collectionRate, 100)}%` }}
            />
            <div
              className="h-full bg-rose-500 transition-all duration-500"
              style={{ width: `${Math.max(0, 100 - collectionRate)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-teal-500 inline-block" />
              Settled Collections:{" "}
              <strong className="text-slate-800 dark:text-slate-200">
                {formatMoney(rep?.paid_amount_minor ?? 0)}
              </strong>{" "}
              ({rep?.paid_invoices ?? 0} invoices)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" />
              Overdue Balance:{" "}
              <strong className="text-rose-600">
                {formatMoney(rep?.overdue_amount_minor ?? 0)}
              </strong>{" "}
              ({rep?.overdue_invoices ?? 0} invoices)
            </span>
          </div>
        </div>
      </div>

      {/* Package Tier Performance Table */}
      <div className="card overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm bg-white dark:bg-slate-900">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-teal-600" />
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">
              Subscription Tiers & Revenue Breakdown
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            {rep?.tiers?.length ?? 0} capacity tiers configured
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[10px] font-black uppercase tracking-wider text-slate-400 text-start">
                <th className="py-2.5 px-4 text-start">Package Tier</th>
                <th className="py-2.5 px-3 text-start">Billing Cycle</th>
                <th className="py-2.5 px-3 text-center">Subscribed Nurseries</th>
                <th className="py-2.5 px-3 text-start">Subscriber Share</th>
                <th className="py-2.5 px-4 text-end">Total Revenue Generated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={14} className="animate-spin text-teal-600" />
                      <span>Loading financial report…</span>
                    </div>
                  </td>
                </tr>
              ) : rep?.tiers && rep.tiers.length > 0 ? (
                rep.tiers.map((tier) => {
                  const sharePct =
                    (rep.total_nurseries ?? 0) > 0
                      ? (tier.nursery_count / rep.total_nurseries) * 100
                      : 0;
                  return (
                    <tr
                      key={tier.plan_code}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3 px-4 font-black text-slate-900 dark:text-slate-100">
                        {tier.plan_name}
                        <span className="font-mono text-[10px] text-slate-400 font-normal block">
                          {tier.plan_code}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`badge text-[10px] px-2 py-0.5 font-bold ${
                            tier.billing_period === "yearly"
                              ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                              : "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300"
                          }`}
                        >
                          {tier.billing_period === "yearly" ? "Annual Term" : "Monthly Term"}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center font-extrabold text-slate-800 dark:text-slate-200">
                        {tier.nursery_count}
                      </td>

                      <td className="py-3 px-3 min-w-[120px]">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-500">
                            {sharePct.toFixed(0)}% of centers
                          </span>
                          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-teal-500 rounded-full transition-all duration-300"
                              style={{ width: `${sharePct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-end font-extrabold text-teal-600 dark:text-teal-400 text-sm">
                        {formatMoney(tier.revenue_minor)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No subscription tiers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
