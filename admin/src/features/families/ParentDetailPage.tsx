import { useQuery } from "@tanstack/react-query";
import { Baby, Check, Copy, Mail, Phone, Wallet } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { api } from "../../lib/api";
import { INVOICE_STATUS_TINT, PRESENCE_TINT, tint } from "../../lib/tints";
import type { ParentDetail } from "../../types/api";

function money(minor: number, currency = "SEK") {
  return `${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currency}`;
}

/**
 * The family hub.
 *
 * Previously the parent→child direction was not navigable at all: the panel
 * could only reach a parent from inside a child's guardian modal, so "which
 * children does this parent have, and what do they owe?" required scanning the
 * children table by hand.
 */
export function ParentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["parent", id],
    queryFn: async () => (await api.get<{ data: ParentDetail }>(`/admin/parents/${id}`)).data.data,
    enabled: Boolean(id),
  });

  if (isLoading) return <p className="text-sm font-semibold text-slate-500">Loading…</p>;
  if (isError || !data) return <p className="text-sm font-semibold text-rose-600">Parent not found.</p>;

  const { parent, children, invoices } = data;

  const copyLoginId = async () => {
    if (!parent.login_id) return;
    await navigator.clipboard.writeText(parent.login_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <PageHeader
        title={parent.name}
        subtitle={parent.email}
        breadcrumbs={[{ label: "People", to: "/users" }, { label: "Family" }]}
        backTo="/users"
        actions={
          <Link to="/families/new" className="btn btn-secondary">
            Add sibling
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-slate-700">
              <Baby size={16} className="text-brand-600" />
              Children ({children.length})
            </h2>
            {children.length === 0 ? (
              <p className="text-sm font-semibold text-slate-400">No children linked yet.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {children.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/children/${c.id}`}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/40"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-extrabold text-brand-700">
                        {c.first_name[0]}
                        {c.last_name[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-800">
                          {c.first_name} {c.last_name}
                        </p>
                        <p className="truncate text-xs font-semibold text-slate-500">
                          {c.classroom?.name ?? "No classroom"}
                          {c.relationship ? ` · ${c.relationship}` : ""}
                        </p>
                      </div>
                      <span className={`badge shrink-0 ${tint(PRESENCE_TINT, c.present_status)}`}>
                        {c.present_status.replace("_", " ")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-6">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-slate-700">
              <Wallet size={16} className="text-brand-600" />
              Payments
            </h2>
            {invoices.length === 0 ? (
              <p className="text-sm font-semibold text-slate-400">No invoices yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="table-header text-start">Invoice</th>
                      <th className="table-header text-start">Period</th>
                      <th className="table-header text-start">Due</th>
                      <th className="table-header text-end">Amount</th>
                      <th className="table-header text-start">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="table-row">
                        <td className="table-cell font-mono text-xs">{inv.invoice_no}</td>
                        <td className="table-cell">{inv.period}</td>
                        <td className="table-cell">{inv.due_date}</td>
                        <td className="table-cell text-end font-bold">
                          {money(inv.total_minor, inv.currency)}
                        </td>
                        <td className="table-cell">
                          <span className={`badge ${tint(INVOICE_STATUS_TINT, inv.status)}`}>
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <div className="card space-y-4 p-5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Contact</h3>
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Mail size={14} className="text-slate-400" /> {parent.email}
            </p>
            {parent.phone && (
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Phone size={14} className="text-slate-400" /> {parent.phone}
              </p>
            )}
            {parent.login_id && (
              <div>
                <p className="label">App login ID</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg bg-slate-50 px-3 py-2 font-mono text-sm font-bold text-slate-800">
                    {parent.login_id}
                  </code>
                  <button
                    onClick={() => void copyLoginId()}
                    className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                    type="button"
                    aria-label="Copy login ID"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="card space-y-3 p-5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Balance</h3>
            <div>
              <p className="text-2xl font-extrabold text-slate-900">
                {money(data.outstanding_minor)}
              </p>
              <p className="text-xs font-semibold text-slate-500">
                outstanding across {data.unpaid_invoices} invoice
                {data.unpaid_invoices === 1 ? "" : "s"}
              </p>
            </div>
            <div className="border-t border-slate-100 pt-3">
              <p className="text-sm font-bold text-emerald-600">{money(data.paid_minor)}</p>
              <p className="text-xs font-semibold text-slate-400">paid to date</p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
