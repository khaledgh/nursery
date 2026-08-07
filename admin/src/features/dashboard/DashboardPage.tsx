import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Baby, CalendarDays, CreditCard, Users, CheckSquare, Square, Plus, Trash2, ArrowRight, UserPlus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { StatCard } from "../../components/StatCard";
import { SeatMeter } from "../../components/SeatMeter";
import { api } from "../../lib/api";
import type { AuditLog, Child, ListResponse, Reminder, ItemResponse } from "../../types/api";

function useCount(key: string, url: string, params: Record<string, string | number> = {}) {
  return useQuery({
    queryKey: ["count", key],
    queryFn: async () => {
      const res = await api.get<ListResponse<unknown>>(url, { params: { page: 1, per_page: 1, ...params } });
      return res.data.meta?.total ?? 0;
    },
  });
}

const COLORS = ["#5b9c34", "#8fc464", "#2f551a", "#f59e0b", "#3b82f6", "#8b5cf6"];

export function DashboardPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [newTaskTitle, setNewTaskTitle] = useState("");

  // Counts for cards
  const parents = useCount("parents", "/admin/users", { role: "parent" });
  const events = useCount("events", "/events", { tab: "upcoming" });
  const dueInvoices = useCount("invoices-due", "/invoices", { status: "due" });

  // Full children list to compute attendance ratio & classroom distributions
  const childrenQuery = useQuery({
    queryKey: ["children-dashboard"],
    queryFn: async () => {
      const res = await api.get<ListResponse<Child>>("/children", { params: { per_page: 200 } });
      return res.data.data;
    },
  });

  // Reminders list
  const remindersQuery = useQuery({
    queryKey: ["reminders-dashboard"],
    queryFn: async () => {
      const res = await api.get<ItemResponse<Reminder[]>>("/reminders");
      return res.data.data;
    },
  });

  // Recent audit logs
  const audit = useQuery({
    queryKey: ["audit-recent"],
    queryFn: async () => {
      const res = await api.get<ListResponse<AuditLog>>("/admin/audit-logs", { params: { page: 1, per_page: 6 } });
      return res.data.data;
    },
  });

  // Delete reminder mutation (triggered by clicking checkbox / trash)
  const deleteReminder = useMutation({
    mutationFn: async (id: number) => api.delete(`/reminders/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["reminders-dashboard"] });
    },
  });

  // Add reminder quick task mutation
  const addReminder = useMutation({
    mutationFn: async (title: string) =>
      api.post("/reminders", {
        title,
        scope: "global",
        kind: "general",
        weather_alert: false,
      }),
    onSuccess: () => {
      setNewTaskTitle("");
      void qc.invalidateQueries({ queryKey: ["reminders-dashboard"] });
    },
  });

  // Compute metrics
  const kidsList = childrenQuery.data ?? [];
  const totalChildren = kidsList.length;
  const checkedIn = kidsList.filter((c) => c.present_status === "checked_in").length;
  const checkedOut = kidsList.filter((c) => c.present_status === "checked_out").length;
  const absent = kidsList.filter((c) => c.present_status === "absent").length;

  const presentPercentage = totalChildren > 0 ? Math.round((checkedIn / totalChildren) * 100) : 0;

  // Calculate real new children added this month
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const newKidsThisMonth = kidsList.filter(
    (c) => c.created_at && c.created_at.slice(0, 7) === currentMonthStr
  ).length;

  // Enrollment trend, derived from each child's created_at.
  //
  // This deliberately charts enrolment only. A historical attendance series
  // used to be plotted alongside it, but the past months were synthesised
  // (`88 + activeKids % 8`) rather than measured — a fabricated line on a
  // dashboard is worse than an absent one, because it gets acted on. Restore
  // it once the API exposes real per-month attendance.
  const dynamicTrendData = (() => {
    const trendData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleString("en-US", { month: "short" });
      const yearMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      const activeKids = kidsList.filter((c) => {
        if (!c.created_at) return true;
        return c.created_at.slice(0, 7) <= yearMonthStr;
      }).length;

      trendData.push({ name: monthLabel, "Active Children": activeKids });
    }
    return trendData;
  })();

  // Compute classroom distribution
  const classroomMap: Record<string, number> = {};
  kidsList.forEach((c) => {
    const roomName = c.classroom?.name ?? "Unassigned";
    classroomMap[roomName] = (classroomMap[roomName] || 0) + 1;
  });
  const pieData = Object.entries(classroomMap).map(([name, value]) => ({ name, value }));

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskTitle.trim()) {
      addReminder.mutate(newTaskTitle.trim());
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">{t("nav.dashboard")}</h1>
          <p className="text-sm font-semibold text-slate-400 mt-1">Here is a quick overview of your nursery today.</p>
        </div>
        <Link to="/families/new" className="btn btn-primary shrink-0">
          <UserPlus size={16} /> Enrol a family
        </Link>
      </div>

      {/* Seat usage: shows the plan's ceiling before a create fails against it. */}
      <SeatMeter />

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Baby}
          label={t("nav.children")}
          value={totalChildren}
          tint="bg-brand-50 text-brand-700"
          trend={newKidsThisMonth > 0 ? `+${newKidsThisMonth}` : "0"}
          trendDirection={newKidsThisMonth > 0 ? "up" : "down"}
        />
        <StatCard
          icon={Users}
          label={t("nav.users")}
          value={parents.data ?? 0}
          tint="bg-sky-50 text-sky-700"
        />
        <StatCard
          icon={CalendarDays}
          label={t("nav.events")}
          value={events.data ?? 0}
          tint="bg-amber-50 text-amber-700"
        />
        <StatCard
          icon={CreditCard}
          label={t("nav.invoices")}
          value={dueInvoices.data ?? 0}
          tint="bg-rose-50 text-rose-700"
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column: Presence & Charts */}
        <div className="lg:col-span-2 space-y-8">
          {/* Presence Tracker */}
          <div className="card p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-extrabold text-slate-800">Children Presence Tracker</h3>
                <p className="text-xs font-bold text-slate-400 mt-0.5">Real-time occupancy status</p>
              </div>
              <span className="badge bg-emerald-50 text-emerald-700 font-bold">{presentPercentage}% Present</span>
            </div>

            {/* Stacked progress bar */}
            <div className="h-4 w-full flex rounded-full overflow-hidden bg-slate-100">
              <div
                style={{ width: `${totalChildren > 0 ? (checkedIn / totalChildren) * 100 : 0}%` }}
                className="bg-brand-600 transition-all duration-500"
                title={`Checked In: ${checkedIn}`}
              ></div>
              <div
                style={{ width: `${totalChildren > 0 ? (checkedOut / totalChildren) * 100 : 0}%` }}
                className="bg-brand-300 transition-all duration-500"
                title={`Checked Out: ${checkedOut}`}
              ></div>
              <div
                style={{ width: `${totalChildren > 0 ? (absent / totalChildren) * 100 : 0}%` }}
                className="bg-rose-400 transition-all duration-500"
                title={`Absent: ${absent}`}
              ></div>
            </div>

            {/* Occupancy details */}
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="text-center p-3 rounded-2xl bg-brand-50/40 border border-brand-100/50">
                <span className="block text-xl font-extrabold text-brand-800">{checkedIn}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Checked In</span>
              </div>
              <div className="text-center p-3 rounded-2xl bg-brand-50/20 border border-slate-100">
                <span className="block text-xl font-extrabold text-brand-600">{checkedOut}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Checked Out</span>
              </div>
              <div className="text-center p-3 rounded-2xl bg-rose-50/30 border border-rose-100/30">
                <span className="block text-xl font-extrabold text-rose-600">{absent}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Absent</span>
              </div>
            </div>
          </div>

          {/* Enrollment Area Chart */}
          <div className="card p-6 space-y-4">
            <div>
              <h3 className="text-[15px] font-extrabold text-slate-800">Enrollment & Attendance Trends</h3>
              <p className="text-xs font-bold text-slate-400 mt-0.5">Development over the last 6 months</p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dynamicTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorKids" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5b9c34" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#5b9c34" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Active Children"
                    stroke="#5b9c34"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorKids)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Column: Donut Chart & Reminders Checklist */}
        <div className="space-y-8">
          {/* Classroom Donut Chart */}
          <div className="card p-6 space-y-4">
            <div>
              <h3 className="text-[15px] font-extrabold text-slate-800">Classroom Distribution</h3>
              <p className="text-xs font-bold text-slate-400 mt-0.5">Children registered per room</p>
            </div>
            <div className="h-56 relative flex items-center justify-center">
              {pieData.length === 0 ? (
                <div className="text-xs text-slate-400">No classroom data available</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#fff",
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0",
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: "11px", fontWeight: "bold", color: "#64748b" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Tasks & Reminders List */}
          <div className="card p-6 flex flex-col justify-between min-h-[340px]">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[15px] font-extrabold text-slate-800">Tasks & Reminders</h3>
                  <p className="text-xs font-bold text-slate-400 mt-0.5">Active alerts checklist</p>
                </div>
                <Link to="/reminders" className="text-xs font-bold text-brand-600 hover:text-brand-800 flex items-center gap-0.5">
                  View All <ArrowRight size={12} />
                </Link>
              </div>

              {/* Tasks Checklist */}
              <ul className="space-y-3 max-h-52 overflow-y-auto pr-1">
                {(remindersQuery.data ?? []).slice(0, 4).map((task) => (
                  <li
                    key={task.id}
                    className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-50 bg-slate-50/50 hover:bg-slate-50 transition-colors group"
                  >
                    <button
                      onClick={() => deleteReminder.mutate(task.id)}
                      className="text-slate-400 hover:text-brand-600 shrink-0 mt-0.5 transition-colors"
                      title="Mark as completed"
                    >
                      <Square size={16} className="group-hover:hidden" />
                      <CheckSquare size={16} className="hidden group-hover:block text-brand-600" />
                    </button>
                    
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-700 truncate">{task.title}</div>
                      {task.description && (
                        <div className="text-[10px] font-medium text-slate-400 truncate mt-0.5">{task.description}</div>
                      )}
                      <div className="flex gap-1.5 mt-1.5">
                        <span className="badge bg-brand-100 text-brand-700 !text-[8px] px-1 py-0">{task.scope}</span>
                        {task.date && (
                          <span className="badge bg-amber-50 text-amber-700 !text-[8px] px-1 py-0">
                            {task.date.slice(0, 10)}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => deleteReminder.mutate(task.id)}
                      className="text-slate-300 hover:text-red-600 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity duration-150"
                      aria-label="Delete task"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
                {(remindersQuery.data ?? []).length === 0 && (
                  <li className="py-6 text-center text-xs font-bold text-slate-400">All tasks completed!</li>
                )}
              </ul>
            </div>

            {/* Quick add input */}
            <form onSubmit={handleAddTask} className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
              <input
                type="text"
                placeholder="Add quick task..."
                className="flex-1 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white text-slate-700"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
              />
              <button
                type="submit"
                disabled={!newTaskTitle.trim() || addReminder.isPending}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors shrink-0 disabled:opacity-50"
              >
                <Plus size={16} />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Recent Activities Feed (Audit Logs) */}
      <div className="card p-6 space-y-5">
        <div>
          <h3 className="text-[15px] font-extrabold text-slate-800">Recent Activities Feed</h3>
          <p className="text-xs font-bold text-slate-400 mt-0.5">Audit updates from nursery operations</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(audit.data ?? []).map((log) => {
            const dateStr = new Date(log.created_at).toLocaleDateString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <div
                key={log.id}
                className="flex items-start gap-3 p-4 rounded-xl border border-slate-100 hover:border-brand-100 hover:bg-brand-50/5 transition-all duration-200"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 shrink-0 font-extrabold text-xs">
                  {log.action.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="badge bg-brand-100 text-brand-700 !text-[9px] font-bold px-1.5 py-0">
                      {log.action}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400">{dateStr}</span>
                  </div>
                  <div className="text-xs font-bold text-slate-700 mt-1.5 truncate">
                    {log.entity} <span className="text-slate-400 font-semibold">#{log.entity_id}</span>
                  </div>
                  <div className="text-[10px] font-semibold text-slate-400 mt-0.5">IP: {log.ip}</div>
                </div>
              </div>
            );
          })}
          {audit.data?.length === 0 && (
            <div className="col-span-full py-8 text-center text-xs font-bold text-slate-400">{t("common.noData")}</div>
          )}
        </div>
      </div>
    </div>
  );
}

