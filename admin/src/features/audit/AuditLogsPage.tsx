import { useTranslation } from "react-i18next";
import { DataTable, type Column } from "../../components/DataTable";
import { usePagedList } from "../../hooks/usePagedList";
import type { AuditLog } from "../../types/api";

const ACTION_TINT: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-700",
  update: "bg-sky-100 text-sky-700",
  delete: "bg-rose-100 text-rose-700",
};

export function AuditLogsPage() {
  const { t } = useTranslation();
  const list = usePagedList<AuditLog>("audit-logs", "/admin/audit-logs");

  const columns: Column<AuditLog>[] = [
    {
      header: "Action",
      render: (l) => <span className={`badge ${ACTION_TINT[l.action] ?? "bg-slate-100 text-slate-600"}`}>{l.action}</span>,
    },
    { header: "Entity", render: (l) => `${l.entity} #${l.entity_id}` },
    { header: "Actor", render: (l) => `user #${l.actor_user_id}` },
    {
      header: "Details",
      render: (l) => (
        <code className="block max-w-md truncate text-xs text-slate-500">{l.diff ? JSON.stringify(l.diff) : "—"}</code>
      ),
    },
    { header: "IP", render: (l) => l.ip || "—" },
    { header: t("common.date"), render: (l) => new Date(l.created_at).toLocaleString() },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("nav.audit")}</h1>
      <DataTable columns={columns} rows={list.rows} meta={list.meta} loading={list.loading} onPage={list.setPage} rowKey={(l) => l.id} />
    </div>
  );
}
