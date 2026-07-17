import { useQuery } from "@tanstack/react-query";
import { Baby, CalendarDays, CreditCard, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatCard } from "../../components/StatCard";
import { api } from "../../lib/api";
import type { AuditLog, ListResponse } from "../../types/api";

function useCount(key: string, url: string, params: Record<string, string | number> = {}) {
  return useQuery({
    queryKey: ["count", key],
    queryFn: async () => {
      const res = await api.get<ListResponse<unknown>>(url, { params: { page: 1, per_page: 1, ...params } });
      return res.data.meta?.total ?? 0;
    },
  });
}

export function DashboardPage() {
  const { t } = useTranslation();
  const children = useCount("children", "/children");
  const parents = useCount("parents", "/admin/users", { role: "parent" });
  const events = useCount("events", "/events", { tab: "upcoming" });
  const dueInvoices = useCount("invoices-due", "/invoices", { status: "due" });

  const audit = useQuery({
    queryKey: ["audit-recent"],
    queryFn: async () => {
      const res = await api.get<ListResponse<AuditLog>>("/admin/audit-logs", { params: { page: 1, per_page: 8 } });
      return res.data.data;
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("nav.dashboard")}</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Baby} label={t("nav.children")} value={children.data ?? "–"} />
        <StatCard icon={Users} label={t("nav.users")} value={parents.data ?? "–"} tint="bg-sky-100 text-sky-700" />
        <StatCard icon={CalendarDays} label={t("nav.events")} value={events.data ?? "–"} tint="bg-amber-100 text-amber-700" />
        <StatCard icon={CreditCard} label={t("nav.invoices")} value={dueInvoices.data ?? "–"} tint="bg-rose-100 text-rose-700" />
      </div>

      <div className="card">
        <div className="border-b border-slate-200 px-5 py-3 font-medium">{t("nav.audit")}</div>
        <ul className="divide-y divide-slate-100 text-sm">
          {(audit.data ?? []).map((log) => (
            <li key={log.id} className="flex items-center gap-3 px-5 py-3">
              <span className="badge bg-brand-100 text-brand-700">{log.action}</span>
              <span className="font-medium">{log.entity}</span>
              <span className="text-slate-400">#{log.entity_id}</span>
              <span className="ms-auto text-xs text-slate-400">{new Date(log.created_at).toLocaleString()}</span>
            </li>
          ))}
          {audit.data?.length === 0 && <li className="px-5 py-6 text-center text-slate-400">{t("common.noData")}</li>}
        </ul>
      </div>
    </div>
  );
}
