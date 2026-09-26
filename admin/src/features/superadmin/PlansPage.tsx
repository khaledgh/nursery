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

  const planList = plans.data ?? [];
  const invoiceList = invoices.data ?? [];

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
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Subscription Plans & Invoicing"
        subtitle="Configure monthly & annual capacity packages, and monitor childcare subscription payments."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => autoRun.mutate()}
              disabled={autoRun.isPending}
              className="btn btn-secondary text-xs sm:text-sm py-2 px-3 shadow-none border-slate-200/80 hover:border-teal-300"
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
              className="btn btn-secondary text-xs sm:text-sm py-2 px-3 shadow-none border-slate-200/80 hover:border-teal-300"
            >
              Generate This Period
            </button>
            <button
              onClick={() => setEditing(makeBlank())}
              className="btn btn-primary text-xs sm:text-sm py-2 px-3.5"
            >
              <Plus size={14} /> New Plan
            </button>
          </div>
        }
      />

      {/* Banner */}
      {banner && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-2xl border text-sm font-semibold shadow-sm transition-all ${
            banner.type === "success"
              ? "bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className={banner.type === "success" ? "text-teal-600" : "text-rose-600"} />
            <span>{banner.text}</span>
          </div>
          <button onClick={() => setBanner(null)} className="text-xs uppercase font-extrabold px-2 py-1">
            Dismiss
          </button>
        </div>
      )}

      {/* Compact Executive Summary Metrics */}
      <div className="grid gap-3.5 grid-cols-2 lg:grid-cols-4">
        <div className="card p-4 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Configured Plans
            </span>
            <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600">
              <Layers size={15} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            {planList.length}
          </p>
          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-2 text-[11px]">
            <span className="text-slate-400">Monthly / Annual</span>
            <span className="font-extrabold text-teal-600">
              {planList.filter((p) => p.billing_period === "yearly").length} Annual ·{" "}
              {planList.filter((p) => p.billing_period !== "yearly").length} Monthly
            </span>
          </div>
        </div>

        <div className="card p-4 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Invoices
            </span>
            <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <Receipt size={15} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            {invoiceList.length}
          </p>
          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-2 text-[11px]">
            <span className="text-slate-400">Settled invoices</span>
            <span className="font-extrabold text-teal-600">{paidCount} paid</span>
          </div>
        </div>

        <div className="card p-4 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Overdue Accounts
            </span>
            <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600">
              <CreditCard size={15} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            {overdueCount}
          </p>
          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-2 text-[11px]">
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

        <div className="card p-4 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Billing Cadence
            </span>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600">
              <Calendar size={15} />
            </div>
          </div>
          <p className="mt-2 text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Automated
          </p>
          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-2 text-[11px]">
            <span className="text-slate-400">Cron Schedule</span>
            <span className="font-extrabold text-teal-600">Daily 06:15 UTC</span>
          </div>
        </div>
      </div>

      {/* Plan Catalog Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Layers size={16} className="text-teal-600" />
            Active Capacity Packages
          </h2>
          <span className="text-xs text-slate-400">{planList.length} total options</span>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {planList.map((p) => {
            const isYearly = p.billing_period === "yearly";
            return (
              <div
                key={p.id}
                className="card p-4 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 hover:border-teal-300/80 transition-all flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                        {p.name}
                      </h3>
                      <span className="font-mono text-[10px] text-slate-400">{p.code}</span>
                    </div>
                    <span
                      className={`badge text-[10px] px-2 py-0.5 font-bold ${
                        isYearly
                          ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                          : "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300"
                      }`}
                    >
                      {isYearly ? "Annual Plan" : "Monthly Plan"}
                    </span>
                  </div>

                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-2xl font-black text-teal-600 dark:text-teal-400">
                      {formatMoneyCompact(p.price_minor, p.currency)}
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      /{isYearly ? "year" : "month"}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1.5 border-t border-slate-100 dark:border-slate-800/60 pt-2.5 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <Users size={13} className="text-teal-600 shrink-0" />
                      <span>
                        Capacity: <strong>{p.max_students}</strong> students
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check size={13} className="text-teal-600 shrink-0" />
                      <span>
                        Staff:{" "}
                        <strong>{p.max_staff === 0 ? "Unlimited" : `${p.max_staff} members`}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-end">
                  <button
                    onClick={() => setEditing(p)}
                    className="btn btn-secondary text-[11px] py-1 px-3 hover:border-teal-400 hover:text-teal-600 flex items-center gap-1.5"
                  >
                    <Edit2 size={11} />
                    <span>Edit Tier</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Subscription Invoices Table */}
      <div className="card overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm bg-white dark:bg-slate-900 space-y-0">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Receipt size={16} className="text-teal-600" />
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">
              Platform Subscription Invoices
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <Filter size={13} className="text-slate-400 mr-1" />
            {(["all", "paid", "due", "overdue"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setInvoiceFilter(st)}
                className={`text-xs font-bold px-2.5 py-1 rounded-xl transition-all capitalize ${
                  invoiceFilter === st
                    ? "bg-teal-500 text-white shadow-xs"
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
                <th className="py-2.5 px-4 text-start">Invoice #</th>
                <th className="py-2.5 px-3 text-start">Nursery ID</th>
                <th className="py-2.5 px-3 text-start">Period</th>
                <th className="py-2.5 px-3 text-start">Due Date</th>
                <th className="py-2.5 px-3 text-end">Amount</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-4 text-end">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredInvoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                    {inv.invoice_no}
                  </td>
                  <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-semibold">
                    Center #{inv.nursery_id}
                  </td>
                  <td className="py-3 px-3 text-slate-500 font-mono">{inv.period}</td>
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
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
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
