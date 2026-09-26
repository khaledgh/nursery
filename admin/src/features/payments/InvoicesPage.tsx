import { useMutation } from "@tanstack/react-query";
import { Plus, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Select, SelectItem } from "@heroui/react";
import { DataTable, type Column } from "../../components/DataTable";
import { Modal } from "../../components/Modal";
import { DatePicker } from "../../components/DatePicker";
import { ChildPicker } from "../../components/Pickers";
import { usePagedList } from "../../hooks/usePagedList";
import { useCurrency } from "../../hooks/useCurrency";
import { api, errorMessage } from "../../lib/api";
import type { Invoice } from "../../types/api";
import { INVOICE_STATUS_TINT } from "../../lib/tints";
import { Link } from "react-router-dom";


interface DraftItem {
  label: string;
  amount: string; // major units in the form; converted to minor on submit
}

export function InvoicesPage() {
  const { t } = useTranslation();
  const { currency: defaultCurrency, formatMoney } = useCurrency();
  const [statusFilter, setStatusFilter] = useState("");
  const list = usePagedList<Invoice>("invoices", "/invoices", { status: statusFilter || undefined });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const [childId, setChildId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [period, setPeriod] = useState("");
  const [currency, setCurrency] = useState("");

  const activeCurrency = currency || defaultCurrency;
  const [items, setItems] = useState<DraftItem[]>([{ label: "Tuition", amount: "" }]);

  const create = useMutation({
    mutationFn: async () =>
      api.post("/admin/invoices", {
        child_id: Number(childId),
        currency: activeCurrency,
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

  const columns: Column<Invoice>[] = [
    {
      header: "Invoice",
      sortKey: "invoice_no",
      allowsSorting: true,
      render: (i) => (
        <Link to={`/invoices/${i.id}`} className="font-mono text-xs font-bold text-primary hover:underline">
          {i.invoice_no}
        </Link>
      ),
    },
    { header: t("nav.children"), render: (i) => (i.child ? `${i.child.first_name} ${i.child.last_name}` : `#${i.child_id}`) },
    {
      header: "Total",
      sortKey: "total_minor",
      allowsSorting: true,
      render: (i) => <span className="font-semibold text-slate-800 dark:text-slate-100">{formatMoney(i.total_minor, i.currency)}</span>,
    },
    {
      header: "Due",
      sortKey: "due_date",
      allowsSorting: true,
      render: (i) => i.due_date.slice(0, 10),
    },
    {
      header: t("common.status"),
      render: (i) => {
        const badgeClass =
          i.status === "paid"
            ? "badge-success"
            : i.status === "overdue"
              ? "badge-danger"
              : i.status === "due"
                ? "badge-warning"
                : "badge-neutral";
        return <span className={`badge ${badgeClass} uppercase text-[10px]`}>{i.status}</span>;
      },
    },
    {
      header: t("common.actions"),
      className: "w-24",
      render: (i) =>
        i.status === "due" || i.status === "overdue" ? (
          <Button
            isIconOnly
            size="sm"
            variant="light"
            color="danger"
            radius="lg"
            title="Cancel invoice"
            onPress={() => cancel.mutate(i.id)}
            className="text-rose-500 hover:bg-rose-50"
          >
            <XCircle size={15} />
          </Button>
        ) : null,
    },
  ];

  const [multiCreating, setMultiCreating] = useState(false);
  const [multiChildId, setMultiChildId] = useState("");
  const [multiMonths, setMultiMonths] = useState("3");
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">{t("nav.invoices")}</h1>
      </div>
      <DataTable
        columns={columns}
        rows={list.rows}
        meta={list.meta}
        loading={list.loading}
        search={list.search}
        onSearch={list.setSearch}
        onPage={list.setPage}
        rowKey={(i) => i.id}
        sortDescriptor={list.sortDescriptor}
        onSortChange={list.setSortDescriptor}
        toolbar={
          <div className="flex items-center gap-2">
            <Select
              size="sm"
              variant="bordered"
              radius="lg"
              placeholder="All statuses"
              selectedKeys={statusFilter ? [statusFilter] : []}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              className="w-36"
              classNames={{
                trigger: "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-sm rounded-xl",
                popoverContent: "bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xl rounded-2xl p-1",
              }}
            >
              {[
                { key: "", label: "All statuses" },
                ...Object.keys(INVOICE_STATUS_TINT).map((s) => ({ key: s, label: s })),
              ].map((item) => (
                <SelectItem key={item.key} textValue={item.label}>
                  {item.label}
                </SelectItem>
              ))}
            </Select>
            <Button
              variant="bordered"
              radius="lg"
              onPress={() => setMultiCreating(true)}
              className="font-bold border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm"
            >
              Pay Multi-Months
            </Button>
            <Button
              color="primary"
              radius="lg"
              startContent={<Plus size={16} />}
              onPress={() => setCreating(true)}
              className="font-bold shadow-md shadow-primary/25"
            >
              {t("common.create")}
            </Button>
          </div>
        }
      />

      <Modal open={creating} title={t("common.create")} onClose={() => setCreating(false)}>
        <div className="space-y-4">
          <div>
            <label className="label">Child</label>
            <ChildPicker value={childId} onChange={setChildId} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Due date</label>
              <DatePicker value={dueDate} onChange={setDueDate} />
            </div>
            <div>
              <label className="label">Period</label>
              <input className="input" placeholder="2026-06" value={period} onChange={(e) => setPeriod(e.target.value)} />
            </div>
            <div>
              <label className="label">Currency</label>
              <select className="input" value={activeCurrency} onChange={(e) => setCurrency(e.target.value)}>
                {Array.from(new Set([defaultCurrency, "USD", "SAR", "AED", "KWD", "EUR", "GBP", "QAR", "BHD", "SEK"])).map((c) => (
                  <option key={c} value={c}>{c}</option>
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
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    color="danger"
                    radius="lg"
                    onPress={() => setItems((p) => p.filter((_, i) => i !== idx))}
                    isDisabled={items.length === 1}
                    aria-label="Remove item"
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              size="sm"
              variant="flat"
              color="primary"
              radius="lg"
              className="mt-2 font-bold"
              startContent={<Plus size={14} />}
              onPress={() => setItems((p) => [...p, { label: "", amount: "" }])}
            >
              Add Item
            </Button>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="flat" color="default" onPress={() => setCreating(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              color="primary"
              isDisabled={!childId || !dueDate || create.isPending}
              isLoading={create.isPending}
              onPress={() => create.mutate()}
              className="font-bold shadow-md shadow-primary/25"
            >
              {create.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={multiCreating} title="Record Multi-Month Payment" onClose={() => setMultiCreating(false)}>
        <div className="space-y-4">
          <div>
            <label className="label">Child</label>
            <ChildPicker value={multiChildId} onChange={setMultiChildId} />
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
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="flat" color="default" onPress={() => setMultiCreating(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              color="primary"
              isDisabled={!multiChildId || !multiMonths || payMulti.isPending}
              isLoading={payMulti.isPending}
              onPress={() => payMulti.mutate()}
              className="font-bold shadow-md shadow-primary/25"
            >
              {payMulti.isPending ? t("common.saving") : "Submit Payment"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
