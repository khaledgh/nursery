import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Baby,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  HeartHandshake,
  LayoutDashboard,
  LogIn,
  Mail,
  Pause,
  Phone,
  Play,
  Receipt,
  RefreshCw,
  Search,
  Sliders,
  Briefcase,
  AlertCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FormField } from "../../components/FormField";
import { Modal } from "../../components/Modal";
import { api, errorMessage } from "../../lib/api";
import { SUBSCRIPTION_STATUS_TINT, tint } from "../../lib/tints";
import { useAuthStore } from "../../store/auth";
import { useCurrency } from "../../hooks/useCurrency";
import type {
  NurseryDetailsReport,
  Plan,
  ItemResponse,
} from "../../types/api";

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr?: string | null) {
  if (!dateStr) return "Never";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export function NurseryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nurseryId = Number(id);
  const qc = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const { user, setTokens } = useAuthStore();
  const { formatMoney } = useCurrency();

  const [activeTab, setActiveTab] = useState<
    "overview" | "children" | "parents" | "staff" | "invoices"
  >("overview");

  const [banner, setBanner] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [editingPlan, setEditingPlan] = useState(false);

  // Filters for tabs
  const [childSearch, setChildSearch] = useState("");
  const [childClassFilter, setChildClassFilter] = useState<string>("all");
  const [parentSearch, setParentSearch] = useState("");
  const [staffSearch, setStaffSearch] = useState("");
  const [staffRoleFilter, setStaffRoleFilter] = useState<string>("all");

  // Query Nursery Details
  const {
    data: details,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["superadmin-nursery-details", nurseryId],
    queryFn: async () => {
      const res = await api.get<ItemResponse<NurseryDetailsReport>>(
        `/superadmin/nurseries/${nurseryId}/details`
      );
      return res.data.data;
    },
    enabled: Boolean(accessToken && nurseryId),
  });

  // Query Plans (for modal)
  const { data: plans } = useQuery({
    queryKey: ["superadmin-plans"],
    queryFn: async () => {
      const res = await api.get<{ data: Plan[] }>("/superadmin/plans");
      return res.data.data;
    },
    enabled: Boolean(accessToken && editingPlan),
  });

  // Impersonate Mutation
  const impersonate = useMutation({
    mutationFn: async () =>
      (
        await api.post<{ data: { access_token: string; access_expires_at: string } }>(
          `/superadmin/nurseries/${nurseryId}/impersonate`
        )
      ).data.data,
    onSuccess: (tokens) => {
      if (!user) return;
      setTokens(
        {
          access_token: tokens.access_token,
          access_expires_at: tokens.access_expires_at,
          refresh_token: "",
          refresh_expires_at: tokens.access_expires_at,
        },
        user
      );
      window.location.href = "/";
    },
    onError: (e) => setBanner({ text: errorMessage(e), type: "error" }),
  });

  // Suspend/Activate Mutation
  const setStatus = useMutation({
    mutationFn: async (action: "suspend" | "activate") =>
      api.post(`/superadmin/nurseries/${nurseryId}/${action}`),
    onSuccess: (_, action) => {
      setBanner({
        text: `Nursery successfully ${action === "suspend" ? "frozen / suspended" : "activated"}.`,
        type: "success",
      });
      void qc.invalidateQueries({ queryKey: ["superadmin-nursery-details", nurseryId] });
      void qc.invalidateQueries({ queryKey: ["superadmin-nurseries"] });
    },
    onError: (e) => setBanner({ text: errorMessage(e), type: "error" }),
  });

  // Mark invoice paid mutation
  const markInvoicePaid = useMutation({
    mutationFn: async (invoiceId: number) =>
      api.post(`/superadmin/subscription-invoices/${invoiceId}/mark-paid`),
    onSuccess: () => {
      setBanner({ text: "Invoice marked as paid successfully.", type: "success" });
      void qc.invalidateQueries({ queryKey: ["superadmin-nursery-details", nurseryId] });
      void qc.invalidateQueries({ queryKey: ["platform-stats"] });
    },
    onError: (e) => setBanner({ text: errorMessage(e), type: "error" }),
  });

  // Filtered children list
  const filteredChildren = useMemo(() => {
    if (!details?.children) return [];
    return details.children.filter((ch) => {
      const q = childSearch.toLowerCase();
      const matchSearch =
        !q ||
        `${ch.first_name} ${ch.last_name}`.toLowerCase().includes(q) ||
        (ch.classroom_name && ch.classroom_name.toLowerCase().includes(q)) ||
        (ch.primary_guardian_name && ch.primary_guardian_name.toLowerCase().includes(q)) ||
        (ch.primary_guardian_phone && ch.primary_guardian_phone.includes(q));

      const matchClass =
        childClassFilter === "all" ||
        (childClassFilter === "unassigned" && !ch.classroom_id) ||
        ch.classroom_id?.toString() === childClassFilter;

      return matchSearch && matchClass;
    });
  }, [details?.children, childSearch, childClassFilter]);

  // Filtered parents list
  const filteredParents = useMemo(() => {
    if (!details?.parents) return [];
    return details.parents.filter((p) => {
      const q = parentSearch.toLowerCase();
      return (
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        p.children_names.some((c) => c.toLowerCase().includes(q))
      );
    });
  }, [details?.parents, parentSearch]);

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    if (!details?.staff) return [];
    return details.staff.filter((s) => {
      const q = staffSearch.toLowerCase();
      const matchSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.phone.includes(q) ||
        s.classrooms.some((c) => c.toLowerCase().includes(q));

      const matchRole = staffRoleFilter === "all" || s.role === staffRoleFilter;

      return matchSearch && matchRole;
    });
  }, [details?.staff, staffSearch, staffRoleFilter]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="relative">
          <RefreshCw size={36} className="animate-spin text-[#2CAFA8]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Building2 size={16} className="text-[#2CAFA8]/80" />
          </div>
        </div>
        <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
          Loading comprehensive nursery report…
        </p>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center card border-slate-200 dark:border-slate-800 mt-12">
        <AlertCircle size={40} className="mx-auto text-rose-500 mb-3" />
        <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">Nursery Not Found</h2>
        <p className="text-xs text-slate-500 mt-1 mb-6">
          The requested nursery id #{nurseryId} could not be located in the platform registry.
        </p>
        <Link to="/superadmin" className="btn btn-primary text-xs inline-flex items-center gap-2">
          <ArrowLeft size={14} />
          <span>Return to All Nurseries</span>
        </Link>
      </div>
    );
  }

  const n = details.nursery;
  const isSuspended = n.status === "suspended" || n.subscription_status === "suspended";
  const capacityPct =
    n.students_max > 0
      ? Math.min(100, Math.round((details.total_children / n.students_max) * 100))
      : 0;

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Back button & Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/superadmin"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#2CAFA8] transition-colors"
        >
          <ArrowLeft size={14} />
          <span>All Nurseries</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 hover:text-[#2CAFA8] hover:border-[#2CAFA8]/40 transition-colors"
            title="Refresh Nursery Data"
          >
            <RefreshCw size={13} className={isRefetching ? "animate-spin text-[#2CAFA8]" : ""} />
          </button>
        </div>
      </div>

      {/* Banner */}
      {banner && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-bold ${
            banner.type === "success"
              ? "bg-teal-50 border-teal-200 text-teal-800 dark:bg-teal-950/40 dark:border-teal-800 dark:text-teal-300"
              : "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{banner.text}</span>
          </div>
          <button
            onClick={() => setBanner(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            ×
          </button>
        </div>
      )}

      {/* Hero Card */}
      <div className="card p-5 sm:p-6 border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full bg-gradient-to-l from-[#2CAFA8]/10 via-[#2CAFA8]/5 to-transparent pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2CAFA8] to-[#1d7d78] text-white flex items-center justify-center font-black text-2xl shadow-sm shrink-0">
              {n.name.charAt(0).toUpperCase()}
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  {n.name}
                </h1>
                <span
                  className={`badge text-[10px] px-2.5 py-0.5 uppercase tracking-wider font-extrabold ${tint(
                    SUBSCRIPTION_STATUS_TINT,
                    n.subscription_status
                  )}`}
                >
                  {n.subscription_status || "Active"}
                </span>
                {isSuspended && (
                  <span className="badge text-[10px] px-2 py-0.5 bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 font-black">
                    SUSPENDED
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1 font-mono">
                  <span className="text-slate-400">slug:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">/{n.slug}</span>
                </div>
                {n.login_id_prefix && (
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400">prefix:</span>
                    <span className="font-bold font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded text-[10px] text-[#2CAFA8]">
                      {n.login_id_prefix.toUpperCase()}
                    </span>
                  </div>
                )}
                {n.admin_email && (
                  <div className="flex items-center gap-1">
                    <Mail size={12} className="text-slate-400" />
                    <span>{n.admin_email}</span>
                  </div>
                )}
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Calendar size={12} />
                  <span>Enrolled {formatDate(n.created_at)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2 sm:self-end lg:self-center">
            <button
              onClick={() => impersonate.mutate()}
              disabled={impersonate.isPending}
              className="btn bg-[#2CAFA8] hover:bg-[#259b95] text-white text-xs py-2 px-3.5 shadow-xs font-bold flex items-center gap-2"
              title="Sign in as Administrator of this nursery"
            >
              {impersonate.isPending ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <LogIn size={13} />
              )}
              <span>Enter Nursery Console</span>
            </button>

            <button
              onClick={() => setEditingPlan(true)}
              className="btn btn-secondary text-xs py-2 px-3 hover:border-[#2CAFA8] hover:text-[#2CAFA8] flex items-center gap-1.5 font-bold"
            >
              <Sliders size={13} />
              <span>Plan & Cap</span>
            </button>

            <button
              onClick={() => setStatus.mutate(isSuspended ? "activate" : "suspend")}
              disabled={setStatus.isPending}
              className={`btn text-xs py-2 px-3 font-bold border transition-colors flex items-center gap-1.5 ${
                isSuspended
                  ? "border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/40"
                  : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40"
              }`}
            >
              {isSuspended ? <Play size={13} /> : <Pause size={13} />}
              <span>{isSuspended ? "Reactivate" : "Freeze"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5 Compact KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* KPI 1: Registrants / Children */}
        <div className="card p-5 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Enrolled Children
            </span>
            <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-[#2CAFA8]">
              <Baby size={15} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {details.total_children}
            </span>
            <span className="text-xs font-semibold text-slate-400">/ {n.students_max || "∞"}</span>
          </div>
          <div className="mt-2.5 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
              <span>Seat Occupancy</span>
              <span className={capacityPct >= 90 ? "text-rose-500" : "text-[#2CAFA8]"}>
                {capacityPct}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  capacityPct >= 95
                    ? "bg-rose-500"
                    : capacityPct >= 80
                    ? "bg-amber-500"
                    : "bg-[#2CAFA8]"
                }`}
                style={{ width: `${Math.min(capacityPct, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* KPI 2: Average Age (Core User Request!) */}
        <div className="card p-5 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Average Child Age
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600">
              <Clock size={15} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {details.average_age_years > 0 ? `${details.average_age_years.toFixed(1)}` : "—"}
            </span>
            <span className="text-xs font-semibold text-slate-400">years old</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-2 text-[11px]">
            <span className="text-slate-400">In Months</span>
            <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
              {details.average_age_months > 0 ? `${Math.round(details.average_age_months)} mos` : "—"}
            </span>
          </div>
        </div>

        {/* KPI 3: Classrooms */}
        <div className="card p-5 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Classrooms
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
              <Building2 size={15} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {details.total_classrooms}
            </span>
            <span className="text-xs font-semibold text-slate-400">active rooms</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-2 text-[11px]">
            <span className="text-slate-400">Avg Kids / Room</span>
            <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
              {details.total_classrooms > 0
                ? (details.total_children / details.total_classrooms).toFixed(1)
                : 0}
            </span>
          </div>
        </div>

        {/* KPI 4: Staff & Educators */}
        <div className="card p-5 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Staff & Educators
            </span>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600">
              <Briefcase size={15} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {details.total_staff}
            </span>
            <span className="text-xs font-semibold text-slate-400">members</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-2 text-[11px]">
            <span className="text-slate-400">Child:Staff Ratio</span>
            <span className="font-extrabold text-amber-600 dark:text-amber-400">
              {details.total_staff > 0
                ? `${(details.total_children / details.total_staff).toFixed(1)}:1`
                : "—"}
            </span>
          </div>
        </div>

        {/* KPI 5: Parents & Guardians */}
        <div className="card p-5 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Parent Network
            </span>
            <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600">
              <HeartHandshake size={15} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {details.total_parents}
            </span>
            <span className="text-xs font-semibold text-slate-400">registered</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-2 text-[11px]">
            <span className="text-slate-400">Plan Tier</span>
            <span className="font-extrabold text-purple-600 dark:text-purple-400 truncate max-w-[90px]">
              {n.plan_name || n.plan_code || "Growth"}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-0 overflow-x-auto">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold border-b-2 transition-all whitespace-nowrap ${
            activeTab === "overview"
              ? "border-[#2CAFA8] text-[#2CAFA8]"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <LayoutDashboard size={14} />
          <span>Overview & Age Analytics</span>
        </button>

        <button
          onClick={() => setActiveTab("children")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold border-b-2 transition-all whitespace-nowrap ${
            activeTab === "children"
              ? "border-[#2CAFA8] text-[#2CAFA8]"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Baby size={14} />
          <span>Registrants & Children</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
            {details.children?.length ?? 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("parents")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold border-b-2 transition-all whitespace-nowrap ${
            activeTab === "parents"
              ? "border-[#2CAFA8] text-[#2CAFA8]"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <HeartHandshake size={14} />
          <span>Parents & Families</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
            {details.parents?.length ?? 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("staff")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold border-b-2 transition-all whitespace-nowrap ${
            activeTab === "staff"
              ? "border-[#2CAFA8] text-[#2CAFA8]"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Briefcase size={14} />
          <span>Staff & Employees</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
            {details.staff?.length ?? 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("invoices")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold border-b-2 transition-all whitespace-nowrap ${
            activeTab === "invoices"
              ? "border-[#2CAFA8] text-[#2CAFA8]"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Receipt size={14} />
          <span>Invoices & Billing</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
            {details.invoices?.length ?? 0}
          </span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & AGE ANALYTICS */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Section: Age Distribution & Analytics */}
          <div className="card p-5 sm:p-6 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Clock size={18} className="text-[#2CAFA8]" />
                  <span>Age Demographics & Distribution</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Detailed distribution across developmental age groups and infant-to-kindergarten
                  brackets.
                </p>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-xs font-bold text-slate-500">Overall Average:</span>
                <span className="text-sm font-black text-[#2CAFA8]">
                  {details.average_age_years.toFixed(1)} yrs ({Math.round(details.average_age_months)}{" "}
                  mos)
                </span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-5 gap-3.5">
              {details.age_distribution?.map((bucket, idx) => {
                const colors = [
                  {
                    bg: "bg-teal-50 dark:bg-teal-950/40",
                    border: "border-teal-200 dark:border-teal-800/60",
                    bar: "bg-[#2CAFA8]",
                    text: "text-[#2CAFA8]",
                  },
                  {
                    bg: "bg-blue-50 dark:bg-blue-950/40",
                    border: "border-blue-200 dark:border-blue-800/60",
                    bar: "bg-blue-500",
                    text: "text-blue-600 dark:text-blue-400",
                  },
                  {
                    bg: "bg-indigo-50 dark:bg-indigo-950/40",
                    border: "border-indigo-200 dark:border-indigo-800/60",
                    bar: "bg-indigo-500",
                    text: "text-indigo-600 dark:text-indigo-400",
                  },
                  {
                    bg: "bg-purple-50 dark:bg-purple-950/40",
                    border: "border-purple-200 dark:border-purple-800/60",
                    bar: "bg-purple-500",
                    text: "text-purple-600 dark:text-purple-400",
                  },
                  {
                    bg: "bg-amber-50 dark:bg-amber-950/40",
                    border: "border-amber-200 dark:border-amber-800/60",
                    bar: "bg-amber-500",
                    text: "text-amber-600 dark:text-amber-400",
                  },
                ][idx % 5];

                return (
                  <div
                    key={bucket.label}
                    className={`rounded-2xl border ${colors.border} ${colors.bg} p-4 transition-all flex flex-col justify-between`}
                  >
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        {bucket.label}
                      </span>
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
                          {bucket.count}
                        </span>
                        <span className={`text-xs font-black ${colors.text}`}>
                          {bucket.percentage.toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1.5">
                      <div className="h-2 w-full bg-slate-200/80 dark:bg-slate-700/80 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${colors.bar} transition-all duration-500`}
                          style={{ width: `${Math.max(bucket.percentage, 4)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 text-end font-semibold">
                        {bucket.count} of {details.total_children} kids
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: Classrooms Breakdown with Average Ages */}
          <div className="card p-5 sm:p-6 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Building2 size={18} className="text-[#2CAFA8]" />
                  <span>Classrooms & Room Specific Average Ages</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Detailed roster load, capacities, lead teachers, and average child age per room.
                </p>
              </div>
              <span className="badge text-xs px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                {details.classrooms?.length ?? 0} Rooms
              </span>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {details.classrooms?.map((room) => {
                const roomOccPct =
                  room.capacity > 0
                    ? Math.min(100, Math.round((room.children_count / room.capacity) * 100))
                    : 0;

                const roomAvgYears =
                  room.average_age_months > 0 ? (room.average_age_months / 12).toFixed(1) : "—";

                return (
                  <div
                    key={room.id}
                    className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4 space-y-3 hover:border-[#2CAFA8]/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-black text-slate-900 dark:text-slate-100 text-sm">
                          {room.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          {room.room_location && (
                            <span className="text-[10px] font-bold text-slate-500">
                              Loc: {room.room_location}
                            </span>
                          )}
                          {room.age_group && (
                            <span className="badge text-[9px] px-1.5 py-0.2 bg-teal-50 dark:bg-teal-950/60 text-[#2CAFA8] border-teal-200 dark:border-teal-800">
                              {room.age_group}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-end">
                        <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                          {room.children_count}/{room.capacity}
                        </span>
                        <p className="text-[9px] font-bold text-slate-400">students</p>
                      </div>
                    </div>

                    {/* Average Age Highlight */}
                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Clock size={13} className="text-[#2CAFA8]" />
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                          Classroom Avg Age:
                        </span>
                      </div>
                      <span className="text-xs font-black text-[#2CAFA8]">
                        {roomAvgYears !== "—"
                          ? `${roomAvgYears} yrs (${Math.round(room.average_age_months)}m)`
                          : "No students"}
                      </span>
                    </div>

                    {/* Capacity Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                        <span>Capacity Occupied</span>
                        <span
                          className={roomOccPct >= 90 ? "text-rose-600 font-bold" : "text-slate-600"}
                        >
                          {roomOccPct}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            roomOccPct >= 90
                              ? "bg-rose-500"
                              : roomOccPct >= 75
                              ? "bg-amber-500"
                              : "bg-[#2CAFA8]"
                          }`}
                          style={{ width: `${roomOccPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Metadata Footer */}
                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Lead: {room.lead_teacher_name || "Unassigned"}</span>
                      {room.opens_at && room.closes_at && (
                        <span>
                          {room.opens_at} - {room.closes_at}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: Subscription & Account Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Plan Info */}
            <div className="card p-5 sm:p-6 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <CreditCard size={16} className="text-[#2CAFA8]" />
                  <span>Platform Subscription & Plan</span>
                </h3>
                <button
                  onClick={() => setEditingPlan(true)}
                  className="text-xs font-bold text-[#2CAFA8] hover:underline"
                >
                  Modify
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Plan Tier</span>
                  <span className="font-black text-slate-800 dark:text-slate-200">
                    {n.plan_name || n.plan_code || "Growth Package"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Billing Cycle</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 capitalize">
                    {n.billing_period || "monthly"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Rate</span>
                  <span className="font-bold text-[#2CAFA8]">
                    {n.price_minor
                      ? `${formatMoney(n.price_minor, n.currency || "USD")}/${
                          n.billing_period === "yearly" ? "yr" : "mo"
                        }`
                      : "Custom"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Next Billing Date</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {formatDate(n.next_payment_date)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Write Access</span>
                  <span
                    className={`font-black ${
                      n.allows_writes ? "text-[#2CAFA8]" : "text-rose-600"
                    }`}
                  >
                    {n.allows_writes ? "Full Operational" : "Read-Only (Locked)"}
                  </span>
                </div>
              </div>
            </div>

            {/* Nursery Technical Details */}
            <div className="card p-5 sm:p-6 border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Building2 size={16} className="text-[#2CAFA8]" />
                <span>Facility Technical Configuration</span>
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Tenant Slug</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {n.slug}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Mobile Login Prefix</span>
                  <span className="font-mono font-bold text-[#2CAFA8]">
                    {n.login_id_prefix?.toUpperCase() || "—"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Timezone</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {n.timezone || "UTC"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Default Locale</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">
                    {n.locale || "en"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Administrator Contact</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {n.admin_name || "Admin"} ({n.admin_email || "No email"})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CHILDREN & REGISTRANTS */}
      {activeTab === "children" && (
        <div className="card border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search child, guardian, phone…"
                value={childSearch}
                onChange={(e) => setChildSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#2CAFA8]"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-slate-400 font-bold">Classroom:</span>
              <select
                value={childClassFilter}
                onChange={(e) => setChildClassFilter(e.target.value)}
                className="text-xs font-semibold py-1.5 px-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-200"
              >
                <option value="all">All Classrooms ({details.children?.length ?? 0})</option>
                {details.classrooms?.map((c) => (
                  <option key={c.id} value={c.id.toString()}>
                    {c.name}
                  </option>
                ))}
                <option value="unassigned">Unassigned</option>
              </select>
            </div>
          </div>

          {/* Children Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/75 dark:bg-slate-800/50 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Child Name</th>
                  <th className="py-3 px-3">Age & DOB</th>
                  <th className="py-3 px-3">Classroom</th>
                  <th className="py-3 px-3">Primary Guardian</th>
                  <th className="py-3 px-3">Guardian Phone</th>
                  <th className="py-3 px-3 text-center">Attendance</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredChildren.length > 0 ? (
                  filteredChildren.map((ch) => (
                    <tr
                      key={ch.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-teal-50 dark:bg-teal-950/60 text-[#2CAFA8] font-black text-xs flex items-center justify-center border border-teal-200/60 dark:border-teal-800/60">
                            {ch.first_name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-900 dark:text-slate-100">
                              {ch.first_name} {ch.last_name}
                            </p>
                            <span className="text-[10px] text-slate-400 capitalize">
                              {ch.gender || "Unspecified"}{" "}
                              {ch.blood_type ? `· ${ch.blood_type}` : ""}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <p className="font-black text-[#2CAFA8]">{ch.age_formatted}</p>
                        <p className="text-[10px] text-slate-400">{ch.dob}</p>
                      </td>

                      <td className="py-3 px-3">
                        {ch.classroom_name ? (
                          <span className="badge text-[10px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                            {ch.classroom_name}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                        )}
                      </td>

                      <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">
                        {ch.primary_guardian_name || "—"}
                        {ch.relationship && (
                          <span className="text-[10px] text-slate-400 block font-normal capitalize">
                            {ch.relationship}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        {ch.primary_guardian_phone ? (
                          <a
                            href={`tel:${ch.primary_guardian_phone}`}
                            className="font-mono text-slate-700 dark:text-slate-300 hover:text-[#2CAFA8] flex items-center gap-1 font-semibold"
                          >
                            <Phone size={11} className="text-[#2CAFA8]" />
                            <span>{ch.primary_guardian_phone}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span
                          className={`badge text-[9px] px-2 py-0.5 font-bold uppercase tracking-wider ${
                            ch.present_status === "present"
                              ? "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300"
                              : ch.present_status === "excused"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {ch.present_status || "absent"}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`badge text-[9px] px-2 py-0.5 font-bold capitalize ${
                            ch.status === "active"
                              ? "bg-teal-50 text-teal-700 border-teal-200"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {ch.status || "active"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No registered children match the search criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PARENTS & FAMILIES */}
      {activeTab === "parents" && (
        <div className="card border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search parent name, email, phone, child…"
                value={parentSearch}
                onChange={(e) => setParentSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#2CAFA8]"
              />
            </div>
            <span className="text-xs text-slate-400 font-semibold">
              Showing {filteredParents.length} parents
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/75 dark:bg-slate-800/50 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Parent Name</th>
                  <th className="py-3 px-3">Email Address</th>
                  <th className="py-3 px-3">Phone</th>
                  <th className="py-3 px-3">Children</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-end">Last Login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredParents.length > 0 ? (
                  filteredParents.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3 px-4 font-extrabold text-slate-900 dark:text-slate-100">
                        {p.name}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                        <a
                          href={`mailto:${p.email}`}
                          className="hover:text-[#2CAFA8] flex items-center gap-1.5"
                        >
                          <Mail size={12} className="text-slate-400" />
                          <span>{p.email}</span>
                        </a>
                      </td>
                      <td className="py-3 px-3 font-mono">
                        {p.phone ? (
                          <a
                            href={`tel:${p.phone}`}
                            className="hover:text-[#2CAFA8] flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300"
                          >
                            <Phone size={11} className="text-[#2CAFA8]" />
                            <span>{p.phone}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {p.children_names?.length > 0 ? (
                            p.children_names.map((kid, idx) => (
                              <span
                                key={idx}
                                className="badge text-[9px] px-2 py-0.5 bg-teal-50 dark:bg-teal-950/60 text-[#2CAFA8] border-teal-200 dark:border-teal-800 font-bold"
                              >
                                {kid}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 italic text-[10px]">None linked</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`badge text-[9px] px-2 py-0.5 font-bold capitalize ${
                            p.status === "active"
                              ? "bg-teal-50 text-teal-700 border-teal-200"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {p.status || "active"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-end text-slate-500 font-mono text-[11px]">
                        {formatDateTime(p.last_login_at)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No parents match the filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: STAFF & EMPLOYEES */}
      {activeTab === "staff" && (
        <div className="card border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search staff name, email, phone…"
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#2CAFA8]"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-slate-400 font-bold">Role:</span>
              <select
                value={staffRoleFilter}
                onChange={(e) => setStaffRoleFilter(e.target.value)}
                className="text-xs font-semibold py-1.5 px-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-200"
              >
                <option value="all">All Roles</option>
                <option value="admin">Administrators</option>
                <option value="teacher">Teachers & Educators</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/75 dark:bg-slate-800/50 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Contact</th>
                  <th className="py-3 px-3">Assigned Classrooms</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-end">Last Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredStaff.length > 0 ? (
                  filteredStaff.map((s) => (
                    <tr
                      key={s.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3 px-4 font-extrabold text-slate-900 dark:text-slate-100">
                        {s.name}
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`badge text-[10px] px-2 py-0.5 font-bold uppercase ${
                            s.role === "admin"
                              ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300"
                              : "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300"
                          }`}
                        >
                          {s.role}
                        </span>
                      </td>

                      <td className="py-3 px-3 space-y-0.5">
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                          <Mail size={11} className="text-slate-400" />
                          <span>{s.email}</span>
                        </div>
                        {s.phone && (
                          <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[11px]">
                            <Phone size={11} className="text-[#2CAFA8]" />
                            <span>{s.phone}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {s.classrooms?.length > 0 ? (
                            s.classrooms.map((cr, idx) => (
                              <span
                                key={idx}
                                className="badge text-[9px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                              >
                                {cr}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 italic text-[10px]">
                              {s.role === "admin" ? "All Facility" : "None assigned"}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span
                          className={`badge text-[9px] px-2 py-0.5 font-bold capitalize ${
                            s.status === "active"
                              ? "bg-teal-50 text-teal-700 border-teal-200"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {s.status || "active"}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-end text-slate-500 font-mono text-[11px]">
                        {formatDateTime(s.last_login_at)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No staff members match the filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: INVOICES & PLATFORM LEDGER */}
      {activeTab === "invoices" && (
        <div className="card border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Receipt size={16} className="text-[#2CAFA8]" />
                <span>Platform Subscription Invoices</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Invoices generated by the platform billing engine for this nursery.
              </p>
            </div>
            <span className="badge text-xs px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
              {details.invoices?.length ?? 0} Invoices
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/75 dark:bg-slate-800/50 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-3">Billing Period</th>
                  <th className="py-3 px-3">Due Date</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3">Paid Date</th>
                  <th className="py-3 px-4 text-end">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {details.invoices?.length > 0 ? (
                  details.invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {inv.invoice_no}
                      </td>

                      <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-300">
                        {inv.period}
                      </td>

                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                        {formatDate(inv.due_date)}
                      </td>

                      <td className="py-3 px-3 font-black text-slate-900 dark:text-slate-100">
                        {formatMoney(inv.amount_minor, inv.currency)}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span
                          className={`badge text-[9px] px-2 py-0.5 font-black uppercase ${
                            inv.status === "paid"
                              ? "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300"
                              : inv.status === "overdue"
                              ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                        {inv.paid_at ? formatDate(inv.paid_at) : "—"}
                      </td>

                      <td className="py-3 px-4 text-end">
                        {inv.status !== "paid" && (
                          <button
                            onClick={() => markInvoicePaid.mutate(inv.id)}
                            disabled={markInvoicePaid.isPending}
                            className="btn btn-secondary text-[11px] py-1 px-2.5 font-bold hover:border-[#2CAFA8] hover:text-[#2CAFA8]"
                          >
                            Mark Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No invoices recorded for this nursery yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Plan & Student Cap Modal */}
      {editingPlan && (
        <AssignPlanModal
          nursery={n}
          plans={plans ?? []}
          onClose={() => setEditingPlan(false)}
          onDone={() => {
            setEditingPlan(false);
            setBanner({ text: "Plan & capacity override updated successfully.", type: "success" });
            void qc.invalidateQueries({ queryKey: ["superadmin-nursery-details", nurseryId] });
            void qc.invalidateQueries({ queryKey: ["superadmin-nurseries"] });
          }}
        />
      )}
    </div>
  );
}

function AssignPlanModal({
  nursery,
  plans,
  onClose,
  onDone,
}: {
  nursery: any;
  plans: Plan[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [planCode, setPlanCode] = useState(nursery?.plan_code ?? "tier-50");
  const [maxStudents, setMaxStudents] = useState<number>(nursery?.students_max ?? 50);
  const [err, setErr] = useState("");

  const update = useMutation({
    mutationFn: async () => {
      await api.put(`/superadmin/nurseries/${nursery.id}/subscription`, {
        plan_code: planCode,
        students_max: maxStudents,
      });
    },
    onSuccess: () => {
      setErr("");
      onDone();
    },
    onError: (e) => setErr(errorMessage(e)),
  });

  return (
    <Modal open={Boolean(nursery)} onClose={onClose} title={`Subscription & Capacity: ${nursery.name}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate();
        }}
        className="space-y-4 text-xs"
      >
        {err && (
          <div className="p-3 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
            {err}
          </div>
        )}

        <FormField label="Select Capacity Package">
          <select
            value={planCode}
            onChange={(e) => {
              setPlanCode(e.target.value);
              const p = plans.find((x) => x.code === e.target.value);
              if (p) setMaxStudents(p.max_students);
            }}
            className="input text-xs"
          >
            {plans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} — {p.max_students} kids (${p.price_minor / 100}/
                {p.billing_period === "yearly" ? "yr" : "mo"})
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Enrolled Student Cap Override">
          <input
            type="number"
            min={1}
            value={maxStudents}
            onChange={(e) => setMaxStudents(parseInt(e.target.value, 10) || 0)}
            className="input text-xs"
          />
        </FormField>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary text-xs">
            Cancel
          </button>
          <button
            type="submit"
            disabled={update.isPending}
            className="btn bg-[#2CAFA8] hover:bg-[#259b95] text-white text-xs flex items-center gap-1.5"
          >
            {update.isPending && <RefreshCw size={13} className="animate-spin" />}
            <span>Save Subscription</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
