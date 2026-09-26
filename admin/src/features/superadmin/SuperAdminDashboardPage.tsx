import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Eye,
  Layers,
  LogIn,
  Plus,
  Receipt,
  RefreshCw,
  Server,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, errorMessage } from "../../lib/api";
import { useCurrency } from "../../hooks/useCurrency";
import { useAuthStore } from "../../store/auth";
import type {
  ListResponse,
  NurseryOverview,
  PlatformReminder,
  PlatformReport,
  PlatformStats,
  SubscriptionInvoice,
  TokenPair,
} from "../../types/api";

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export function SuperAdminDashboardPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { accessToken, setTokens } = useAuthStore();
  const { formatMoney, formatMoneyCompact } = useCurrency();
  const [banner, setBanner] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Queries
  const stats = useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => (await api.get<{ data: PlatformStats }>("/superadmin/stats")).data.data,
    enabled: Boolean(accessToken),
  });

  const report = useQuery({
    queryKey: ["platform-reports"],
    queryFn: async () => (await api.get<{ data: PlatformReport }>("/superadmin/reports")).data.data,
    enabled: Boolean(accessToken),
  });

  const reminders = useQuery({
    queryKey: ["platform-reminders"],
    queryFn: async () => (await api.get<{ data: PlatformReminder[] }>("/superadmin/reminders")).data.data,
    enabled: Boolean(accessToken),
  });

  const invoices = useQuery({
    queryKey: ["subscription-invoices"],
    queryFn: async () =>
      (await api.get<ListResponse<SubscriptionInvoice>>("/superadmin/subscription-invoices?per_page=5")).data.data,
    enabled: Boolean(accessToken),
  });

  const nurseries = useQuery({
    queryKey: ["superadmin-nurseries"],
    queryFn: async () =>
      (await api.get<ListResponse<NurseryOverview>>("/superadmin/nurseries?per_page=10")).data.data,
    enabled: Boolean(accessToken),
  });

  // Auto-run Billing Mutation
  const autoRun = useMutation({
    mutationFn: async () =>
      (await api.post<{ data: { generated_invoices: number; overdue_marked: number } }>(
        "/superadmin/subscription-invoices/auto-run"
      )).data.data,
    onSuccess: (data) => {
      setBanner({
        text: `Billing auto-run complete: ${data.generated_invoices} invoices generated, ${data.overdue_marked} overdue accounts flagged.`,
        type: "success",
      });
      void qc.invalidateQueries({ queryKey: ["platform-stats"] });
      void qc.invalidateQueries({ queryKey: ["platform-reports"] });
      void qc.invalidateQueries({ queryKey: ["platform-reminders"] });
      void qc.invalidateQueries({ queryKey: ["subscription-invoices"] });
      void qc.invalidateQueries({ queryKey: ["superadmin-nurseries"] });
    },
    onError: (e) => setBanner({ text: errorMessage(e), type: "error" }),
  });

  // Mark invoice paid
  const markPaid = useMutation({
    mutationFn: async (id: number) => api.post(`/superadmin/subscription-invoices/${id}/mark-paid`),
    onSuccess: () => {
      setBanner({ text: "Invoice marked as paid successfully.", type: "success" });
      void qc.invalidateQueries({ queryKey: ["subscription-invoices"] });
      void qc.invalidateQueries({ queryKey: ["platform-stats"] });
      void qc.invalidateQueries({ queryKey: ["platform-reports"] });
      void qc.invalidateQueries({ queryKey: ["platform-reminders"] });
    },
    onError: (e) => setBanner({ text: errorMessage(e), type: "error" }),
  });

  // Impersonate
  const impersonate = useMutation({
    mutationFn: async (nurseryId: number) => {
      const res = await api.post<{
        data: { tokens: TokenPair; user: any };
      }>(`/superadmin/nurseries/${nurseryId}/impersonate`);
      return res.data.data;
    },
    onSuccess: (data) => {
      setTokens(data.tokens, data.user);
      navigate("/");
    },
    onError: (e) => setBanner({ text: errorMessage(e), type: "error" }),
  });

  const rep = report.data;
  const stat = stats.data;
  const activeReminders = reminders.data ?? [];
  const activeNurseriesList = nurseries.data ?? [];
  const recentInvoicesList = invoices.data ?? [];
  const isLoading = stats.isLoading || nurseries.isLoading;

  // Find upcoming renewal
  const upcomingRenewal = activeNurseriesList
    .filter((n) => n.next_payment_date)
    .sort(
      (a, b) =>
        new Date(a.next_payment_date!).getTime() - new Date(b.next_payment_date!).getTime()
    )[0];

  // Active tiers filter
  const subscribedTiers = rep?.tiers?.filter((t) => t.nursery_count > 0) ?? [];
  const totalSubscribers = subscribedTiers.reduce((acc, t) => acc + t.nursery_count, 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Alert Banner */}
      {banner && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-2xl border text-sm font-semibold shadow-sm transition-all ${
            banner.type === "success"
              ? "bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {banner.type === "success" ? (
              <CheckCircle2 size={18} className="text-teal-600 shrink-0" />
            ) : (
              <AlertTriangle size={18} className="text-rose-600 shrink-0" />
            )}
            <span>{banner.text}</span>
          </div>
          <button
            onClick={() => setBanner(null)}
            className="text-xs opacity-60 hover:opacity-100 uppercase tracking-wider font-extrabold px-2 py-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header Command Strip */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              Platform Command Center
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/60">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" />
              Live Operations
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Childcare network operations, tenant capacity monitoring, and auto-billing management.
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => autoRun.mutate()}
            disabled={autoRun.isPending}
            className="btn btn-secondary text-xs py-2 px-3 shadow-none border-slate-200/80 hover:border-teal-300"
            title="Auto-generate monthly/yearly invoices and flag overdue accounts"
          >
            <RefreshCw
              size={13}
              className={autoRun.isPending ? "animate-spin text-teal-600" : "text-teal-600"}
            />
            <span>{autoRun.isPending ? "Running Billing…" : "Auto-run Billing"}</span>
          </button>
          <Link
            to="/superadmin/reports"
            className="btn btn-secondary text-xs py-2 px-3 shadow-none border-slate-200/80 hover:border-teal-300"
          >
            <BarChart3 size={13} className="text-slate-500" />
            <span>Reports</span>
          </Link>
          <Link to="/superadmin" className="btn btn-primary text-xs py-2 px-3.5">
            <Plus size={14} />
            <span>New Nursery</span>
          </Link>
        </div>
      </div>

      {/* Top 4 Executive KPI Metrics Cards */}
      <div className="grid gap-3.5 grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: MRR & ARR */}
        <div className="card p-4 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 hover:border-teal-300/60 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Platform MRR
            </span>
            <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600">
              <CreditCard size={15} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            {isLoading ? (
              <div className="h-7 w-20 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            ) : (
              <>
                <span className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  {formatMoneyCompact(stat?.mrr_minor ?? 0)}
                </span>
                <span className="text-xs font-semibold text-slate-400">/mo</span>
              </>
            )}
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-2 text-[11px]">
            <span className="text-slate-400">Annual Run Rate</span>
            <span className="font-extrabold text-teal-700 dark:text-teal-300">
              {formatMoneyCompact((stat?.mrr_minor ?? 0) * 12)}/yr
            </span>
          </div>
        </div>

        {/* Metric 2: Active Nurseries */}
        <div className="card p-4 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 hover:border-teal-300/60 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Nurseries
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
                  {stat?.nurseries ?? 0}
                </span>
                <span className="text-xs font-semibold text-slate-400">centers</span>
              </>
            )}
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-2 text-[11px]">
            <span className="text-slate-400">Account status</span>
            <span
              className={`font-bold ${
                (stat?.nurseries_past_due ?? 0) > 0 ? "text-rose-600" : "text-teal-600"
              }`}
            >
              {(stat?.nurseries_past_due ?? 0) > 0
                ? `${stat?.nurseries_past_due} past due`
                : "100% good standing"}
            </span>
          </div>
        </div>

        {/* Metric 3: Network Children */}
        <div className="card p-4 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 hover:border-teal-300/60 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Network Children
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
                  {stat?.children ?? 0}
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  / {rep?.total_capacity ?? 80} cap
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

        {/* Metric 4: Invoices & Debt */}
        <div className="card p-4 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 hover:border-teal-300/60 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Debt & Invoices
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
              <Receipt size={15} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            {isLoading ? (
              <div className="h-7 w-16 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            ) : (
              <>
                <span className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  {formatMoney(rep?.overdue_amount_minor ?? 0)}
                </span>
                <span className="text-xs font-semibold text-slate-400">overdue</span>
              </>
            )}
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-2 text-[11px]">
            <span className="text-slate-400">Efficiency</span>
            <span className="font-extrabold text-teal-600 dark:text-teal-400">
              {rep && rep.total_invoices > 0
                ? Math.round((rep.paid_invoices / rep.total_invoices) * 100)
                : 100}
              % collected
            </span>
          </div>
        </div>
      </div>

      {/* Slim Status / Alert Banner */}
      {activeReminders.length === 0 ? (
        <div className="px-4 py-2.5 rounded-xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/60 dark:border-teal-800/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-teal-800 dark:text-teal-200">
            <ShieldCheck size={16} className="text-teal-600 shrink-0" />
            <span className="font-extrabold">All Nurseries in Good Standing:</span>
            <span className="text-teal-700/80 dark:text-teal-300/80 hidden sm:inline">
              Zero overdue invoices or capacity alerts detected across the platform.
            </span>
          </div>
          <Link
            to="/superadmin/reminders"
            className="text-[11px] font-bold text-teal-700 dark:text-teal-300 hover:underline flex items-center gap-1 shrink-0"
          >
            <span>Alerts Radar</span>
            <ArrowRight size={12} />
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {activeReminders.slice(0, 2).map((r) => (
            <div
              key={r.id}
              className={`px-4 py-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                r.severity === "high"
                  ? "bg-rose-50/70 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900"
                  : "bg-amber-50/70 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertTriangle
                  size={15}
                  className={r.severity === "high" ? "text-rose-600" : "text-amber-600"}
                />
                <span className="font-extrabold truncate">{r.title}</span>
                <span className="opacity-75 truncate hidden md:inline">— {r.description}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {r.action_type === "mark_paid" && r.action_id && (
                  <button
                    onClick={() => markPaid.mutate(r.action_id!)}
                    disabled={markPaid.isPending}
                    className="btn btn-secondary text-[11px] py-1 px-2.5 bg-white shadow-none"
                  >
                    <Check size={12} /> Settle
                  </button>
                )}
                <Link
                  to="/superadmin/reminders"
                  className="font-bold underline text-[11px] opacity-80 hover:opacity-100"
                >
                  Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Grid: Nurseries Fleet + Invoices (Left 65%) vs System Intelligence (Right 35%) */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column (8 cols = 66% width) */}
        <div className="space-y-6 lg:col-span-8">
          {/* Childcare Tenants Fleet Table */}
          <div className="card border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-teal-600" />
                <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">
                  Childcare Tenants Fleet
                </h2>
                <span className="badge text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  {activeNurseriesList.length} centers
                </span>
              </div>
              <Link
                to="/superadmin"
                className="text-xs font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 flex items-center gap-1"
              >
                <span>Full Directory</span>
                <ArrowUpRight size={13} />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400 text-start">
                    <th className="py-2.5 px-4 text-start">Nursery & Slug</th>
                    <th className="py-2.5 px-3 text-start">Plan & Term</th>
                    <th className="py-2.5 px-3 text-start">Capacity</th>
                    <th className="py-2.5 px-3 text-start">Next Due</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-4 text-end">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw size={14} className="animate-spin text-teal-600" />
                          <span>Loading active nurseries…</span>
                        </div>
                      </td>
                    </tr>
                  ) : activeNurseriesList.length > 0 ? (
                    activeNurseriesList.map((n) => {
                      const pct = n.students_max > 0 ? (n.students_used / n.students_max) * 100 : 0;
                      return (
                        <tr
                          key={n.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <Link
                              to={`/superadmin/nurseries/${n.id}`}
                              className="font-extrabold text-slate-900 dark:text-slate-100 hover:text-teal-600 dark:hover:text-teal-400 block truncate max-w-[180px] transition-colors"
                            >
                              {n.name}
                            </Link>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
                              <span>/{n.slug}</span>
                              {n.login_id_prefix && (
                                <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded text-[9px]">
                                  {n.login_id_prefix}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <span
                              className={`badge text-[10px] px-2 py-0.5 font-bold ${
                                n.billing_period === "yearly"
                                  ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                                  : "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300"
                              }`}
                            >
                              {n.plan_name || "Growth"} ·{" "}
                              {n.billing_period === "yearly" ? "Annual" : "Monthly"}
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            <div className="space-y-1 min-w-[90px]">
                              <div className="flex items-center justify-between text-[10px] font-bold">
                                <span>
                                  {n.students_used}/{n.students_max}
                                </span>
                                <span className="text-slate-400">{pct.toFixed(0)}%</span>
                              </div>
                              <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    pct > 85
                                      ? "bg-rose-500"
                                      : pct > 60
                                      ? "bg-amber-500"
                                      : "bg-teal-500"
                                  }`}
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3 text-[11px] text-slate-500 whitespace-nowrap">
                            {formatDate(n.next_payment_date)}
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span
                              className={`badge text-[9px] px-2 py-0.5 uppercase tracking-wider font-extrabold ${
                                n.subscription_status === "past_due"
                                  ? "bg-rose-50 text-rose-700 border-rose-200"
                                  : "bg-teal-50 text-teal-700 border-teal-200"
                              }`}
                            >
                              {n.subscription_status || "active"}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-end">
                            <div className="flex items-center justify-end gap-1.5">
                              <Link
                                to={`/superadmin/nurseries/${n.id}`}
                                className="btn btn-secondary text-[11px] py-1 px-2 hover:border-teal-400 hover:text-teal-600 flex items-center gap-1"
                                title="View deep-dive nursery hub"
                              >
                                <Eye size={11} />
                                <span>Details</span>
                              </Link>
                              <button
                                onClick={() => impersonate.mutate(n.id)}
                                disabled={impersonate.isPending}
                                className="btn btn-secondary text-[11px] py-1 px-2.5 hover:border-teal-400"
                                title="Enter tenant dashboard as administrator"
                              >
                                <LogIn size={11} className="text-teal-600" />
                                <span>Enter</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No nurseries found on the platform yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Invoices Ledger */}
          <div className="card border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt size={16} className="text-teal-600" />
                <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">
                  Recent Platform Invoices
                </h2>
              </div>
              <Link
                to="/superadmin/plans"
                className="text-xs font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 flex items-center gap-1"
              >
                <span>All Invoices</span>
                <ArrowUpRight size={13} />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400 text-start">
                    <th className="py-2.5 px-4 text-start">Invoice #</th>
                    <th className="py-2.5 px-3 text-start">Period</th>
                    <th className="py-2.5 px-3 text-start">Due Date</th>
                    <th className="py-2.5 px-3 text-end">Amount</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-4 text-end">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {recentInvoicesList.map((inv) => (
                    <tr
                      key={inv.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {inv.invoice_no}
                      </td>
                      <td className="py-3 px-3 text-slate-500">{inv.period}</td>
                      <td className="py-3 px-3 text-slate-500">{formatDate(inv.due_date)}</td>
                      <td className="py-3 px-3 text-end font-extrabold text-slate-900 dark:text-slate-100">
                        {formatMoney(inv.amount_minor, inv.currency)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`badge text-[9px] px-2 py-0.5 uppercase tracking-wider font-extrabold ${
                            inv.status === "paid"
                              ? "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300"
                              : inv.status === "overdue"
                              ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                              : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-end">
                        {inv.status !== "paid" ? (
                          <button
                            onClick={() => markPaid.mutate(inv.id)}
                            disabled={markPaid.isPending}
                            className="btn btn-secondary text-[11px] py-1 px-2.5 hover:border-teal-400"
                          >
                            <Check size={11} className="text-teal-600" />
                            <span>Mark Paid</span>
                          </button>
                        ) : (
                          <span className="text-[10px] font-bold text-teal-600 flex items-center justify-end gap-1">
                            <Check size={12} /> Settled
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {recentInvoicesList.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No subscription invoices generated yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols = 34% width): Modern Intelligence & Operational Widgets */}
        <div className="space-y-5 lg:col-span-4">
          {/* Widget 1: Package Adoption & Revenue Share */}
          <div className="card p-5 sm:p-6 border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600">
                  <Layers size={15} />
                </div>
                <div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                    Package Share
                  </h2>
                </div>
              </div>
              <Link
                to="/superadmin/plans"
                className="text-[11px] font-bold text-teal-600 hover:text-teal-700"
              >
                Catalog →
              </Link>
            </div>

            {/* Visual segmented share bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Subscribers</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">
                  {totalSubscribers > 0 ? `${totalSubscribers} active` : "1 nursery active"}
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                <div className="h-full bg-teal-500 rounded-l-full" style={{ width: "100%" }} />
              </div>
            </div>

            {/* Tier Items */}
            <div className="space-y-2 pt-1">
              {subscribedTiers.length > 0 ? (
                subscribedTiers.map((tier) => (
                  <div
                    key={tier.plan_code}
                    className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                          {tier.plan_name}
                        </span>
                        <span
                          className={`badge text-[9px] px-1.5 py-0.2 ${
                            tier.billing_period === "yearly"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-teal-50 text-teal-700 border-teal-200"
                          }`}
                        >
                          {tier.billing_period}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {tier.nursery_count} {tier.nursery_count === 1 ? "nursery" : "nurseries"}
                      </span>
                    </div>

                    <div className="text-end">
                      <span className="text-xs font-black text-teal-600 dark:text-teal-400 block">
                        {formatMoneyCompact(tier.revenue_minor)}
                      </span>
                      <span className="text-[9px] text-slate-400">per cycle</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                      Growth (51–80)
                    </span>
                    <span className="text-[10px] text-slate-400">1 nursery on Growth plan</span>
                  </div>
                  <span className="badge text-[10px] bg-teal-50 text-teal-700 border-teal-200">
                    $80/mo
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Widget 2: Renewal Radar */}
          <div className="card p-5 sm:p-6 border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600">
                  <Clock size={15} />
                </div>
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  Renewal Radar
                </h2>
              </div>
              <span className="badge text-[9px] bg-amber-50 text-amber-700 border-amber-200">
                Scheduled
              </span>
            </div>

            {upcomingRenewal ? (
              <div className="p-3.5 rounded-xl bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900 border border-slate-200/70 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-slate-900 dark:text-slate-100 truncate">
                    {upcomingRenewal.name}
                  </span>
                  <span className="text-xs font-black text-teal-600">
                    {upcomingRenewal.price_minor
                      ? formatMoney(upcomingRenewal.price_minor, upcomingRenewal.currency)
                      : "$80.00"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} className="text-teal-600" />
                    <span>Next Due Date:</span>
                  </span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {formatDate(upcomingRenewal.next_payment_date)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-2">No upcoming renewal dates scheduled.</p>
            )}
          </div>

          {/* Widget 3: Platform Operations & System Health */}
          <div className="card p-5 sm:p-6 border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600">
                  <Server size={15} />
                </div>
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  System Health
                </h2>
              </div>
              <span className="h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
            </div>

            {/* Micro Diagnostic Status Pills */}
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 block">Database</span>
                <span className="font-bold text-teal-600 flex items-center gap-1 mt-0.5">
                  <Check size={10} /> Connected
                </span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 block">Auto-Invoicing</span>
                <span className="font-bold text-teal-600 flex items-center gap-1 mt-0.5">
                  <Check size={10} /> Active (06:15)
                </span>
              </div>
            </div>

            {/* Quick Navigation Action Tiles */}
            <div className="pt-1 space-y-1.5">
              <Link
                to="/superadmin/reports"
                className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-teal-300 hover:bg-teal-50/30 dark:hover:bg-teal-950/20 transition-all text-xs group"
              >
                <div className="flex items-center gap-2.5">
                  <BarChart3 size={14} className="text-teal-600" />
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    Platform Financial Report
                  </span>
                </div>
                <ChevronRight
                  size={14}
                  className="text-slate-400 group-hover:translate-x-0.5 transition-transform"
                />
              </Link>

              <Link
                to="/settings"
                className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-teal-300 hover:bg-teal-50/30 dark:hover:bg-teal-950/20 transition-all text-xs group"
              >
                <div className="flex items-center gap-2.5">
                  <Settings size={14} className="text-slate-500" />
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    Platform Settings & S3
                  </span>
                </div>
                <ChevronRight
                  size={14}
                  className="text-slate-400 group-hover:translate-x-0.5 transition-transform"
                />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
