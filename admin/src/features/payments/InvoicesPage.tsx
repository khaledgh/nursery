import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DataTable, type Column } from "../../components/DataTable";
import { Modal } from "../../components/Modal";
import { usePagedList } from "../../hooks/usePagedList";
import { api, errorMessage } from "../../lib/api";
import type { Child, Invoice, ListResponse } from "../../types/api";
import { INVOICE_STATUS_TINT } from "../../lib/tints";


interface DraftItem {
  label: string;
  amount: string; // major units in the form; converted to minor on submit
}

export function InvoicesPage() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState("");
  const list = usePagedList<Invoice>("invoices", "/invoices", { status: statusFilter || undefined });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const [childId, setChildId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [period, setPeriod] = useState("");
  const [currency, setCurrency] = useState("SEK");
  const [items, setItems] = useState<DraftItem[]>([{ label: "Tuition", amount: "" }]);

  const children = useQuery({
    queryKey: ["children-invoices"],
    queryFn: async () => {
      const res = await api.get<ListResponse<Child>>("/children", { params: { per_page: 100 } });
      return res.data.data;
    },
  });

  const create = useMutation({
    mutationFn: async () =>
      api.post("/admin/invoices", {
        child_id: Number(childId),
        currency,
        due_date: dueDate,
        period: period || undefined,
        items: items
          .filter((i) => i.label && i.amount)
          .map((i) => ({ label: i.label, amount_minor: Math.round(parseFloat(i.amount) * 100) })),
      }),
    onSuccess: () => {
      setCreating(false);
      setItems([{ label: "Tuition", amount: "" }]);
      setChildId("");
      setDueDate("");
      setPeriod("");
      void list.refetch();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const cancel = useMutation({
    mutationFn: async (id: number) => api.post(`/admin/invoices/${id}/cancel`),
    onSuccess: () => void list.refetch(),
  });

  const money = (minor: number, cur: string) => `${(minor / 100).toFixed(2)} ${cur}`;

  const columns: Column<Invoice>[] = [
    { header: "Invoice", render: (i) => <span className="font-mono text-xs">{i.invoice_no}</span> },
    { header: t("nav.children"), render: (i) => (i.child ? `${i.child.first_name} ${i.child.last_name}` : `#${i.child_id}`) },
    { header: "Total", render: (i) => <span className="font-medium">{money(i.total_minor, i.currency)}</span> },
    { header: "Due", render: (i) => i.due_date.slice(0, 10) },
    { header: t("common.status"), render: (i) => <span className={`badge ${INVOICE_STATUS_TINT[i.status]}`}>{i.status}</span> },
    {
      header: t("common.actions"),
      className: "w-24",
      render: (i) =>
        i.status === "due" || i.status === "overdue" ? (
          <button className="btn-secondary !p-1.5 text-red-600" title="Cancel invoice" onClick={() => cancel.mutate(i.id)}>
            <XCircle size={14} />
          </button>
        ) : null,
    },
  ];

  const [multiCreating, setMultiCreating] = useState(false);
  const [multiChildId, setMultiChildId] = useState("");
  const [multiMonths, setMultiMonths] = useState("3");
  // Defaults to the current month. This was hardcoded to "2026-08", which
  // silently billed the wrong period for anyone who didn't notice and edit it.
  const [multiStart, setMultiStart] = useState(() => new Date().toISOString().slice(0, 7));

  const payMulti = useMutation({
    mutationFn: async () =>
      api.post("/admin/invoices/pay-multi-months", {
        child_id: Number(multiChildId),
        months_count: Number(multiMonths),
        start_period: multiStart,
      }),
    onSuccess: () => {
      setMultiCreating(false);
      void list.refetch();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("nav.invoices")}</h1>
      <DataTable
        columns={columns}
        rows={list.rows}
        meta={list.meta}
        loading={list.loading}
        onPage={list.setPage}
        rowKey={(i) => i.id}
        toolbar={
          <>
            <select className="input !w-36" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {Object.keys(INVOICE_STATUS_TINT).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button className="btn-secondary" onClick={() => setMultiCreating(true)}>
              Pay Multi-Months
            </button>
            <button className="btn-primary" onClick={() => setCreating(true)}>
              <Plus size={16} /> {t("common.create")}
            </button>
          </>
        }
      />

      <Modal open={creating} title={t("common.create")} onClose={() => setCreating(false)}>
        <div className="space-y-4">
          <div>
            <label className="label">Child</label>
            <select className="input" value={childId} onChange={(e) => setChildId(e.target.value)}>
              <option value="">—</option>
              {(children.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Due date</label>
              <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Period</label>
              <input className="input" placeholder="2026-06" value={period} onChange={(e) => setPeriod(e.target.value)} />
            </div>
            <div>
              <label className="label">Currency</label>
              <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {["SEK", "EUR", "USD"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Line items</label>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder="Label"
                    value={item.label}
                    onChange={(e) => setItems((p) => p.map((it, i) => (i === idx ? { ...it, label: e.target.value } : it)))}
                  />
                  <input
                    className="input w-32"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={item.amount}
                    onChange={(e) => setItems((p) => p.map((it, i) => (i === idx ? { ...it, amount: e.target.value } : it)))}
                  />
                  <button
                    className="text-slate-400 hover:text-red-600"
                    onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
                    disabled={items.length === 1}
                    aria-label="Remove item"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button className="btn-secondary mt-2 !px-2 !py-1 text-xs" onClick={() => setItems((p) => [...p, { label: "", amount: "" }])}>
              <Plus size={12} /> Item
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setCreating(false)}>
              {t("common.cancel")}
            </button>
            <button className="btn-primary" disabled={!childId || !dueDate || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={multiCreating} title="Record Multi-Month Payment" onClose={() => setMultiCreating(false)}>
        <div className="space-y-4">
          <div>
            <label className="label">Child</label>
            <select className="input" value={multiChildId} onChange={(e) => setMultiChildId(e.target.value)}>
              <option value="">— Select Child —</option>
              {(children.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Number of Months</label>
              <input
                className="input"
                type="number"
                min="1"
                max="24"
                value={multiMonths}
                onChange={(e) => setMultiMonths(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Start Period</label>
              <input
                className="input"
                placeholder="2026-08"
                value={multiStart}
                onChange={(e) => setMultiStart(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setMultiCreating(false)}>
              {t("common.cancel")}
            </button>
            <button
              className="btn-primary"
              disabled={!multiChildId || !multiMonths || payMulti.isPending}
              onClick={() => payMulti.mutate()}
            >
              {payMulti.isPending ? t("common.saving") : "Submit Payment"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
