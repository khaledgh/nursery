import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { EmptyState } from "../../components/Tabs";
import { api } from "../../lib/api";
import type { ListResponse, Notification } from "../../types/api";

/** Where the header bell links to. Read-only history of what fired for this admin. */
export function NotificationsPage() {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications-list"],
    queryFn: async () =>
      (await api.get<ListResponse<Notification>>("/notifications", { params: { per_page: 50 } })).data.data,
  });

  const markAllRead = useMutation({
    mutationFn: async () => api.post("/notifications/read-all"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications-list"] });
      void qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  const items = data ?? [];

  return (
    <>
      <PageHeader
        title="Notifications"
        actions={
          items.some((n) => !n.read_at) && (
            <button onClick={() => markAllRead.mutate()} className="btn btn-secondary" type="button">
              <Check size={15} /> Mark all read
            </button>
          )
        }
      />

      {items.length === 0 ? (
        <EmptyState title="No notifications yet" hint="Alerts about attendance, payments, and reminders will show up here." />
      ) : (
        <div className="card divide-y divide-slate-100">
          {items.map((n) => (
            <div key={n.id} className={`flex items-start gap-3 p-4 ${n.read_at ? "" : "bg-brand-50/30"}`}>
              <div
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  n.read_at ? "bg-slate-100 text-slate-400" : "bg-brand-100 text-brand-700"
                }`}
              >
                <Bell size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800">{n.title}</p>
                {n.body && <p className="mt-0.5 text-xs font-semibold text-slate-500">{n.body}</p>}
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {n.category} · {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
