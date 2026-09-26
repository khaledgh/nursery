import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Check,
  CheckCircle2,
  CreditCard,
  Edit2,
  Filter,
  Layers,
  Plus,
  Receipt,
  RefreshCw,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { FormField } from "../../components/FormField";
import { Modal } from "../../components/Modal";
import { PageHeader } from "../../components/PageHeader";
import { api, errorMessage } from "../../lib/api";
import { useCurrency } from "../../hooks/useCurrency";
import { useAuthStore } from "../../store/auth";
import type { ListResponse, Plan, SubscriptionInvoice } from "../../types/api";

interface BlankPlan {
  code: string;
  name: string;
  max_students: number;
  max_staff: number;
  price_minor: number;
  currency: string;
  billing_period: "monthly" | "yearly";
}

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

/** Plan catalogue plus the platform's own invoices. Billing is settled manually. */
export function PlansPage() {
  const qc = useQueryClient();
  const { currency: defaultCurrency, formatMoney, formatMoneyCompact } = useCurrency();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [editing, setEditing] = useState<Plan | BlankPlan | null>(null);
  const [banner, setBanner] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [invoiceFilter, setInvoiceFilter] = useState<"all" | "paid" | "overdue" | "due">("all");

  const plans = useQuery({
    queryKey: ["superadmin-plans"],
    queryFn: async () => (await api.get<{ data: Plan[] }>("/superadmin/plans")).data.data,
    enabled: Boolean(accessToken),
  });
  const invoices = useQuery({
    queryKey: ["subscription-invoices"],
    queryFn: async () =>
      (await api.get<ListResponse<SubscriptionInvoice>>("/superadmin/subscription-invoices?per_page=50")).data.data,
    enabled: Boolean(accessToken),
  });

  const markPaid = useMutation({
    mutationFn: async (id: number) => api.post(`/superadmin/subscription-invoices/${id}/mark-paid`),
    onSuccess: () => {
      setBanner({ text: "Invoice marked as paid successfully.", type: "success" });
      void qc.invalidateQueries({ queryKey: ["subscription-invoices"] });
      void qc.invalidateQueries({ queryKey: ["platform-stats"] });
    },
    onError: (e) => setBanner({ text: errorMessage(e), type: "error" }),
  });

  const generate = useMutation({
    mutationFn: async () => api.post("/superadmin/subscription-invoices/generate"),
    onSuccess: () => {
      setBanner({ text: "Generated invoices for current active billing period.", type: "success" });
      void qc.invalidateQueries({ queryKey: ["subscription-invoices"] });
    },
    onError: (e) => setBanner({ text: errorMessage(e), type: "error" }),
  });

  const autoRun = useMutation({
    mutationFn: async () =>
      (await api.post<{ data: { generated_invoices: number; overdue_marked: number } }>(
        "/superadmin/subscription-invoices/auto-run"
      )).data.data,
    onSuccess: (data) => {
      setBanner({
        text: `Auto-run billing finished: ${data.generated_invoices} invoices raised, ${data.overdue_marked} overdue accounts flagged.`,
        type: "success",
      });
      void qc.invalidateQueries({ queryKey: ["subscription-invoices"] });
      void qc.invalidateQueries({ queryKey: ["platform-stats"] });
    },
    onError: (e) => setBanner({ text: errorMessage(e), type: "error" }),
  });

  const makeBlank = (): BlankPlan => ({
    code: "",
    name: "",
    max_students: 50,
    max_staff: 10,
    price_minor: 6000,
    currency: defaultCurrency || "USD",
    billing_period: "monthly",
  });

  const [planPeriodFilter, setPlanPeriodFilter] = useState<"all" | "monthly" | "yearly">("all");

  const planList = plans.data ?? [];
  const invoiceList = invoices.data ?? [];

  const monthlyCount = useMemo(() => planList.filter((p) => p.billing_period !== "yearly").length, [planList]);
  const annualCount = useMemo(() => planList.filter((p) => p.billing_period === "yearly").length, [planList]);
  const filteredPlans = useMemo(() => {
    if (planPeriodFilter === "all") return planList;
    return planList.filter((p) => p.billing_period === planPeriodFilter);
  }, [planList, planPeriodFilter]);

  const filteredInvoices = useMemo(() => {
    if (invoiceFilter === "all") return invoiceList;
    return invoiceList.filter((inv) => inv.status === invoiceFilter);
  }, [invoiceList, invoiceFilter]);

  const paidCount = invoiceList.filter((i) => i.status === "paid").length;
  const overdueCount = invoiceList.filter((i) => i.status === "overdue").length;
  const overdueSum = invoiceList
    .filter((i) => i.status === "overdue")
    .reduce((acc, i) => acc + i.amount_minor, 0);

  return (
    <div className="space-y-4 sm:space-y-5 pb-10">
      <PageHeader
        title="Subscription Plans & Invoicing"
        subtitle="Configure monthly & annual capacity packages, and monitor childcare subscription payments."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => autoRun.mutate()}
              disabled={autoRun.isPending}
              className="btn btn-secondary text-xs sm:text-sm py-1.5 px-3 shadow-none border-slate-200/80 hover:border-teal-300"
              title="Automatically checks renewals, raises new period invoices, and flags past-due accounts"
            >
              <RefreshCw
                size={13}
                className={autoRun.isPending ? "animate-spin text-teal-600" : "text-teal-600"}
              />
              <span>{autoRun.isPending ? "Running Billing…" : "Auto-run Billing"}</span>
            </button>
            <button
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
              className="btn btn-secondary text-xs sm:text-sm py-1.5 px-3 shadow-none border-slate-200/80 hover:border-teal-300"
            >
              Generate This Period
            </button>
            <button
              onClick={() => setEditing(makeBlank())}
              className="btn btn-primary text-xs sm:text-sm py-1.5 px-3.5"
            >
              <Plus size={14} /> New Plan
            </button>
          </div>
        }
      />

      {/* Banner */}
      {banner && (
        <div
          className={`flex items-center justify-between p-3 rounded-xl border text-xs sm:text-sm font-semibold shadow-sm transition-all ${
            banner.type === "success"
              ? "bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className={banner.type === "success" ? "text-teal-600" : "text-rose-600"} />
            <span>{banner.text}</span>
          </div>
          <button onClick={() => setBanner(null)} className="text-[10px] uppercase font-extrabold px-2 py-0.5">
            Dismiss
          </button>
        </div>
      )}

      {/* Compact Executive Summary Metrics */}
      <div className="grid gap-2.5 sm:gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="card p-3 sm:p-3.5 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Configured Plans
            </span>
            <div className="p-1 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-600">
              <Layers size={14} />
            </div>
          </div>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {planList.length}
          </p>
          <div className="mt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-1.5 text-[10.5px]">
            <span className="text-slate-400">Monthly / Annual</span>
            <span className="font-extrabold text-teal-600">
              {annualCount} Annual · {monthlyCount} Monthly
            </span>
          </div>
        </div>

        <div className="card p-3 sm:p-3.5 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Invoices
            </span>
            <div className="p-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <Receipt size={14} />
            </div>
          </div>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {invoiceList.length}
          </p>
          <div className="mt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-1.5 text-[10.5px]">
            <span className="text-slate-400">Settled invoices</span>
            <span className="font-extrabold text-teal-600">{paidCount} paid</span>
          </div>
        </div>

        <div className="card p-3 sm:p-3.5 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Overdue Accounts
            </span>
            <div className="p-1 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-600">
              <CreditCard size={14} />
            </div>
          </div>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {overdueCount}
          </p>
          <div className="mt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-1.5 text-[10.5px]">
            <span className="text-slate-400">Outstanding sum</span>
            <span
              className={`font-extrabold ${
                overdueSum > 0 ? "text-rose-600" : "text-teal-600"
              }`}
            >
              {formatMoney(overdueSum)}
            </span>
          </div>
        </div>

        <div className="card p-3 sm:p-3.5 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Billing Cadence
            </span>
            <div className="p-1 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-600">
              <Calendar size={14} />
            </div>
          </div>
          <p className="mt-1 text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Automated
          </p>
          <div className="mt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-1.5 text-[10.5px]">
            <span className="text-slate-400">Cron Schedule</span>
            <span className="font-extrabold text-teal-600">Daily 06:15 UTC</span>
          </div>
        </div>
      </div>

      {/* Plan Catalog Grid */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-600">
              <Layers size={14} />
            </div>
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
              Active Capacity Packages
            </h2>
          </div>

          {/* Period Filter Tabs */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-xs self-start sm:self-auto border border-slate-200/60 dark:border-slate-700">
            <button
              onClick={() => setPlanPeriodFilter("all")}
              className={`px-2.5 py-0.5 rounded-md font-semibold text-[11px] transition-all ${
                planPeriodFilter === "all"
                  ? "bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              All ({planList.length})
            </button>
            <button
              onClick={() => setPlanPeriodFilter("monthly")}
              className={`px-2.5 py-0.5 rounded-md font-semibold text-[11px] transition-all ${
                planPeriodFilter === "monthly"
                  ? "bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              Monthly ({monthlyCount})
            </button>
            <button
              onClick={() => setPlanPeriodFilter("yearly")}
              className={`px-2.5 py-0.5 rounded-md font-semibold text-[11px] transition-all ${
                planPeriodFilter === "yearly"
                  ? "bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              Annual ({annualCount})
            </button>
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPlans.map((p) => {
            const isYearly = p.billing_period === "yearly";
            return (
              <div
                key={p.id}
                className="card p-3 sm:p-3.5 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 hover:border-teal-300 dark:hover:border-teal-700 transition-all flex flex-col justify-between gap-2 shadow-sm rounded-xl"
              >
                {/* Header row: Name, Code & Edit */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {p.name}
                      </h3>
                      <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium border border-slate-200/60 dark:border-slate-700/60">
                        {p.code}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={`badge text-[9px] px-1.5 py-0.5 font-bold ${
                        isYearly
                          ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                          : "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300"
                      }`}
                    >
                      {isYearly ? "Annual" : "Monthly"}
                    </span>
                    <button
                      onClick={() => setEditing(p)}
                      className="p-1 rounded-md text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/50 transition-colors"
                      title="Edit package tier"
                      aria-label="Edit Tier"
                    >
                      <Edit2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Bottom row: Price & Student/Staff Pills */}
                <div className="flex items-baseline justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg sm:text-xl font-bold text-teal-600 dark:text-teal-400">
                      {formatMoneyCompact(p.price_minor, p.currency)}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">
                      /{isYearly ? "yr" : "mo"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 font-medium">
                      <Users size={11} className="text-teal-600 shrink-0" />
                      <span>{p.max_students} kids</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 font-medium">
                      <Check size={11} className="text-teal-600 shrink-0" />
                      <span>{p.max_staff === 0 ? "∞ staff" : `${p.max_staff} staff`}</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Subscription Invoices Table */}
      <div className="card overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm bg-white dark:bg-slate-900 space-y-0">
        <div className="p-3 sm:p-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <Receipt size={15} className="text-teal-600" />
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
              Platform Subscription Invoices
            </h2>
          </div>

          <div className="flex items-center gap-1">
            <Filter size={12} className="text-slate-400 mr-1" />
            {(["all", "paid", "due", "overdue"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setInvoiceFilter(st)}
                className={`text-[11px] font-bold px-2 py-0.5 rounded-lg transition-all capitalize ${
                  invoiceFilter === st
                    ? "bg-teal-500 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[10px] font-black uppercase tracking-wider text-slate-400 text-start">
                <th className="py-2 px-3 text-start">Invoice #</th>
                <th className="py-2 px-3 text-start">Nursery ID</th>
                <th className="py-2 px-3 text-start">Period</th>
                <th className="py-2 px-3 text-start">Due Date</th>
                <th className="py-2 px-3 text-end">Amount</th>
                <th className="py-2 px-3 text-center">Status</th>
                <th className="py-2 px-3 text-end">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredInvoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <td className="py-2 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                    {inv.invoice_no}
                  </td>
                  <td className="py-2 px-3 text-slate-600 dark:text-slate-300 font-semibold">
                    Center #{inv.nursery_id}
                  </td>
                  <td className="py-2 px-3 text-slate-500 font-mono">{inv.period}</td>
                  <td className="py-2 px-3 text-slate-500">{formatDate(inv.due_date)}</td>
                  <td className="py-2 px-3 text-end font-extrabold text-slate-900 dark:text-slate-100">
                    {formatMoney(inv.amount_minor, inv.currency)}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span
                      className={`badge text-[9px] px-1.5 py-0.5 uppercase tracking-wider font-extrabold ${
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
                  <td className="py-2 px-3 text-end">
                    {inv.status !== "paid" ? (
                      <button
                        onClick={() => markPaid.mutate(inv.id)}
                        disabled={markPaid.isPending}
                        className="btn btn-secondary text-[11px] py-0.5 px-2 hover:border-teal-400"
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
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    No subscription invoices match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PlanModal
        plan={editing}
        onClose={() => setEditing(null)}
        onDone={() => {
          setEditing(null);
          void qc.invalidateQueries({ queryKey: ["superadmin-plans"] });
        }}
      />
    </div>
  );
}

function PlanModal({
  plan,
  onClose,
  onDone,
}: {
  plan: Plan | BlankPlan | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState<BlankPlan>({
    code: "",
    name: "",
    max_students: 50,
    max_staff: 10,
    price_minor: 6000,
    currency: "USD",
    billing_period: "monthly",
  });
  const [err, setErr] = useState("");

  const isNew = plan && !("id" in plan);

  // Sync state on plan change
  useMemo(() => {
    if (plan) {
      setForm({
        code: plan.code,
        name: plan.name,
        max_students: plan.max_students,
        max_staff: plan.max_staff,
        price_minor: plan.price_minor,
        currency: plan.currency || "USD",
        billing_period: plan.billing_period || "monthly",
      });
    }
  }, [plan]);

  const save = useMutation({
    mutationFn: async () => {
      if (isNew) {
        await api.post("/superadmin/plans", form);
      } else if (plan && "id" in plan) {
        await api.put(`/superadmin/plans/${plan.id}`, form);
      }
    },
    onSuccess: () => {
      setErr("");
      onDone();
    },
    onError: (e) => setErr(errorMessage(e)),
  });

  if (!plan) return null;

  return (
    <Modal open={Boolean(plan)} onClose={onClose} title={isNew ? "Create Capacity Plan" : `Edit Plan: ${plan.name}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="space-y-4 text-xs"
      >
        {err && (
          <div className="p-3 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
            {err}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Plan Code Identifier">
            <input
              type="text"
              required
              disabled={!isNew}
              placeholder="e.g. tier-50"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="input font-mono text-xs disabled:opacity-60"
            />
          </FormField>

          <FormField label="Public Plan Name">
            <input
              type="text"
              required
              placeholder="e.g. Starter (20–50)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input text-xs"
            />
          </FormField>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Billing Term Cadence">
            <select
              value={form.billing_period}
              onChange={(e) =>
                setForm({ ...form, billing_period: e.target.value as "monthly" | "yearly" })
              }
              className="input text-xs"
            >
              <option value="monthly">Monthly Cycle (/mo)</option>
              <option value="yearly">Annual Cycle (/yr)</option>
            </select>
          </FormField>

          <FormField label="Price in Major Currency Units">
            <input
              type="number"
              step="0.01"
              required
              value={form.price_minor / 100}
              onChange={(e) =>
                setForm({ ...form, price_minor: Math.round(parseFloat(e.target.value || "0") * 100) })
              }
              className="input text-xs"
            />
          </FormField>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Student Capacity Allowance">
            <input
              type="number"
              required
              min={1}
              value={form.max_students}
              onChange={(e) => setForm({ ...form, max_students: parseInt(e.target.value, 10) || 0 })}
              className="input text-xs"
            />
          </FormField>

          <FormField label="Staff Capacity Allowance (0 for unlimited)">
            <input
              type="number"
              required
              min={0}
              value={form.max_staff}
              onChange={(e) => setForm({ ...form, max_staff: parseInt(e.target.value, 10) || 0 })}
              className="input text-xs"
            />
          </FormField>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary text-xs">
            Cancel
          </button>
          <button
            type="submit"
            disabled={save.isPending}
            className="btn btn-primary text-xs flex items-center gap-1.5"
          >
            {save.isPending && <RefreshCw size={13} className="animate-spin" />}
            <span>Save Package</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
