import { useQuery } from "@tanstack/react-query";
import {
  Baby,
  Calendar,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Printer,
  School,
  TrendingUp,
  Wallet,
  AlertTriangle,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Progress,
  Tab,
  Tabs,
} from "@heroui/react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "../../components/PageHeader";
import { useCurrency } from "../../hooks/useCurrency";
import { api } from "../../lib/api";
import { INVOICE_STATUS_TINT, tint } from "../../lib/tints";
import type { Child, Classroom, Invoice, ListResponse } from "../../types/api";

const INVOICE_COLORS: Record<string, string> = {
  paid: "#10b981",     // Emerald
  due: "#f59e0b",      // Amber
  overdue: "#f43f5e",  // Rose
  cancelled: "#94a3b8",// Slate
};

/** Turns rows into a UTF-8 compatible CSV download */
function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csvContent = "\uFEFF" + rows
    .map((r) => r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function AnalyticsPage() {
  const { currency, formatMoney, formatMoneyCompact } = useCurrency();

  const [activeTab, setActiveTab] = useState<string>("overview");
  const [selectedRoom, setSelectedRoom] = useState<string>("");
  const [timeRange, setTimeRange] = useState<"all" | "month" | "30d" | "quarter" | "year">("all");

  // Fetch children
  const childrenQuery = useQuery({
    queryKey: ["analytics-children"],
    queryFn: async () =>
      (await api.get<ListResponse<Child>>("/children", { params: { per_page: 500 } })).data.data,
  });

  // Fetch invoices
  const invoicesQuery = useQuery({
    queryKey: ["analytics-invoices"],
    queryFn: async () =>
      (await api.get<ListResponse<Invoice>>("/invoices", { params: { per_page: 500 } })).data.data,
  });

  // Fetch classrooms for capacity analytics
  const classroomsQuery = useQuery({
    queryKey: ["analytics-classrooms"],
    queryFn: async () =>
      (await api.get<ListResponse<Classroom>>("/classrooms", { params: { per_page: 100 } })).data.data,
  });

  const allChildren = childrenQuery.data ?? [];
  const allInvoices = invoicesQuery.data ?? [];
  const allClassrooms = classroomsQuery.data ?? [];

  // Filtered children by classroom
  const filteredChildren = useMemo(() => {
    if (!selectedRoom) return allChildren;
    return allChildren.filter(
      (c) => c.classroom?.name === selectedRoom || String(c.classroom_id) === selectedRoom
    );
  }, [allChildren, selectedRoom]);

  // Unique classroom list
  const roomOptions = useMemo(() => {
    const list = allClassrooms.map((c) => c.name);
    allChildren.forEach((c) => {
      if (c.classroom?.name && !list.includes(c.classroom.name)) {
        list.push(c.classroom.name);
      }
    });
    return list.sort();
  }, [allClassrooms, allChildren]);

  // Invoices filtered by timeRange & classroom
  const filteredInvoices = useMemo(() => {
    const now = new Date();
    const childIdsInRoom = new Set(filteredChildren.map((c) => c.id));

    return allInvoices.filter((inv) => {
      if (selectedRoom && !childIdsInRoom.has(inv.child_id)) {
        return false;
      }
      if (timeRange === "all") return true;

      const dateStr = inv.due_date || (inv as any).created_at;
      if (!dateStr) return true;
      const invDate = new Date(dateStr);

      if (timeRange === "month") {
        return (
          invDate.getFullYear() === now.getFullYear() &&
          invDate.getMonth() === now.getMonth()
        );
      }
      if (timeRange === "30d") {
        const diffDays = (now.getTime() - invDate.getTime()) / (1000 * 3600 * 24);
        return diffDays >= -1 && diffDays <= 30;
      }
      if (timeRange === "quarter") {
        const qNow = Math.floor(now.getMonth() / 3);
        const qInv = Math.floor(invDate.getMonth() / 3);
        return invDate.getFullYear() === now.getFullYear() && qNow === qInv;
      }
      if (timeRange === "year") {
        return invDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [allInvoices, filteredChildren, selectedRoom, timeRange]);

  // Revenue & Financial Metrics
  const revenue = useMemo(() => {
    let collected = 0;
    let outstanding = 0;
    let overdue = 0;
    let overdueCount = 0;
    let totalBilled = 0;

    const statusCounts: Record<string, { count: number; totalMinor: number }> = {
      paid: { count: 0, totalMinor: 0 },
      due: { count: 0, totalMinor: 0 },
      overdue: { count: 0, totalMinor: 0 },
      cancelled: { count: 0, totalMinor: 0 },
    };

    filteredInvoices.forEach((inv) => {
      totalBilled += inv.total_minor;
      if (statusCounts[inv.status]) {
        statusCounts[inv.status].count += 1;
        statusCounts[inv.status].totalMinor += inv.total_minor;
      }
      if (inv.status === "paid") {
        collected += inv.total_minor;
      } else if (inv.status === "due" || inv.status === "overdue") {
        outstanding += inv.total_minor;
        if (inv.status === "overdue") {
          overdue += inv.total_minor;
          overdueCount += 1;
        }
      }
    });

    const byStatus = Object.entries(statusCounts)
      .map(([name, stat]) => ({
        name,
        value: stat.count,
        totalMinor: stat.totalMinor,
      }))
      .filter((s) => s.value > 0);

    const collectionRate = totalBilled > 0 ? Math.round((collected / totalBilled) * 100) : 100;
    const arpu = filteredChildren.length > 0 ? Math.round(totalBilled / filteredChildren.length) : 0;

    return {
      collected,
      outstanding,
      overdue,
      overdueCount,
      totalBilled,
      collectionRate,
      arpu,
      byStatus,
    };
  }, [filteredInvoices, filteredChildren.length]);

  // Attendance & Presence Metrics
  const presence = useMemo(() => {
    const checkedIn = filteredChildren.filter((c) => c.present_status === "checked_in").length;
    const checkedOut = filteredChildren.filter((c) => c.present_status === "checked_out").length;
    const absent = filteredChildren.filter((c) => c.present_status === "absent").length;
    const total = filteredChildren.length;
    const attendanceRate = total > 0 ? Math.round((checkedIn / total) * 100) : 0;

    return {
      checkedIn,
      checkedOut,
      absent,
      total,
      attendanceRate,
      chartData: [
        { name: "Checked In", value: checkedIn, color: "#10b981" },
        { name: "Checked Out", value: checkedOut, color: "#64748b" },
        { name: "Absent", value: absent, color: "#f43f5e" },
      ],
    };
  }, [filteredChildren]);

  // Monthly Revenue & Billing Trend (Last 6 Months)
  const monthlyRevenueTrend = useMemo(() => {
    const months: { key: string; label: string; Billed: number; Collected: number }[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("en-US", { month: "short" });
      months.push({ key, label, Billed: 0, Collected: 0 });
    }

    filteredInvoices.forEach((inv) => {
      const p = inv.period || inv.due_date?.slice(0, 7);
      if (!p) return;
      const bucket = months.find((m) => m.key === p);
      if (bucket) {
        bucket.Billed += Math.round(inv.total_minor / 100);
        if (inv.status === "paid") {
          bucket.Collected += Math.round(inv.total_minor / 100);
        }
      }
    });

    return months;
  }, [filteredInvoices]);

  // Classroom Capacity & Headcount
  const classroomOccupancy = useMemo(() => {
    const map: Record<
      string,
      { name: string; enrolled: number; capacity: number; checkedIn: number; absent: number; ageGroup: string }
    > = {};

    allClassrooms.forEach((r) => {
      map[r.name] = {
        name: r.name,
        enrolled: 0,
        capacity: r.capacity || 20,
        checkedIn: 0,
        absent: 0,
        ageGroup: r.age_group || "All ages",
      };
    });

    filteredChildren.forEach((c) => {
      const roomName = c.classroom?.name ?? "Unassigned";
      if (!map[roomName]) {
        map[roomName] = {
          name: roomName,
          enrolled: 0,
          capacity: 20,
          checkedIn: 0,
          absent: 0,
          ageGroup: "Unassigned",
        };
      }
      map[roomName].enrolled += 1;
      if (c.present_status === "checked_in") map[roomName].checkedIn += 1;
      if (c.present_status === "absent") map[roomName].absent += 1;
    });

    return Object.values(map);
  }, [allClassrooms, filteredChildren]);

  // Age Demographics Breakdown
  const ageDemographics = useMemo(() => {
    const now = new Date();
    let infants = 0;   // < 1 year
    let toddlers = 0;  // 1-2 years
    let preschool = 0; // 3-5 years
    let schoolAge = 0; // > 5 years

    filteredChildren.forEach((c) => {
      if (!c.dob) return;
      const bday = new Date(c.dob);
      const ageYears = (now.getTime() - bday.getTime()) / (365.25 * 24 * 3600 * 1000);
      if (ageYears < 1.0) infants++;
      else if (ageYears < 3.0) toddlers++;
      else if (ageYears <= 6.0) preschool++;
      else schoolAge++;
    });

    return [
      { name: "Infants (<1y)", count: infants, color: "#38bdf8" },
      { name: "Toddlers (1-2y)", count: toddlers, color: "#818cf8" },
      { name: "Preschool (3-5y)", count: preschool, color: "#34d399" },
      { name: "School-age (6+y)", count: schoolAge, color: "#f472b6" },
    ].filter((g) => g.count > 0);
  }, [filteredChildren]);

  // Top Outstanding / Actionable Invoices
  const urgentInvoices = useMemo(() => {
    return filteredInvoices
      .filter((i) => i.status === "overdue" || (i.status === "due" && i.due_date < new Date().toISOString().slice(0, 10)))
      .sort((a, b) => (a.due_date > b.due_date ? 1 : -1))
      .slice(0, 8);
  }, [filteredInvoices]);

  // CSV Export Handlers
  const handleExportChildren = () => {
    const rows = [
      ["ID", "First Name", "Last Name", "DOB", "Gender", "Classroom", "Presence Status", "Enrolled Date"],
      ...filteredChildren.map((c) => [
        c.id,
        c.first_name,
        c.last_name,
        c.dob?.slice(0, 10) ?? "",
        c.gender ?? "",
        c.classroom?.name ?? "Unassigned",
        c.present_status,
        c.created_at ? c.created_at.slice(0, 10) : "",
      ]),
    ];
    downloadCSV(`nursery_children_${selectedRoom || "all"}_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const handleExportInvoices = () => {
    const rows = [
      ["Invoice #", "Period", "Due Date", "Amount", "Currency", "Status", "Child ID", "Child Name"],
      ...filteredInvoices.map((i) => [
        i.invoice_no,
        i.period ?? "",
        i.due_date,
        (i.total_minor / 100).toFixed(2),
        i.currency || currency,
        i.status,
        i.child_id,
        i.child ? `${i.child.first_name} ${i.child.last_name}` : "",
      ]),
    ];
    downloadCSV(`nursery_invoices_${timeRange}_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:space-y-4 print:p-0">
      {/* Header & Global Filters */}
      <PageHeader
        title="Reports & Analytics"
        subtitle={`Executive insights and financial statements in ${currency}.`}
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {/* Classroom Select */}
            <div className="relative">
              <select
                aria-label="Filter by classroom"
                className="h-9 px-3 pr-8 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
              >
                <option value="">All Classrooms</option>
                {roomOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <School size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Time Range Filter */}
            <div className="relative">
              <select
                aria-label="Filter by time range"
                className="h-9 px-3 pr-8 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
              >
                <option value="all">All Time</option>
                <option value="month">This Month</option>
                <option value="30d">Last 30 Days</option>
                <option value="quarter">This Quarter</option>
                <option value="year">This Year</option>
              </select>
              <Calendar size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Export Dropdown / Action Buttons */}
            <Button
              size="sm"
              variant="flat"
              startContent={<Download size={14} />}
              onPress={handleExportInvoices}
              className="font-bold text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
            >
              Export Invoices
            </Button>

            <Button
              size="sm"
              variant="flat"
              startContent={<FileSpreadsheet size={14} />}
              onPress={handleExportChildren}
              className="font-bold text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
            >
              Export Students
            </Button>

            <Button
              size="sm"
              variant="light"
              isIconOnly
              title="Print report"
              onPress={handlePrint}
              className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
            >
              <Printer size={16} />
            </Button>
          </div>
        }
      />

      {/* Top 5 Executive KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Revenue Collected */}
        <Card shadow="sm" className="border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 rounded-2xl">
          <CardBody className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                Collected Revenue
              </span>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <TrendingUp size={16} />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-xl font-black text-slate-900 dark:text-slate-100 block truncate">
                {formatMoneyCompact(revenue.collected)}
              </span>
              <div className="mt-1 flex items-center gap-1.5">
                <Chip size="sm" variant="flat" color="success" className="h-4 text-[9px] font-extrabold px-1">
                  {revenue.collectionRate}% collected
                </Chip>
                <span className="text-[10px] text-slate-400 font-medium">efficiency</span>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Outstanding Receivables */}
        <Card shadow="sm" className="border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 rounded-2xl">
          <CardBody className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                Outstanding Balance
              </span>
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Wallet size={16} />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-xl font-black text-slate-900 dark:text-slate-100 block truncate">
                {formatMoneyCompact(revenue.outstanding)}
              </span>
              <div className="mt-1 flex items-center gap-1.5">
                {revenue.overdue > 0 ? (
                  <Chip size="sm" variant="flat" color="danger" className="h-4 text-[9px] font-extrabold px-1">
                    {formatMoneyCompact(revenue.overdue)} overdue
                  </Chip>
                ) : (
                  <span className="text-[10px] text-emerald-600 font-bold">No overdue debt</span>
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Active Enrolment */}
        <Card shadow="sm" className="border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 rounded-2xl">
          <CardBody className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                Active Enrolment
              </span>
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Baby size={16} />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-xl font-black text-slate-900 dark:text-slate-100">
                {filteredChildren.length}
              </span>
              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                <span>{selectedRoom ? selectedRoom : "across all classes"}</span>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Today's Attendance Rate */}
        <Card shadow="sm" className="border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 rounded-2xl">
          <CardBody className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                Presence Today
              </span>
              <div className="h-8 w-8 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div className="mt-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-slate-900 dark:text-slate-100">
                  {presence.attendanceRate}%
                </span>
                <span className="text-xs font-bold text-emerald-600">
                  ({presence.checkedIn}/{presence.total})
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                <span className="text-rose-500 font-bold">{presence.absent} absent</span>
                <span>·</span>
                <span>{presence.checkedOut} checked out</span>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Average Revenue Per Child (ARPU) */}
        <Card shadow="sm" className="border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 rounded-2xl">
          <CardBody className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                Avg. Billed / Child
              </span>
              <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <Sparkles size={16} />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-xl font-black text-slate-900 dark:text-slate-100 block truncate">
                {formatMoneyCompact(revenue.arpu)}
              </span>
              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                <span>Per child in scope</span>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(k) => setActiveTab(k as string)}
        color="primary"
        variant="underlined"
        classNames={{
          tabList: "gap-6 w-full relative rounded-none p-0 border-b border-slate-200 dark:border-slate-800",
          cursor: "w-full bg-primary",
          tab: "max-w-fit px-0 h-10 font-bold text-sm",
        }}
      >
        <Tab key="overview" title="Executive Overview" />
        <Tab key="financial" title="Financial & Invoices" />
        <Tab key="enrolment" title="Classrooms & Capacity" />
      </Tabs>

      {/* TAB 1: EXECUTIVE OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue Trend Area Chart */}
            <Card shadow="sm" className="lg:col-span-2 border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 rounded-2xl">
              <CardHeader className="flex justify-between items-center px-6 pt-6 pb-2">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                    Revenue & Collections Trend
                  </h3>
                  <p className="text-xs font-medium text-slate-400 mt-0.5">
                    Monthly comparison of billed tuition vs collected payments in {currency}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                    <span className="text-slate-600 dark:text-slate-300">Billed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span className="text-slate-600 dark:text-slate-300">Collected</span>
                  </div>
                </div>
              </CardHeader>
              <CardBody className="px-6 pb-6 pt-2">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyRevenueTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorBilled" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
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
                          borderRadius: "14px",
                          border: "1px solid #e2e8f0",
                          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                          fontSize: "12px",
                          fontWeight: "bold",
                        }}
                        formatter={(val: any) => [`${Number(val).toLocaleString()} ${currency}`, ""]}
                      />
                      <Area
                        type="monotone"
                        dataKey="Billed"
                        stroke="#0ea5e9"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorBilled)"
                      />
                      <Area
                        type="monotone"
                        dataKey="Collected"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorCollected)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardBody>
            </Card>

            {/* Real-time Presence Donut */}
            <Card shadow="sm" className="border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 rounded-2xl flex flex-col justify-between">
              <CardHeader className="px-6 pt-6 pb-2">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                    Live Presence Snapshot
                  </h3>
                  <p className="text-xs font-medium text-slate-400 mt-0.5">Real-time attendance ratio today</p>
                </div>
              </CardHeader>
              <CardBody className="px-6 pb-4 pt-2">
                <div className="h-52 relative flex items-center justify-center">
                  <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center justify-center h-full">
                    <span className="text-3xl font-black text-slate-800 dark:text-slate-100">
                      {presence.attendanceRate}%
                    </span>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Attending
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={presence.chartData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {presence.chartData.map((d, index) => (
                          <Cell key={`cell-${index}`} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#fff",
                          borderRadius: "12px",
                          border: "1px solid #e2e8f0",
                          fontSize: "12px",
                          fontWeight: "bold",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
                  <div className="p-2 rounded-xl bg-emerald-500/10">
                    <span className="block text-base font-black text-emerald-700 dark:text-emerald-400">
                      {presence.checkedIn}
                    </span>
                    <span className="text-[9px] font-bold uppercase text-slate-500">Present</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
                    <span className="block text-base font-black text-slate-700 dark:text-slate-300">
                      {presence.checkedOut}
                    </span>
                    <span className="text-[9px] font-bold uppercase text-slate-500">Out</span>
                  </div>
                  <div className="p-2 rounded-xl bg-rose-500/10">
                    <span className="block text-base font-black text-rose-600 dark:text-rose-400">
                      {presence.absent}
                    </span>
                    <span className="text-[9px] font-bold uppercase text-slate-500">Absent</span>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Bottom Grid: Classroom Headcounts & Age Demographics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Classroom Utilization */}
            <Card shadow="sm" className="border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 rounded-2xl">
              <CardHeader className="px-6 pt-6 pb-2 flex justify-between items-center">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                    Classroom Headcount & Capacity
                  </h3>
                  <p className="text-xs font-medium text-slate-400 mt-0.5">Enrolled children vs max room capacity</p>
                </div>
              </CardHeader>
              <CardBody className="px-6 pb-6 pt-2">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={classroomOccupancy} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#fff",
                          borderRadius: "12px",
                          border: "1px solid #e2e8f0",
                          fontSize: "12px",
                          fontWeight: "bold",
                        }}
                      />
                      <Legend
                        verticalAlign="top"
                        align="right"
                        wrapperStyle={{ fontSize: "11px", fontWeight: "bold", paddingBottom: "10px" }}
                      />
                      <Bar dataKey="enrolled" name="Enrolled" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="capacity" name="Max Capacity" fill="#e2e8f0" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardBody>
            </Card>

            {/* Age Demographics */}
            <Card shadow="sm" className="border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 rounded-2xl">
              <CardHeader className="px-6 pt-6 pb-2">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                    Student Age Demographics
                  </h3>
                  <p className="text-xs font-medium text-slate-400 mt-0.5">Distribution calculated from dates of birth</p>
                </div>
              </CardHeader>
              <CardBody className="px-6 pb-6 pt-2">
                <div className="h-64 flex items-center justify-center">
                  {ageDemographics.length === 0 ? (
                    <p className="text-xs font-semibold text-slate-400">No date of birth data available</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={ageDemographics}
                          dataKey="count"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          innerRadius={45}
                          paddingAngle={4}
                        >
                          {ageDemographics.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#fff",
                            borderRadius: "12px",
                            border: "1px solid #e2e8f0",
                            fontSize: "12px",
                            fontWeight: "bold",
                          }}
                        />
                        <Legend
                          verticalAlign="bottom"
                          iconType="circle"
                          wrapperStyle={{ fontSize: "11px", fontWeight: "bold", color: "#64748b" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: FINANCIAL & INVOICES */}
      {activeTab === "financial" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Invoices Status Donut */}
            <Card shadow="sm" className="border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 rounded-2xl">
              <CardHeader className="px-6 pt-6 pb-2">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                    Invoices by Status
                  </h3>
                  <p className="text-xs font-medium text-slate-400 mt-0.5">Count and value breakdown in {currency}</p>
                </div>
              </CardHeader>
              <CardBody className="px-6 pb-6 pt-2">
                <div className="h-60 relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={revenue.byStatus}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                      >
                        {revenue.byStatus.map((d) => (
                          <Cell key={d.name} fill={INVOICE_COLORS[d.name] || "#94a3b8"} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#fff",
                          borderRadius: "12px",
                          border: "1px solid #e2e8f0",
                          fontSize: "12px",
                          fontWeight: "bold",
                        }}
                        formatter={(val: any, name: any, item: any) => [
                          `${val} invoices (${formatMoney(item.payload.totalMinor)})`,
                          name.toUpperCase(),
                        ]}
                      />
                      <Legend
                        verticalAlign="bottom"
                        iconType="circle"
                        wrapperStyle={{ fontSize: "11px", fontWeight: "bold", textTransform: "capitalize" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  {revenue.byStatus.map((s) => (
                    <div key={s.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: INVOICE_COLORS[s.name] || "#94a3b8" }}
                        />
                        <span className="font-extrabold uppercase text-slate-600 dark:text-slate-300">
                          {s.name} ({s.value})
                        </span>
                      </div>
                      <span className="font-black text-slate-900 dark:text-slate-100">
                        {formatMoney(s.totalMinor)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            {/* Overdue / Actionable Receivables List */}
            <Card shadow="sm" className="lg:col-span-2 border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 rounded-2xl flex flex-col justify-between">
              <CardHeader className="flex justify-between items-center px-6 pt-6 pb-2">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-rose-500" />
                    Priority Unpaid & Overdue Invoices ({urgentInvoices.length})
                  </h3>
                  <p className="text-xs font-medium text-slate-400 mt-0.5">
                    Action required to settle outstanding fee balances
                  </p>
                </div>
                <Button
                  as={Link}
                  to="/invoices"
                  size="sm"
                  variant="flat"
                  className="font-bold text-xs"
                >
                  All Invoices →
                </Button>
              </CardHeader>

              <CardBody className="px-6 pb-6 pt-2">
                {urgentInvoices.length === 0 ? (
                  <div className="py-12 text-center">
                    <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2 opacity-80" />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      All tuition invoices are current!
                    </p>
                    <p className="text-xs font-medium text-slate-400 mt-0.5">
                      No overdue balances pending follow-up.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          <th className="py-2.5 text-start">Invoice</th>
                          <th className="py-2.5 text-start">Child</th>
                          <th className="py-2.5 text-start">Due Date</th>
                          <th className="py-2.5 text-end">Amount</th>
                          <th className="py-2.5 text-center">Status</th>
                          <th className="py-2.5 text-end">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {urgentInvoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                              {inv.invoice_no}
                            </td>
                            <td className="py-2.5 font-bold text-slate-700 dark:text-slate-300">
                              {inv.child ? `${inv.child.first_name} ${inv.child.last_name}` : `#${inv.child_id}`}
                            </td>
                            <td className="py-2.5 text-rose-600 font-bold">
                              {inv.due_date}
                            </td>
                            <td className="py-2.5 text-end font-black text-slate-900 dark:text-slate-100">
                              {formatMoney(inv.total_minor, inv.currency)}
                            </td>
                            <td className="py-2.5 text-center">
                              <span className={`badge text-[9px] uppercase font-extrabold ${tint(INVOICE_STATUS_TINT, inv.status)}`}>
                                {inv.status}
                              </span>
                            </td>
                            <td className="py-2.5 text-end">
                              <Link
                                to={`/invoices/${inv.id}`}
                                className="text-primary hover:text-primary-700 font-bold text-xs inline-flex items-center gap-0.5"
                              >
                                View <ChevronRight size={12} />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 3: ENROLMENT & CAPACITY */}
      {activeTab === "enrolment" && (
        <div className="space-y-6">
          <Card shadow="sm" className="border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 rounded-2xl">
            <CardHeader className="px-6 pt-6 pb-2 flex justify-between items-center">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Classroom Operational Matrix
                </h3>
                <p className="text-xs font-medium text-slate-400 mt-0.5">
                  Real-time occupancy, capacity limits, and attendance breakdown per room
                </p>
              </div>
              <Button
                as={Link}
                to="/classrooms"
                size="sm"
                variant="flat"
                className="font-bold text-xs"
              >
                Manage Classrooms →
              </Button>
            </CardHeader>

            <CardBody className="px-6 pb-6 pt-2">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      <th className="py-3 text-start">Classroom</th>
                      <th className="py-3 text-start">Age Group</th>
                      <th className="py-3 text-center">Enrolled</th>
                      <th className="py-3 text-center">Capacity</th>
                      <th className="py-3 text-start w-48">Occupancy Rate</th>
                      <th className="py-3 text-center">Present Today</th>
                      <th className="py-3 text-center">Absent Today</th>
                      <th className="py-3 text-end">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {classroomOccupancy.map((room) => {
                      const utilRate = room.capacity > 0 ? Math.round((room.enrolled / room.capacity) * 100) : 0;
                      return (
                        <tr key={room.name} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="py-3 font-extrabold text-slate-900 dark:text-slate-100">
                            {room.name}
                          </td>
                          <td className="py-3 font-medium text-slate-500">
                            {room.ageGroup}
                          </td>
                          <td className="py-3 text-center font-bold text-slate-800 dark:text-slate-200">
                            {room.enrolled}
                          </td>
                          <td className="py-3 text-center font-medium text-slate-400">
                            {room.capacity}
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <Progress
                                value={Math.min(utilRate, 100)}
                                color={utilRate > 95 ? "danger" : utilRate > 80 ? "warning" : "primary"}
                                size="sm"
                                className="w-32"
                              />
                              <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300 w-8">
                                {utilRate}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 text-center font-bold text-emerald-600">
                            {room.checkedIn}
                          </td>
                          <td className="py-3 text-center font-bold text-rose-500">
                            {room.absent}
                          </td>
                          <td className="py-3 text-end">
                            <Chip
                              size="sm"
                              variant="flat"
                              color={utilRate >= 100 ? "danger" : utilRate >= 80 ? "warning" : "success"}
                              className="text-[9px] font-extrabold"
                            >
                              {utilRate >= 100 ? "FULL" : utilRate >= 80 ? "NEAR CAP" : "OPTIMAL"}
                            </Chip>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
