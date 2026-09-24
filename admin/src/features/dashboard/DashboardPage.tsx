import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle2,
  CreditCard,
  Plus,
  Square,
  CheckSquare,
  Trash2,
  School,
  UserPlus,
  TrendingUp,
  Wallet,
  ClipboardCheck,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Input,
  Progress,
} from "@heroui/react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCurrency } from "../../hooks/useCurrency";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/auth";
import type {
  AuditLog,
  Child,
  Classroom,
  EventItem,
  Invoice,
  ItemResponse,
  ListResponse,
  Reminder,
  SeatUsage,
} from "../../types/api";

export function DashboardPage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { currency, formatMoneyCompact } = useCurrency();

  const [newTaskTitle, setNewTaskTitle] = useState("");

  // Children query
  const childrenQuery = useQuery({
    queryKey: ["children-dashboard"],
    queryFn: async () =>
      (await api.get<ListResponse<Child>>("/children", { params: { per_page: 300 } })).data.data,
  });

  // Classrooms query
  const classroomsQuery = useQuery({
    queryKey: ["classrooms-dashboard"],
    queryFn: async () =>
      (await api.get<ListResponse<Classroom>>("/classrooms", { params: { per_page: 50 } })).data.data,
  });

  // Invoices query for live financial snapshot
  const invoicesQuery = useQuery({
    queryKey: ["invoices-dashboard"],
    queryFn: async () =>
      (await api.get<ListResponse<Invoice>>("/invoices", { params: { per_page: 300 } })).data.data,
  });

  // Upcoming events
  const eventsQuery = useQuery({
    queryKey: ["events-dashboard"],
    queryFn: async () =>
      (await api.get<ListResponse<EventItem>>("/events", { params: { tab: "upcoming", per_page: 4 } })).data.data,
  });

  // Reminders list
  const remindersQuery = useQuery({
    queryKey: ["reminders-dashboard"],
    queryFn: async () =>
      (await api.get<ItemResponse<Reminder[]>>("/reminders")).data.data,
  });

  // Recent audit logs
  const auditQuery = useQuery({
    queryKey: ["audit-dashboard"],
    queryFn: async () =>
      (await api.get<ListResponse<AuditLog>>("/admin/audit-logs", { params: { page: 1, per_page: 6 } })).data.data,
  });

  // Seats & Plan usage
  const seatsQuery = useQuery({
    queryKey: ["seats-dashboard"],
    queryFn: async () =>
      (await api.get<ItemResponse<SeatUsage>>("/me/seats")).data.data,
  });

  // Delete reminder mutation
  const deleteReminder = useMutation({
    mutationFn: async (id: number) => api.delete(`/reminders/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["reminders-dashboard"] });
    },
  });

  // Add reminder mutation
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

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskTitle.trim()) {
      addReminder.mutate(newTaskTitle.trim());
    }
  };

  // Operational metrics
  const kidsList = childrenQuery.data ?? [];
  const classroomsList = classroomsQuery.data ?? [];
  const invoicesList = invoicesQuery.data ?? [];
  const seats = seatsQuery.data;

  const totalChildren = kidsList.length;
  const checkedIn = kidsList.filter((c) => c.present_status === "checked_in").length;
  const checkedOut = kidsList.filter((c) => c.present_status === "checked_out").length;
  const absent = kidsList.filter((c) => c.present_status === "absent").length;
  const attendanceRate = totalChildren > 0 ? Math.round((checkedIn / totalChildren) * 100) : 0;

  // Financial calculations
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const currentMonthInvoices = useMemo(() => {
    return invoicesList.filter((i) => (i.period || i.due_date?.slice(0, 7)) === currentMonthStr);
  }, [invoicesList, currentMonthStr]);

  const mtdCollected = useMemo(() => {
    return currentMonthInvoices
      .filter((i) => i.status === "paid")
      .reduce((sum, i) => sum + i.total_minor, 0);
  }, [currentMonthInvoices]);

  const mtdBilled = useMemo(() => {
    return currentMonthInvoices.reduce((sum, i) => sum + i.total_minor, 0);
  }, [currentMonthInvoices]);

  const totalOutstanding = useMemo(() => {
    return invoicesList
      .filter((i) => i.status === "due" || i.status === "overdue")
      .reduce((sum, i) => sum + i.total_minor, 0);
  }, [invoicesList]);

  const overdueInvoices = useMemo(() => {
    return invoicesList.filter((i) => i.status === "overdue");
  }, [invoicesList]);

  // 6-Month Revenue Trend
  const revenueTrendData = useMemo(() => {
    const trend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("en-US", { month: "short" });

      const monthInvs = invoicesList.filter((inv) => (inv.period || inv.due_date?.slice(0, 7)) === key);
      const billed = monthInvs.reduce((acc, inv) => acc + inv.total_minor, 0);
      const paid = monthInvs.filter((inv) => inv.status === "paid").reduce((acc, inv) => acc + inv.total_minor, 0);

      trend.push({
        name: label,
        Billed: Math.round(billed / 100),
        Collected: Math.round(paid / 100),
      });
    }
    return trend;
  }, [invoicesList]);

  // Classroom occupancy breakdown
  const roomStats = useMemo(() => {
    return classroomsList.map((room) => {
      const roomKids = kidsList.filter(
        (c) => c.classroom?.name === room.name || c.classroom_id === room.id
      );
      const roomCheckedIn = roomKids.filter((c) => c.present_status === "checked_in").length;
      const roomAbsent = roomKids.filter((c) => c.present_status === "absent").length;
      const capacity = room.capacity || 20;
      const utilRate = capacity > 0 ? Math.round((roomKids.length / capacity) * 100) : 0;

      return {
        id: room.id,
        name: room.name,
        ageGroup: room.age_group || "Preschool",
        enrolled: roomKids.length,
        capacity,
        checkedIn: roomCheckedIn,
        absent: roomAbsent,
        utilRate,
      };
    });
  }, [classroomsList, kidsList]);

  // Time of day greeting
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const formattedToday = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6 pb-8">
      {/* Executive Welcome & Action Ribbon */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">Nursery Operations</span>
            <span className="h-1 w-1 rounded-full bg-slate-400" />
            <span className="text-xs font-semibold text-slate-500">{formattedToday}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-1">
            {greeting}, {user?.name?.split(" ")[0] ?? "Director"}! 👋
          </h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            {checkedIn} of {totalChildren} children currently checked in · All systems operational
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            as={Link}
            to="/classrooms"
            size="sm"
            color="primary"
            variant="solid"
            startContent={<ClipboardCheck size={14} />}
            className="font-bold text-xs shadow-sm shadow-primary/25"
          >
            Attendance
          </Button>

          <Button
            as={Link}
            to="/families/new"
            size="sm"
            variant="flat"
            startContent={<UserPlus size={14} />}
            className="font-bold text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
          >
            Enrol Child
          </Button>

          <Button
            as={Link}
            to="/invoices"
            size="sm"
            variant="flat"
            startContent={<CreditCard size={14} />}
            className="font-bold text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
          >
            New Invoice
          </Button>

          <Button
            as={Link}
            to="/events"
            size="sm"
            variant="flat"
            startContent={<Calendar size={14} />}
            className="font-bold text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
          >
            Schedule
          </Button>
        </div>
      </div>

      {/* 5-Card Operational & Financial Executive KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Attendance Today */}
        <Card shadow="sm" className="border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl">
          <CardBody className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Today's Presence
              </span>
              <div className="h-7 w-7 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 size={15} />
              </div>
            </div>
            <div className="mt-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-black text-slate-900 dark:text-slate-100">
                  {attendanceRate}%
                </span>
                <span className="text-xs font-bold text-slate-500">
                  {checkedIn}/{totalChildren}
                </span>
              </div>
              <Progress
                value={attendanceRate}
                color={attendanceRate > 80 ? "success" : "warning"}
                size="sm"
                className="mt-2"
              />
              <div className="mt-1 flex items-center justify-between text-[10px] font-semibold text-slate-400">
                <span className="text-rose-500">{absent} absent</span>
                <span>{checkedOut} checked out</span>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Month-to-Date Revenue */}
        <Card shadow="sm" className="border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl">
          <CardBody className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                MTD Collections ({currency})
              </span>
              <div className="h-7 w-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <TrendingUp size={15} />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-xl font-black text-slate-900 dark:text-slate-100 block truncate">
                {formatMoneyCompact(mtdCollected)}
              </span>
              <div className="mt-1 flex items-center gap-1.5">
                <Chip size="sm" variant="flat" color="primary" className="h-4 text-[9px] font-extrabold px-1">
                  {mtdBilled > 0 ? `${Math.round((mtdCollected / mtdBilled) * 100)}%` : "100%"} of billed
                </Chip>
                <span className="text-[10px] text-slate-400 font-medium">this month</span>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Outstanding Receivables */}
        <Card shadow="sm" className="border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl">
          <CardBody className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Unpaid Invoices
              </span>
              <div className="h-7 w-7 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Wallet size={15} />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-xl font-black text-slate-900 dark:text-slate-100 block truncate">
                {formatMoneyCompact(totalOutstanding)}
              </span>
              <div className="mt-1 flex items-center gap-1.5">
                {overdueInvoices.length > 0 ? (
                  <Chip size="sm" variant="flat" color="danger" className="h-4 text-[9px] font-extrabold px-1">
                    {overdueInvoices.length} overdue
                  </Chip>
                ) : (
                  <span className="text-[10px] text-emerald-600 font-bold">All current</span>
                )}
                <Link to="/invoices" className="text-[10px] text-primary hover:underline font-bold ml-auto">
                  View →
                </Link>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Active Classrooms */}
        <Card shadow="sm" className="border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl">
          <CardBody className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Active Classrooms
              </span>
              <div className="h-7 w-7 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center">
                <School size={15} />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-xl font-black text-slate-900 dark:text-slate-100">
                {classroomsList.length} rooms
              </span>
              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                <span>{totalChildren} enrolled kids</span>
                <Link to="/classrooms" className="text-primary hover:underline font-bold">
                  Manage →
                </Link>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Subscription Seats */}
        <Card shadow="sm" className="border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl">
          <CardBody className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Plan Seats
              </span>
              <div className="h-7 w-7 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <ShieldCheck size={15} />
              </div>
            </div>
            <div className="mt-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-black text-slate-900 dark:text-slate-100">
                  {seats?.students_used ?? totalChildren}
                  <span className="text-xs text-slate-400 font-bold">
                    /{seats?.students_max ?? "—"}
                  </span>
                </span>
                <span className="text-[10px] font-extrabold text-purple-600 uppercase">
                  {seats?.plan_name ?? "Standard"}
                </span>
              </div>
              <Progress
                value={
                  seats?.students_max
                    ? Math.min(Math.round(((seats.students_used || totalChildren) / seats.students_max) * 100), 100)
                    : 50
                }
                color="secondary"
                size="sm"
                className="mt-2"
              />
              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                <span>{seats?.students_remaining ?? 0} seats left</span>
                <Link to="/billing" className="text-primary hover:underline font-bold">
                  Billing →
                </Link>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Main 2-Column Responsive Operational Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Classroom Live Hub & Financial Trend */}
        <div className="lg:col-span-2 space-y-6">
          {/* Classrooms Live Status Hub */}
          <Card shadow="sm" className="border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl">
            <CardHeader className="flex justify-between items-center px-6 pt-5 pb-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  Classroom Live Operations
                </h3>
                <p className="text-xs font-medium text-slate-400 mt-0.5">
                  Real-time occupancy and attendance status across rooms
                </p>
              </div>
              <Button
                as={Link}
                to="/classrooms"
                size="sm"
                variant="flat"
                className="font-bold text-xs"
              >
                All Classrooms →
              </Button>
            </CardHeader>

            <CardBody className="px-6 pb-6 pt-3">
              {roomStats.length === 0 ? (
                <div className="py-8 text-center text-xs font-semibold text-slate-400">
                  No classrooms configured yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {roomStats.map((room) => (
                    <Link
                      key={room.id}
                      to={`/classrooms/${room.id}`}
                      className="group p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 hover:border-primary/40 transition-all flex flex-col justify-between"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors">
                            {room.name}
                          </h4>
                          <span className="text-[10px] font-semibold text-slate-400">
                            {room.ageGroup}
                          </span>
                        </div>
                        <Chip
                          size="sm"
                          variant="flat"
                          color={room.checkedIn > 0 ? "success" : "default"}
                          className="h-5 text-[10px] font-black"
                        >
                          {room.checkedIn} Present
                        </Chip>
                      </div>

                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs font-bold mb-1">
                          <span className="text-slate-600 dark:text-slate-300">
                            Capacity: {room.enrolled}/{room.capacity}
                          </span>
                          <span className="text-slate-400 text-[10px]">
                            {room.utilRate}% Full
                          </span>
                        </div>
                        <Progress
                          value={Math.min(room.utilRate, 100)}
                          color={room.utilRate >= 100 ? "danger" : room.utilRate > 80 ? "warning" : "primary"}
                          size="sm"
                        />
                      </div>

                      <div className="mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between text-[11px] font-semibold">
                        <span className="text-rose-500 font-bold">
                          {room.absent} absent
                        </span>
                        <span className="text-primary font-bold group-hover:translate-x-1 transition-transform flex items-center gap-0.5">
                          Open Room →
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Monthly Revenue & Billing Trend Chart */}
          <Card shadow="sm" className="border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl">
            <CardHeader className="flex justify-between items-center px-6 pt-5 pb-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  Billing & Collections Trend ({currency})
                </h3>
                <p className="text-xs font-medium text-slate-400 mt-0.5">
                  Monthly cash flow over the last 6 months
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-bold">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-slate-500 text-[11px]">Billed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-slate-500 text-[11px]">Collected</span>
                </div>
              </div>
            </CardHeader>

            <CardBody className="px-6 pb-6 pt-2">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueTrendData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dashBilled" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="dashCollected" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v.toLocaleString()} ${currency}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#fff",
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0",
                        fontSize: "12px",
                        fontWeight: "bold",
                      }}
                      formatter={(val: any) => [`${Number(val).toLocaleString()} ${currency}`, ""]}
                    />
                    <Area
                      type="monotone"
                      dataKey="Billed"
                      stroke="#0ea5e9"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#dashBilled)"
                    />
                    <Area
                      type="monotone"
                      dataKey="Collected"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#dashCollected)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right 1 Col: Urgent Tasks, Events & Recent Activity */}
        <div className="space-y-6">
          {/* Actionable Reminders / Checklist */}
          <Card shadow="sm" className="border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl flex flex-col justify-between">
            <CardHeader className="flex justify-between items-center px-6 pt-5 pb-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  Tasks & Daily Alerts
                </h3>
                <p className="text-xs font-medium text-slate-400 mt-0.5">Nursery action checklist</p>
              </div>
              <Link to="/reminders" className="text-xs font-bold text-primary hover:underline">
                View all →
              </Link>
            </CardHeader>

            <CardBody className="px-6 py-2">
              <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {(remindersQuery.data ?? []).slice(0, 4).map((task) => (
                  <li
                    key={task.id}
                    className="flex items-start justify-between gap-2.5 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/70 transition-colors group"
                  >
                    <button
                      onClick={() => deleteReminder.mutate(task.id)}
                      className="text-slate-400 hover:text-primary shrink-0 mt-0.5"
                      title="Mark as completed"
                    >
                      <Square size={15} className="group-hover:hidden" />
                      <CheckSquare size={15} className="hidden group-hover:block text-primary" />
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {task.title}
                      </p>
                      {task.date && (
                        <span className="text-[10px] font-semibold text-amber-600 block mt-0.5">
                          Due: {task.date.slice(0, 10)}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => deleteReminder.mutate(task.id)}
                      className="text-slate-300 hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
                {(remindersQuery.data ?? []).length === 0 && (
                  <li className="py-6 text-center text-xs font-bold text-slate-400">
                    All caught up! No pending alerts.
                  </li>
                )}
              </ul>

              {/* Quick Add Inline */}
              <form onSubmit={handleAddTask} className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Input
                  size="sm"
                  variant="bordered"
                  radius="lg"
                  placeholder="Add quick reminder..."
                  value={newTaskTitle}
                  onValueChange={setNewTaskTitle}
                  classNames={{
                    inputWrapper: "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-8",
                  }}
                />
                <Button
                  isIconOnly
                  type="submit"
                  size="sm"
                  color="primary"
                  radius="lg"
                  isDisabled={!newTaskTitle.trim() || addReminder.isPending}
                  className="h-8 w-8 min-w-8 shrink-0"
                >
                  <Plus size={14} />
                </Button>
              </form>
            </CardBody>
          </Card>

          {/* Upcoming Events Agenda */}
          <Card shadow="sm" className="border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl">
            <CardHeader className="flex justify-between items-center px-6 pt-5 pb-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  Upcoming Agenda
                </h3>
                <p className="text-xs font-medium text-slate-400 mt-0.5">Events & calendar milestones</p>
              </div>
              <Link to="/events" className="text-xs font-bold text-primary hover:underline">
                Calendar →
              </Link>
            </CardHeader>

            <CardBody className="px-6 pb-5 pt-2">
              {(eventsQuery.data ?? []).length === 0 ? (
                <div className="py-6 text-center text-xs font-medium text-slate-400">
                  No upcoming events scheduled.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {(eventsQuery.data ?? []).slice(0, 3).map((ev) => {
                    const d = new Date(ev.starts_at);
                    const monthStr = d.toLocaleDateString("en-US", { month: "short" });
                    const dayStr = d.getDate();
                    return (
                      <div
                        key={ev.id}
                        className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40"
                      >
                        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex flex-col items-center justify-center shrink-0">
                          <span className="text-[9px] font-black uppercase leading-none">{monthStr}</span>
                          <span className="text-sm font-black leading-none mt-0.5">{dayStr}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h5 className="font-extrabold text-xs text-slate-900 dark:text-slate-100 truncate">
                            {ev.title}
                          </h5>
                          <p className="text-[10px] font-semibold text-slate-400 truncate mt-0.5">
                            {ev.location || "Nursery Main Hall"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Recent Live Operations Feed */}
          <Card shadow="sm" className="border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl">
            <CardHeader className="flex justify-between items-center px-6 pt-5 pb-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  Live Activity Feed
                </h3>
                <p className="text-xs font-medium text-slate-400 mt-0.5">Recent system actions</p>
              </div>
              <Link to="/settings" className="text-xs font-bold text-primary hover:underline">
                Audit logs →
              </Link>
            </CardHeader>

            <CardBody className="px-6 pb-5 pt-2">
              <div className="space-y-2">
                {(auditQuery.data ?? []).slice(0, 4).map((log) => {
                  const dateStr = new Date(log.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <div
                      key={log.id}
                      className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {log.action}
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                          {log.entity} #{log.entity_id}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400 shrink-0 ml-2">
                        {dateStr}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
