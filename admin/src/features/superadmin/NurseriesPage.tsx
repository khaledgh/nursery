import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Building2,
  Calendar,
  CreditCard,
  Eye,
  LogIn,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sliders,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FormField } from "../../components/FormField";
import { Modal } from "../../components/Modal";
import { PageHeader } from "../../components/PageHeader";
import { api, errorMessage } from "../../lib/api";
import { SUBSCRIPTION_STATUS_TINT, tint } from "../../lib/tints";
import { useAuthStore } from "../../store/auth";
import { useCurrency } from "../../hooks/useCurrency";
import type { NurseryOverview, ListResponse, PlatformStats, Plan } from "../../types/api";

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

/** The platform console: every nursery, its plan, next payment date, and its seat usage. */
export function NurseriesPage() {
  const qc = useQueryClient();
  const { formatMoney, formatMoneyCompact } = useCurrency();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<NurseryOverview | null>(null);
  const [banner, setBanner] = useState("");
  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] = useState<"all" | "monthly" | "yearly">("all");

  const stats = useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => (await api.get<{ data: PlatformStats }>("/superadmin/stats")).data.data,
    enabled: Boolean(accessToken),
  });
  const nurseries = useQuery({
    queryKey: ["superadmin-nurseries"],
    queryFn: async () =>
      (await api.get<ListResponse<NurseryOverview>>("/superadmin/nurseries?per_page=100")).data.data,
    enabled: Boolean(accessToken),
  });
  const plans = useQuery({
    queryKey: ["superadmin-plans"],
    queryFn: async () => (await api.get<{ data: Plan[] }>("/superadmin/plans")).data.data,
    enabled: Boolean(accessToken),
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["superadmin-nurseries"] });
    void qc.invalidateQueries({ queryKey: ["platform-stats"] });
  };

  const setStatus = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "suspend" | "activate" }) =>
      api.post(`/superadmin/nurseries/${id}/${action}`),
    onSuccess: refresh,
    onError: (e) => setBanner(errorMessage(e)),
  });

  const stat = stats.data;
  const list = nurseries.data ?? [];
  const isLoading = nurseries.isLoading;

  const filtered = useMemo(() => {
    return list.filter((n) => {
      const matchSearch =
        !search ||
        n.name.toLowerCase().includes(search.toLowerCase()) ||
        n.slug.toLowerCase().includes(search.toLowerCase()) ||
        (n.login_id_prefix && n.login_id_prefix.toLowerCase().includes(search.toLowerCase())) ||
        (n.admin_email && n.admin_email.toLowerCase().includes(search.toLowerCase()));

      const matchPeriod =
        periodFilter === "all" ||
        (periodFilter === "yearly" ? n.billing_period === "yearly" : n.billing_period !== "yearly");

      return matchSearch && matchPeriod;
    });
  }, [list, search, periodFilter]);

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Nurseries & Tenants"
        subtitle="Manage all childcare centers on Nursee+, configure packages, monitor capacity, and freeze or activate accounts."
        actions={
          <button
            onClick={() => setCreating(true)}
            className="btn btn-primary flex items-center gap-2 text-xs sm:text-sm py-2 px-3.5"
          >
            <Plus size={16} /> New Nursery
          </button>
        }
      />

      {banner && (
        <div className="flex items-center justify-between p-3.5 rounded-2xl border text-sm font-semibold shadow-sm bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200">
          <span>{banner}</span>
          <button onClick={() => setBanner("")} className="text-xs uppercase font-extrabold px-2 py-1">
            Dismiss
          </button>
        </div>
      )}

      {/* Modern Compact Executive Metrics */}
      <div className="grid gap-3.5 grid-cols-2 lg:grid-cols-4">
        {/* Metric 1 */}
        <div className="card p-4 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Nurseries
            </span>
            <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600">
              <Building2 size={15} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {stat?.nurseries ?? 0}
            </span>
            <span className="text-xs font-semibold text-slate-400">centers</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-2 text-[11px]">
            <span className="text-slate-400">Active centers</span>
            <span className="font-extrabold text-teal-600 dark:text-teal-400">
              {stat?.active_nurseries ?? 0} active
            </span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="card p-4 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Children Enrolled
            </span>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600">
              <Users size={15} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {stat?.children ?? 0}
            </span>
            <span className="text-xs font-semibold text-slate-400">students</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-2 text-[11px]">
            <span className="text-slate-400">Total staff</span>
            <span className="font-extrabold text-slate-700 dark:text-slate-300">
              {stat?.users ?? 0} users
            </span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="card p-4 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Platform MRR
            </span>
            <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600">
              <CreditCard size={15} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {formatMoneyCompact(stat?.mrr_minor ?? 0)}
            </span>
            <span className="text-xs font-semibold text-slate-400">/mo</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-2 text-[11px]">
            <span className="text-slate-400">ARR Projection</span>
            <span className="font-extrabold text-teal-600 dark:text-teal-400">
              {formatMoneyCompact((stat?.mrr_minor ?? 0) * 12)}/yr
            </span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="card p-4 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Account Health
            </span>
            <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <ShieldCheck size={15} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {stat?.nurseries_past_due ?? 0}
            </span>
            <span className="text-xs font-semibold text-slate-400">past due</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-2 text-[11px]">
            <span className="text-slate-400">Status</span>
            <span
              className={`font-bold ${
                (stat?.nurseries_past_due ?? 0) > 0 ? "text-rose-600" : "text-teal-600"
              }`}
            >
              {(stat?.nurseries_past_due ?? 0) > 0 ? "Attention required" : "100% operational"}
            </span>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 card p-3 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-xs">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search nursery, slug, prefix…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-teal-400"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <span className="text-xs text-slate-400 font-bold mr-1">Period:</span>
          {(["all", "monthly", "yearly"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodFilter(p)}
              className={`text-xs font-bold px-3 py-1 rounded-xl transition-all capitalize ${
                periodFilter === p
                  ? "bg-teal-500 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Main Nurseries Directory Table */}
      <div className="card overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm bg-white dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[10px] font-black uppercase tracking-wider text-slate-400 text-start">
                <th className="py-3 px-4 text-start">Nursery & Tenant</th>
                <th className="py-3 px-3 text-start">Primary Admin</th>
                <th className="py-3 px-3 text-start">Package & Fee</th>
                <th className="py-3 px-3 text-start">Student Capacity</th>
                <th className="py-3 px-3 text-start">Next Due Date</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-end">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={14} className="animate-spin text-teal-600" />
                      <span>Loading childcare centers…</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length > 0 ? (
                filtered.map((n) => {
                  const isSuspended =
                    n.status === "suspended" || n.subscription_status === "suspended";
                  const pct =
                    n.students_max > 0
                      ? Math.min(100, Math.round((n.students_used / n.students_max) * 100))
                      : 0;
                  const barColor = isSuspended
                    ? "bg-slate-400"
                    : pct >= 95
                    ? "bg-rose-500"
                    : pct >= 80
                    ? "bg-amber-500"
                    : "bg-teal-500";

                  return (
                    <tr
                      key={n.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <Link
                          to={`/superadmin/nurseries/${n.id}`}
                          className="font-black text-slate-900 dark:text-slate-100 text-sm hover:text-teal-600 dark:hover:text-teal-400 transition-colors inline-flex items-center gap-1 group"
                        >
                          <span>{n.name}</span>
                          <ArrowUpRight size={12} className="text-slate-400 group-hover:text-teal-600 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </Link>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-xs text-slate-400">/{n.slug}</span>
                          {n.login_id_prefix && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              Prefix: {n.login_id_prefix.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <p className="font-bold text-slate-800 dark:text-slate-200">
                          {n.admin_name || "Admin"}
                        </p>
                        <p className="text-[11px] text-slate-400">{n.admin_email || "—"}</p>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => setEditing(n)}
                            className="font-black text-teal-600 dark:text-teal-400 hover:underline block text-left text-xs"
                            type="button"
                          >
                            {n.plan_name || n.plan_code || "Standard"}
                          </button>
                          <span
                            className={`badge text-[9px] px-1.5 py-0.2 ${
                              n.billing_period === "yearly"
                                ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                                : "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300"
                            }`}
                          >
                            {n.billing_period === "yearly" ? "Annual" : "Monthly"}
                          </span>
                        </div>
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                          {n.price_minor
                            ? `${formatMoney(n.price_minor, n.currency || "USD")}/${
                                n.billing_period === "yearly" ? "yr" : "mo"
                              }`
                            : "Custom"}
                        </p>
                      </td>

                      <td className="py-3 px-3 min-w-[120px]">
                        <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                          <span className="text-slate-700 dark:text-slate-300">
                            {n.students_used}
                          </span>
                          <span className="text-slate-400">/ {n.students_max || "∞"} kids</span>
                        </div>
                        {n.students_max > 0 && (
                          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        {n.next_payment_date ? (
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            <Calendar size={12} className="text-teal-600 shrink-0" />
                            <span>{formatDate(n.next_payment_date)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span
                          className={`badge text-[9px] px-2 py-0.5 uppercase tracking-wider font-extrabold ${tint(
                            SUBSCRIPTION_STATUS_TINT,
                            n.subscription_status
                          )}`}
                        >
                          {(n.subscription_status ?? "—").replace("_", " ")}
                        </span>
                        {isSuspended && (
                          <p className="text-[9px] font-bold text-rose-600 mt-0.5 uppercase tracking-tight">
                            Frozen
                          </p>
                        )}
                      </td>

                      <td className="py-3 px-4 text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to={`/superadmin/nurseries/${n.id}`}
                            className="rounded-lg border border-teal-200 dark:border-teal-800/80 bg-teal-50/50 dark:bg-teal-950/30 px-2 py-1 text-[11px] font-bold text-teal-700 dark:text-teal-300 hover:bg-teal-100 hover:border-teal-400 transition-colors flex items-center gap-1"
                            title="Inspect nursery hub (parents, classes, students, staff, average ages)"
                          >
                            <Eye size={11} />
                            <span>Details</span>
                          </Link>
                          <button
                            onClick={() => setEditing(n)}
                            className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:border-teal-400 hover:text-teal-600 transition-colors flex items-center gap-1"
                            type="button"
                          >
                            <Sliders size={11} />
                            <span>Plan</span>
                          </button>
                          <ImpersonateButton nurseryId={n.id} />
                          <button
                            onClick={() =>
                              setStatus.mutate({
                                id: n.id,
                                action: isSuspended ? "activate" : "suspend",
                              })
                            }
                            className={`rounded-lg border p-1.5 transition-colors ${
                              isSuspended
                                ? "border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/40"
                                : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40"
                            }`}
                            title={
                              isSuspended
                                ? "Reactivate nursery"
                                : "Suspend nursery (stop registrations)"
                            }
                            type="button"
                          >
                            {isSuspended ? <Play size={12} /> : <Pause size={12} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No childcare centers match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateNurseryModal
        open={creating}
        plans={plans.data ?? []}
        onClose={() => setCreating(false)}
        onDone={() => {
          setCreating(false);
          refresh();
        }}
      />
      <AssignPlanModal
        nursery={editing}
        plans={plans.data ?? []}
        onClose={() => setEditing(null)}
        onDone={() => {
          setEditing(null);
          refresh();
        }}
      />
    </div>
  );
}

/** Enters a nursery as its admin. */
function ImpersonateButton({ nurseryId }: { nurseryId: number }) {
  const { user, setTokens } = useAuthStore();
  const go = useMutation({
    mutationFn: async () =>
      (
        await api.post<{ data: { access_token: string; access_expires_at: string } }>(
          `/superadmin/nurseries/${nurseryId}/impersonate`
        )
      ).data.data,
    onSuccess: (tokens) => {
      if (!user) return;
      setTokens(
        {
          access_token: tokens.access_token,
          access_expires_at: tokens.access_expires_at,
          refresh_token: "",
          refresh_expires_at: tokens.access_expires_at,
        },
        user
      );
      window.location.href = "/";
    },
  });
  return (
    <button
      onClick={() => go.mutate()}
      className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-500 hover:border-teal-400 hover:text-teal-600 transition-colors"
      title="Enter this nursery (impersonate admin)"
      type="button"
    >
      <LogIn size={12} />
    </button>
  );
}

function CreateNurseryModal({
  open,
  plans,
  onClose,
  onDone,
}: {
  open: boolean;
  plans: Plan[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    slug: "",
    login_id_prefix: "",
    plan_code: "tier-50",
    admin_name: "",
    admin_email: "",
    admin_password: "",
  });
  const [err, setErr] = useState("");

  const create = useMutation({
    mutationFn: async () => api.post("/superadmin/nurseries", form),
    onSuccess: () => {
      setErr("");
      onDone();
    },
    onError: (e) => setErr(errorMessage(e)),
  });

  return (
    <Modal open={open} onClose={onClose} title="Register New Nursery Tenant">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="space-y-4"
      >
        {err && (
          <div className="p-3 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
            {err}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Nursery Name">
            <input
              type="text"
              required
              placeholder="e.g. Sunny Stars Daycare"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input text-xs"
            />
          </FormField>
          <FormField label="Custom Subdomain / Slug">
            <input
              type="text"
              required
              placeholder="e.g. sunnystars"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className="input font-mono text-xs"
            />
          </FormField>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Login ID Prefix (Optional)">
            <input
              type="text"
              placeholder="e.g. SUNNY (Default auto-generated)"
              value={form.login_id_prefix}
              onChange={(e) => setForm({ ...form, login_id_prefix: e.target.value.toUpperCase() })}
              className="input font-mono text-xs uppercase"
            />
          </FormField>

          <FormField label="Initial Subscription Plan">
            <select
              value={form.plan_code}
              onChange={(e) => setForm({ ...form, plan_code: e.target.value })}
              className="input text-xs"
            >
              {plans.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name} — {p.max_students} kids (${p.price_minor / 100}/
                  {p.billing_period === "yearly" ? "yr" : "mo"})
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Nursery Primary Administrator
          </p>
          <div className="space-y-3">
            <FormField label="Full Name">
              <input
                type="text"
                required
                placeholder="e.g. Jane Doe"
                value={form.admin_name}
                onChange={(e) => setForm({ ...form, admin_name: e.target.value })}
                className="input text-xs"
              />
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Admin Email">
                <input
                  type="email"
                  required
                  placeholder="admin@example.com"
                  value={form.admin_email}
                  onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
                  className="input text-xs"
                />
              </FormField>
              <FormField label="Password">
                <input
                  type="password"
                  required
                  placeholder="Minimum 8 characters"
                  value={form.admin_password}
                  onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
                  className="input text-xs"
                />
              </FormField>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary text-xs">
            Cancel
          </button>
          <button
            type="submit"
            disabled={create.isPending}
            className="btn btn-primary text-xs flex items-center gap-1.5"
          >
            {create.isPending && <RefreshCw size={13} className="animate-spin" />}
            <span>Create Nursery</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AssignPlanModal({
  nursery,
  plans,
  onClose,
  onDone,
}: {
  nursery: NurseryOverview | null;
  plans: Plan[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [planCode, setPlanCode] = useState(nursery?.plan_code ?? "tier-50");
  const [maxStudents, setMaxStudents] = useState<number>(nursery?.students_max ?? 50);
  const [err, setErr] = useState("");

  const update = useMutation({
    mutationFn: async () => {
      if (!nursery) return;
      await api.put(`/superadmin/nurseries/${nursery.id}/subscription`, {
        plan_code: planCode,
        students_max: maxStudents,
      });
    },
    onSuccess: () => {
      setErr("");
      onDone();
    },
    onError: (e) => setErr(errorMessage(e)),
  });

  if (!nursery) return null;

  return (
    <Modal open={Boolean(nursery)} onClose={onClose} title={`Subscription & Capacity: ${nursery.name}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate();
        }}
        className="space-y-4 text-xs"
      >
        {err && (
          <div className="p-3 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
            {err}
          </div>
        )}

        <FormField label="Select Capacity Package">
          <select
            value={planCode}
            onChange={(e) => {
              setPlanCode(e.target.value);
              const p = plans.find((x) => x.code === e.target.value);
              if (p) setMaxStudents(p.max_students);
            }}
            className="input text-xs"
          >
            {plans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} — {p.max_students} kids (${p.price_minor / 100}/
                {p.billing_period === "yearly" ? "yr" : "mo"})
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Enrolled Student Cap Override">
          <input
            type="number"
            min={1}
            value={maxStudents}
            onChange={(e) => setMaxStudents(parseInt(e.target.value, 10) || 0)}
            className="input text-xs"
          />
        </FormField>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary text-xs">
            Cancel
          </button>
          <button
            type="submit"
            disabled={update.isPending}
            className="btn btn-primary text-xs flex items-center gap-1.5"
          >
            {update.isPending && <RefreshCw size={13} className="animate-spin" />}
            <span>Save Subscription</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
