import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus } from "lucide-react";
import { useState } from "react";
import { FormField } from "../../components/FormField";
import { Modal } from "../../components/Modal";
import { PageHeader } from "../../components/PageHeader";
import { api, errorMessage } from "../../lib/api";
import type { ListResponse, Plan, SubscriptionInvoice } from "../../types/api";

function money(minor: number, currency = "SEK") {
  return `${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currency}`;
}

const BLANK = {
  code: "",
  name: "",
  max_students: 30,
  max_staff: 0,
  price_minor: 0,
  billing_period: "monthly" as const,
};

/** Plan catalogue plus the platform's own invoices. Billing is settled manually. */
export function PlansPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Plan | typeof BLANK | null>(null);
  const [banner, setBanner] = useState("");

  const plans = useQuery({
    queryKey: ["superadmin-plans"],
    queryFn: async () => (await api.get<{ data: Plan[] }>("/superadmin/plans")).data.data,
  });
  const invoices = useQuery({
    queryKey: ["subscription-invoices"],
    queryFn: async () =>
      (await api.get<ListResponse<SubscriptionInvoice>>("/superadmin/subscription-invoices?per_page=50")).data.data,
  });

  const markPaid = useMutation({
    mutationFn: async (id: number) => api.post(`/superadmin/subscription-invoices/${id}/mark-paid`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["subscription-invoices"] }),
    onError: (e) => setBanner(errorMessage(e)),
  });

  const generate = useMutation({
    mutationFn: async () => api.post("/superadmin/subscription-invoices/generate"),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["subscription-invoices"] }),
    onError: (e) => setBanner(errorMessage(e)),
  });

  return (
    <>
      <PageHeader
        title="Plans & platform billing"
        subtitle="What nurseries can buy, and what they owe."
        actions={
          <>
            <button onClick={() => generate.mutate()} className="btn btn-secondary">
              Generate this period
            </button>
            <button onClick={() => setEditing(BLANK)} className="btn btn-primary">
              <Plus size={16} /> New plan
            </button>
          </>
        }
      />

      {banner && <p className="mb-4 text-sm font-semibold text-rose-600">{banner}</p>}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {plans.data?.map((p) => (
          <button
            key={p.id}
            onClick={() => setEditing(p)}
            className="card p-6 text-start transition-colors hover:border-brand-200"
            type="button"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-extrabold text-slate-900">{p.name}</h2>
              {!p.is_active && <span className="badge bg-slate-100 text-slate-500">inactive</span>}
            </div>
            <p className="mt-1 text-2xl font-extrabold text-brand-700">
              {money(p.price_minor, p.currency)}
              <span className="text-xs font-bold text-slate-400"> / {p.billing_period}</span>
            </p>
            <p className="mt-3 text-xs font-semibold text-slate-500">
              {p.max_students} students · {p.max_staff === 0 ? "unlimited" : p.max_staff} staff
            </p>
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <h2 className="px-6 pt-6 text-sm font-extrabold uppercase tracking-wider text-slate-700">
          Subscription invoices
        </h2>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="table-header text-start">Invoice</th>
              <th className="table-header text-start">Nursery</th>
              <th className="table-header text-start">Period</th>
              <th className="table-header text-end">Amount</th>
              <th className="table-header text-start">Status</th>
              <th className="table-header text-end">Action</th>
            </tr>
          </thead>
          <tbody>
            {invoices.data?.map((inv) => (
              <tr key={inv.id} className="table-row">
                <td className="table-cell font-mono text-xs">{inv.invoice_no}</td>
                <td className="table-cell">#{inv.nursery_id}</td>
                <td className="table-cell">{inv.period}</td>
                <td className="table-cell text-end font-bold">{money(inv.amount_minor, inv.currency)}</td>
                <td className="table-cell">
                  <span
                    className={`badge ${
                      inv.status === "paid"
                        ? "bg-emerald-100 text-emerald-700"
                        : inv.status === "overdue"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {inv.status}
                  </span>
                </td>
                <td className="table-cell text-end">
                  {inv.status !== "paid" && (
                    <button
                      onClick={() => markPaid.mutate(inv.id)}
                      className="btn btn-secondary text-xs"
                      type="button"
                    >
                      <Check size={13} /> Mark paid
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {invoices.data?.length === 0 && (
          <p className="px-6 py-8 text-center text-xs font-semibold text-slate-400">
            No subscription invoices yet.
          </p>
        )}
      </div>

      {editing && (
        <PlanModal
          plan={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            void qc.invalidateQueries({ queryKey: ["superadmin-plans"] });
          }}
        />
      )}
    </>
  );
}

function PlanModal({
  plan,
  onClose,
  onDone,
}: {
  plan: Plan | typeof BLANK;
  onClose: () => void;
  onDone: () => void;
}) {
  const isEdit = "id" in plan;
  const [form, setForm] = useState({
    code: plan.code,
    name: plan.name,
    max_students: String(plan.max_students),
    max_staff: String(plan.max_staff),
    price_major: String(plan.price_minor / 100),
    billing_period: plan.billing_period,
  });
  const [err, setErr] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        code: form.code,
        name: form.name,
        max_students: Number(form.max_students),
        max_staff: Number(form.max_staff),
        // Entered in major units; stored in minor, like every other amount.
        price_minor: Math.round(parseFloat(form.price_major || "0") * 100),
        billing_period: form.billing_period,
      };
      return isEdit
        ? api.put(`/superadmin/plans/${(plan as Plan).id}`, body)
        : api.post("/superadmin/plans", body);
    },
    onSuccess: onDone,
    onError: (e) => setErr(errorMessage(e)),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <Modal open title={isEdit ? `Edit ${plan.name}` : "New plan"} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Code">
            <input className="input" value={form.code} onChange={set("code")} />
          </FormField>
          <FormField label="Name">
            <input className="input" value={form.name} onChange={set("name")} />
          </FormField>
          <FormField label="Max students">
            <input className="input" type="number" value={form.max_students} onChange={set("max_students")} />
          </FormField>
          <FormField label="Max staff (0 = unlimited)">
            <input className="input" type="number" value={form.max_staff} onChange={set("max_staff")} />
          </FormField>
          <FormField label="Price">
            <input className="input" type="number" step="0.01" value={form.price_major} onChange={set("price_major")} />
          </FormField>
          <FormField label="Billing period">
            <select className="input" value={form.billing_period} onChange={set("billing_period")}>
              <option value="monthly">monthly</option>
              <option value="yearly">yearly</option>
            </select>
          </FormField>
        </div>
        {err && <p className="text-sm font-semibold text-rose-600">{err}</p>}
        <div className="flex gap-2 border-t border-slate-100 pt-4">
          <button onClick={() => save.mutate()} className="btn btn-primary" disabled={save.isPending}>
            Save
          </button>
          <button onClick={onClose} className="btn btn-secondary" type="button">
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
