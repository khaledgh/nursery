import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  CreditCard,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { api, errorMessage } from "../../lib/api";
import type { PlatformReminder } from "../../types/api";

export function SuperAdminRemindersPage() {
  const qc = useQueryClient();
  const [filterType, setFilterType] = useState<"all" | "overdue" | "capacity">("all");
  const [banner, setBanner] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const reminders = useQuery({
    queryKey: ["platform-reminders"],
    queryFn: async () => (await api.get<{ data: PlatformReminder[] }>("/superadmin/reminders")).data.data,
  });

  const markPaid = useMutation({
    mutationFn: async (id: number) => api.post(`/superadmin/subscription-invoices/${id}/mark-paid`),
    onSuccess: () => {
      setBanner({ text: "Invoice settled and removed from reminders.", type: "success" });
      void qc.invalidateQueries({ queryKey: ["platform-reminders"] });
      void qc.invalidateQueries({ queryKey: ["platform-stats"] });
    },
    onError: (e) => setBanner({ text: errorMessage(e), type: "error" }),
  });

  const checkNow = useMutation({
    mutationFn: async () =>
      api.post("/superadmin/subscription-invoices/auto-run"),
    onSuccess: () => {
      setBanner({ text: "Platform checks and billing sweep completed.", type: "success" });
      void qc.invalidateQueries({ queryKey: ["platform-reminders"] });
      void qc.invalidateQueries({ queryKey: ["platform-stats"] });
    },
    onError: (e) => setBanner({ text: errorMessage(e), type: "error" }),
  });

  const allReminders = reminders.data ?? [];
  const filtered = allReminders.filter((r) => {
    if (filterType === "all") return true;
    return r.type === filterType;
  });

  return (
    <div className="space-y-8 pb-12">
      {banner && (
        <div
          className={`flex items-center justify-between p-4 rounded-2xl border text-sm font-bold shadow-sm ${
            banner.type === "success"
              ? "bg-teal-50 border-teal-200 text-teal-800 dark:bg-teal-950/40 dark:border-teal-800 dark:text-teal-200"
              : "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {banner.type === "success" ? <CheckCircle2 size={18} className="text-teal-600" /> : <AlertTriangle size={18} className="text-rose-600" />}
            <span>{banner.text}</span>
          </div>
          <button
            onClick={() => setBanner(null)}
            className="text-xs uppercase font-extrabold opacity-60 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      <PageHeader
        title="Reminders & Alerts Center"
        subtitle="Automated monitor for late payments, student capacity limits, and subscription renewals."
        actions={
          <button
            onClick={() => checkNow.mutate()}
            disabled={checkNow.isPending}
            className="btn btn-primary text-xs sm:text-sm"
          >
            <RefreshCw size={15} className={checkNow.isPending ? "animate-spin" : ""} />
            <span>Run Billing & Capacity Sweep</span>
          </button>
        }
      />

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setFilterType("all")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            filterType === "all"
              ? "bg-brand-600 text-white shadow-sm"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          All Alerts ({allReminders.length})
        </button>
        <button
          onClick={() => setFilterType("overdue")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            filterType === "overdue"
              ? "bg-rose-600 text-white shadow-sm"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          Payment Overdue ({allReminders.filter((r) => r.type === "overdue").length})
        </button>
        <button
          onClick={() => setFilterType("capacity")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            filterType === "capacity"
              ? "bg-amber-600 text-white shadow-sm"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          High Capacity Warnings ({allReminders.filter((r) => r.type === "capacity").length})
        </button>
      </div>

      {/* Reminders List */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="card p-12 text-center border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 flex items-center justify-center">
              <ShieldCheck size={28} />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
              No Pending Reminders
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              All childcare centers are paid up to date and operating well within their assigned student capacity caps.
            </p>
          </div>
        ) : (
          filtered.map((r) => (
            <div
              key={r.id}
              className={`card p-5 border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                r.severity === "high"
                  ? "border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/10"
                  : "border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/10"
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`p-3 rounded-2xl shrink-0 ${
                    r.severity === "high"
                      ? "bg-rose-500 text-white shadow-md shadow-rose-500/20"
                      : "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                  }`}
                >
                  {r.type === "overdue" ? <CreditCard size={20} /> : <Users size={20} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                      {r.nursery_name}
                    </span>
                    <span
                      className={`badge text-[9px] font-extrabold uppercase ${
                        r.severity === "high"
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                      }`}
                    >
                      {r.type}
                    </span>
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                    {r.title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {r.description}
                  </p>
                  {r.due_date && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 mt-2">
                      <Calendar size={13} /> Due Date: {r.due_date}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                {r.action_type === "mark_paid" && r.action_id && (
                  <button
                    onClick={() => markPaid.mutate(r.action_id!)}
                    disabled={markPaid.isPending}
                    className="btn btn-primary text-xs py-2 px-3.5"
                  >
                    <Check size={14} /> Mark Paid
                  </button>
                )}
                {r.action_type === "upgrade_plan" && (
                  <Link
                    to="/superadmin"
                    className="btn btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5"
                  >
                    <Building2 size={14} />
                    <span>Manage Nursery</span>
                  </Link>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
