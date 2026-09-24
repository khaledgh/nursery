import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { EmptyState } from "../../components/Tabs";
import { api, errorMessage } from "../../lib/api";
import { INVOICE_STATUS_TINT, tint } from "../../lib/tints";
import type { ItemResponse, Invoice } from "../../types/api";

function money(minor: number, currency: string) {
  return `${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currency}`;
}

/**
 * One invoice's line items and payment history on its own page.
 *
 * The invoices table previously had no detail view at all — the row itself
 * was the only representation, so there was nowhere to see line items or a
 * settlement's provider reference without querying the database directly.
 */
export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => (await api.get<ItemResponse<Invoice>>(`/invoices/${id}`)).data.data,
    enabled: Boolean(id),
  });

  const [cancelError, setCancelError] = useState("");
  const cancel = useMutation({
    mutationFn: async () => api.post(`/admin/invoices/${id}/cancel`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["invoice", id] }),
    onError: (err) => setCancelError(errorMessage(err)),
  });

  if (isLoading) return <p className="text-sm font-semibold text-slate-500">Loading…</p>;
  if (!invoice) return <p className="text-sm font-semibold text-rose-600">Invoice not found.</p>;

  const child = invoice.child;
  const canCancel = invoice.status === "due" || invoice.status === "overdue";

  return (
    <>
      <PageHeader
        title={invoice.invoice_no}
        subtitle={child ? `${child.first_name} ${child.last_name} · ${invoice.period}` : invoice.period}
        breadcrumbs={[{ label: "Money", to: "/invoices" }, { label: "Invoice" }]}
        backTo="/invoices"
        actions={
          <>
            <span className={`badge ${tint(INVOICE_STATUS_TINT, invoice.status)}`}>{invoice.status}</span>
            {canCancel && (
              <button
                onClick={() => cancel.mutate()}
                className="btn btn-secondary text-rose-600"
                disabled={cancel.isPending}
                type="button"
              >
                <XCircle size={15} /> Cancel invoice
              </button>
            )}
            {cancelError && (
              <span className="text-xs font-semibold text-rose-600">{cancelError}</span>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-slate-700">Line items</h2>
            {(invoice.items ?? []).length === 0 ? (
              <EmptyState title="No line items on this invoice" />
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {(invoice.items ?? []).map((item) => (
                    <tr key={item.id} className="table-row">
                      <td className="table-cell">{item.label}</td>
                      <td className="table-cell text-end font-bold">
                        {money(item.amount_minor, invoice.currency)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-200">
                    <td className="table-cell font-extrabold">Total</td>
                    <td className="table-cell text-end font-extrabold text-brand-700">
                      {money(invoice.total_minor, invoice.currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </section>

          <section className="card p-6">
            <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-slate-700">
              Payment history
            </h2>
            {(invoice.payments ?? []).length === 0 ? (
              <EmptyState
                title="No payments recorded yet"
                hint="A payment appears here once the family settles this invoice through a provider."
              />
            ) : (
              <ul className="space-y-3">
                {(invoice.payments ?? []).map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 p-4"
                  >
                    {p.status === "paid" ? (
                      <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />
                    ) : (
                      <XCircle size={18} className="shrink-0 text-slate-300" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-800">
                        {money(p.amount_minor, invoice.currency)} via {p.provider}
                      </p>
                      <p className="truncate text-xs font-semibold text-slate-400">
                        {p.provider_ref} {p.paid_at ? `· settled ${p.paid_at.slice(0, 10)}` : ""}
                      </p>
                    </div>
                    <span
                      className={`badge shrink-0 ${
                        p.status === "paid"
                          ? "bg-emerald-100 text-emerald-700"
                          : p.status === "declined" || p.status === "error"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {p.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="card space-y-4 p-5">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Details</h3>
          <Detail label="Due date" value={invoice.due_date.slice(0, 10)} />
          <Detail label="Period" value={invoice.period || "—"} />
          <Detail label="Currency" value={invoice.currency} />
          {child && <Detail label="Child" value={`${child.first_name} ${child.last_name}`} />}
        </aside>
      </div>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}
