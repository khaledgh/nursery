import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  Baby,
  BookOpen,
  Check,
  CheckCheck,
  Clock,
  ExternalLink,
  FileText,
  HeartPulse,
  Moon,
  Plus,
  Search,
  Settings2,
  Sliders,
  Sparkles,
  Trophy,
  UserCheck,
  UserX,
  Utensils,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { z } from "zod";
import { PageHeader } from "../../components/PageHeader";
import { EmptyState, Tabs } from "../../components/Tabs";
import { DatePicker } from "../../components/DatePicker";
import { ImageUpload } from "../../components/ImageUpload";
import { FormField } from "../../components/FormField";
import { toISODate } from "../../components/WeekPicker";
import { QuickHubModal } from "../children/QuickHubModal";
import { WeeklyPlansPage } from "../plans/WeeklyPlansPage";
import { MenusPage } from "../menus/MenusPage";
import { CategoriesTab, TemplatesTab } from "../milestones/MilestonesPage";
import { api, errorMessage } from "../../lib/api";
import { PRESENCE_TINT, tint } from "../../lib/tints";
import {
  DIMENSIONS,
  MOODS,
  MOOD_OPTIONS,
  RATING_OPTIONS,
} from "../reports/reportConstants";
import type {
  AchievementTemplate,
  Child,
  ChildAchievement,
  ChildMilestone,
  Classroom,
  ItemResponse,
  ListResponse,
  Media,
  MilestoneCategory,
  ReportMood,
  ReportRating,
  User,
} from "../../types/api";
import { ScheduleEditor } from "./ScheduleEditor";

const TABS = [
  { to: "", label: "Roster & Attendance" },
  { to: "care", label: "Care Logging" },
  { to: "reports", label: "Daily Reports" },
  { to: "milestones", label: "Milestones & Badges" },
  { to: "plans", label: "Weekly Plan" },
  { to: "menus", label: "Meal Menu" },
  { to: "schedule", label: "Schedule" },
  { to: "teachers", label: "Teachers" },
];

export function ClassroomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "";
  const classroomId = Number(id);

  // Pre-selected children when navigating between tabs
  const [selectedChildIds, setSelectedChildIds] = useState<number[]>([]);

  const { data: room, isLoading } = useQuery({
    queryKey: ["classroom", id],
    queryFn: async () => (await api.get<ItemResponse<Classroom>>(`/classrooms/${id}`)).data.data,
    enabled: Boolean(id),
  });

  const { data: allChildren = [] } = useQuery({
    queryKey: ["classroom-roster", classroomId],
    queryFn: async () =>
      (await api.get<ListResponse<Child>>("/children", { params: { per_page: 200 } })).data.data,
  });

  const roster = useMemo(
    () => allChildren.filter((c) => c.classroom_id === classroomId),
    [allChildren, classroomId]
  );

  const counts = useMemo(
    () => ({
      total: roster.length,
      in: roster.filter((c) => c.present_status === "checked_in").length,
      out: roster.filter((c) => c.present_status === "checked_out").length,
      absent: roster.filter((c) => c.present_status === "absent").length,
    }),
    [roster]
  );

  if (isLoading) return <p className="text-sm font-semibold text-slate-500">Loading…</p>;
  if (!room) return <p className="text-sm font-semibold text-rose-600">Classroom not found.</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={room.name}
        subtitle={[room.age_group, room.room_location].filter(Boolean).join(" · ") || undefined}
        breadcrumbs={[{ label: "People", to: "/classrooms" }, { label: room.name }]}
        backTo="/classrooms"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setParams({ tab: "menus" })}
              className={`btn btn-secondary ${tab === "menus" ? "!bg-brand-50 !text-brand-700 !border-brand-300" : ""}`}
            >
              <UtensilsCrossed size={15} /> Menu
            </button>
            <button
              type="button"
              onClick={() => setParams({ tab: "plans" })}
              className={`btn btn-secondary ${tab === "plans" ? "!bg-brand-50 !text-brand-700 !border-brand-300" : ""}`}
            >
              <BookOpen size={15} /> Weekly plan
            </button>
            <button
              type="button"
              onClick={() => setParams({ tab: "milestones" })}
              className={`btn btn-secondary ${tab === "milestones" ? "!bg-brand-50 !text-brand-700 !border-brand-300" : ""}`}
            >
              <Trophy size={15} /> Milestones
            </button>
          </div>
        }
      />

      <Tabs base={`/classrooms/${id}`} tabs={TABS} query active={tab} />

      {tab === "" && (
        <RosterAttendanceTab
          classroomId={classroomId}
          room={room}
          roster={roster}
          counts={counts}
          selectedIds={selectedChildIds}
          setSelectedIds={setSelectedChildIds}
          onSwitchTab={(targetTab, ids) => {
            if (ids) setSelectedChildIds(ids);
            setParams({ tab: targetTab });
          }}
        />
      )}

      {tab === "care" && (
        <ClassroomCareTab
          classroomId={classroomId}
          roster={roster}
          selectedIds={selectedChildIds}
          setSelectedIds={setSelectedChildIds}
        />
      )}

      {tab === "reports" && (
        <ClassroomReportsTab
          classroomId={classroomId}
          roster={roster}
          selectedIds={selectedChildIds}
          setSelectedIds={setSelectedChildIds}
        />
      )}

      {tab === "milestones" && (
        <ClassroomMilestonesTab
          classroomId={classroomId}
          roster={roster}
          selectedIds={selectedChildIds}
          setSelectedIds={setSelectedChildIds}
        />
      )}

      {tab === "plans" && (
        <div className="card p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <WeeklyPlansPage classroomId={classroomId} hideHeader />
        </div>
      )}

      {tab === "menus" && (
        <div className="card p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <MenusPage classroomId={classroomId} hideHeader />
        </div>
      )}

      {tab === "schedule" && (
        <div className="card p-6">
          <ScheduleEditor classroomId={classroomId} />
        </div>
      )}

      {tab === "teachers" && <TeachersTab classroomId={classroomId} room={room} />}
    </div>
  );
}

/* =========================================================================
   TAB 1: ROSTER & ATTENDANCE
   ========================================================================= */

function RosterAttendanceTab({
  classroomId,
  room,
  roster,
  counts,
  selectedIds,
  setSelectedIds,
  onSwitchTab,
}: {
  classroomId: number;
  room: Classroom;
  roster: Child[];
  counts: { total: number; in: number; out: number; absent: number };
  selectedIds: number[];
  setSelectedIds: (ids: number[]) => void;
  onSwitchTab: (tab: string, ids?: number[]) => void;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [hubChild, setHubChild] = useState<Child | null>(null);
  const [busyChildId, setBusyChildId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter(
      (c) =>
        c.first_name.toLowerCase().includes(q) ||
        c.last_name.toLowerCase().includes(q) ||
        c.present_status.toLowerCase().includes(q)
    );
  }, [roster, search]);

  const allSelected = filtered.length > 0 && filtered.every((c) => selectedIds.includes(c.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      const filteredSet = new Set(filtered.map((c) => c.id));
      setSelectedIds(selectedIds.filter((id) => !filteredSet.has(id)));
    } else {
      const union = new Set([...selectedIds, ...filtered.map((c) => c.id)]);
      setSelectedIds(Array.from(union));
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedIds(
      selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]
    );
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // Check in/out or absent single child
  const setPresence = async (childId: number, action: "check_in" | "check_out" | "absent") => {
    setBusyChildId(childId);
    try {
      await api.post(`/children/${childId}/check`, { action });
      await qc.invalidateQueries({ queryKey: ["classroom-roster", classroomId] });
      await qc.invalidateQueries({ queryKey: ["children"] });
      showToast(
        action === "check_in" ? "Child checked in ✓" : action === "check_out" ? "Child checked out ✓" : "Marked absent ✓"
      );
    } catch (err) {
      showToast(errorMessage(err));
    } finally {
      setBusyChildId(null);
    }
  };

  // Bulk presence action
  const bulkSetPresence = async (action: "check_in" | "check_out" | "absent", targetIds: number[]) => {
    if (targetIds.length === 0) return;
    setBulkBusy(true);
    let successCount = 0;
    for (const childId of targetIds) {
      try {
        await api.post(`/children/${childId}/check`, { action });
        successCount++;
      } catch {
        // Continue for remaining children
      }
    }
    await qc.invalidateQueries({ queryKey: ["classroom-roster", classroomId] });
    await qc.invalidateQueries({ queryKey: ["children"] });
    setBulkBusy(false);
    showToast(
      action === "check_in"
        ? `${successCount} children marked present ✓`
        : action === "check_out"
        ? `${successCount} children checked out ✓`
        : `${successCount} children marked absent ✓`
    );
  };

  // Quick action: Mark ALL children in this classroom present
  const markAllPresent = async () => {
    const notIn = roster.filter((c) => c.present_status !== "checked_in").map((c) => c.id);
    if (notIn.length === 0) {
      showToast("All children are already checked in!");
      return;
    }
    await bulkSetPresence("check_in", notIn);
  };

  return (
    <div className="space-y-6">
      {/* Toast message banner */}
      {toastMessage && (
        <div className="rounded-xl bg-emerald-500 text-white px-4 py-2.5 text-sm font-bold shadow-md shadow-emerald-500/20 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage("")} className="hover:opacity-80">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Classroom Status Stats & Quick Actions Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4 border border-slate-200/80 dark:border-slate-800">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Enrolled</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-800 dark:text-slate-100">{counts.total}</span>
            {room.capacity ? <span className="text-xs text-slate-400">/ {room.capacity} cap</span> : null}
          </div>
        </div>

        <div className="card p-4 border border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Present (In)</p>
          <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1 block">
            {counts.in}
          </span>
        </div>

        <div className="card p-4 border border-slate-200/80 dark:border-slate-800">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Checked Out</p>
          <span className="text-2xl font-black text-slate-700 dark:text-slate-300 mt-1 block">
            {counts.out}
          </span>
        </div>

        <div className="card p-4 border border-rose-200/80 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20">
          <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">Absent</p>
          <span className="text-2xl font-black text-rose-700 dark:text-rose-300 mt-1 block">
            {counts.absent}
          </span>
        </div>
      </div>

      {/* Main Roster Card */}
      <div className="card p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
        {/* Controls Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="rounded h-4 w-4 accent-primary"
              />
              <span>Select all ({filtered.length})</span>
            </label>
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search children..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input !py-1.5 !pl-9 text-xs"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={markAllPresent}
              disabled={bulkBusy || counts.in === counts.total}
              className="btn btn-primary text-xs !py-2 shadow-md shadow-primary/20"
              title="Marks all enrolled children as present today"
            >
              <CheckCheck size={16} />
              <span>Mark all present ({roster.length})</span>
            </button>
          </div>
        </div>

        {/* Selected Batch Floating Action Bar */}
        {selectedIds.length > 0 && (
          <div className="rounded-2xl bg-slate-900 text-white p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xl">
            <div className="flex items-center gap-3">
              <span className="badge bg-primary text-white border-none text-xs px-2.5 py-1">
                {selectedIds.length} selected
              </span>
              <button
                onClick={() => setSelectedIds([])}
                className="text-xs text-slate-400 hover:text-white underline"
              >
                Clear
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => bulkSetPresence("check_in", selectedIds)}
                disabled={bulkBusy}
                className="btn bg-emerald-600 hover:bg-emerald-500 text-white text-xs !py-1.5"
              >
                <UserCheck size={14} /> Check in ({selectedIds.length})
              </button>
              <button
                onClick={() => bulkSetPresence("check_out", selectedIds)}
                disabled={bulkBusy}
                className="btn bg-slate-700 hover:bg-slate-600 text-white text-xs !py-1.5"
              >
                <Clock size={14} /> Check out ({selectedIds.length})
              </button>
              <button
                onClick={() => bulkSetPresence("absent", selectedIds)}
                disabled={bulkBusy}
                className="btn bg-rose-600 hover:bg-rose-500 text-white text-xs !py-1.5"
              >
                <UserX size={14} /> Mark absent ({selectedIds.length})
              </button>

              <div className="h-4 w-px bg-slate-700 mx-1 hidden sm:block" />

              <button
                onClick={() => onSwitchTab("care", selectedIds)}
                className="btn bg-brand-600 hover:bg-brand-500 text-white text-xs !py-1.5"
              >
                <HeartPulse size={14} /> Log Care
              </button>
              <button
                onClick={() => onSwitchTab("reports", selectedIds)}
                className="btn bg-brand-600 hover:bg-brand-500 text-white text-xs !py-1.5"
              >
                <FileText size={14} /> Daily Report
              </button>
            </div>
          </div>
        )}

        {/* Children Grid */}
        {filtered.length === 0 ? (
          <EmptyState
            title="No children found"
            hint={search ? "Try another search term" : "Assign children to this classroom to manage attendance."}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((child) => {
              const isSelected = selectedIds.includes(child.id);
              const isBusy = busyChildId === child.id || bulkBusy;

              return (
                <div
                  key={child.id}
                  className={`rounded-2xl border transition-all duration-200 p-4 flex flex-col justify-between gap-3 ${
                    isSelected
                      ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-sm"
                      : "border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectOne(child.id)}
                      className="rounded h-4 w-4 mt-1 accent-primary cursor-pointer"
                    />

                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-100 to-brand-200 dark:from-brand-900/50 dark:to-brand-800/40 text-sm font-black text-brand-800 dark:text-brand-200 shadow-sm border border-brand-300/40">
                      {child.first_name[0]}
                      {child.last_name[0]}
                    </div>

                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/children/${child.id}`}
                        className="font-bold text-sm text-slate-800 dark:text-slate-100 hover:text-primary transition-colors flex items-center gap-1 group"
                      >
                        <span className="truncate">{child.first_name} {child.last_name}</span>
                        <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 shrink-0" />
                      </Link>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">
                        DOB: {child.dob ? child.dob.slice(0, 10) : "—"}
                      </p>
                    </div>

                    <span
                      className={`badge shrink-0 text-[10px] uppercase font-black ${tint(
                        PRESENCE_TINT,
                        child.present_status
                      )}`}
                    >
                      {child.present_status.replace("_", " ")}
                    </span>
                  </div>

                  {/* Presence switcher controls */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/60 gap-2">
                    <button
                      onClick={() => setHubChild(child)}
                      className="btn-secondary !py-1 text-xs !px-2.5 text-slate-600 dark:text-slate-300"
                      title="Open full care and report logs for this child"
                    >
                      Child Hub
                    </button>

                    <div className="flex items-center gap-1.5">
                      {child.present_status !== "checked_in" ? (
                        <button
                          onClick={() => setPresence(child.id, "check_in")}
                          disabled={isBusy}
                          className="btn-primary !py-1 text-xs !px-2.5"
                        >
                          Check in
                        </button>
                      ) : (
                        <button
                          onClick={() => setPresence(child.id, "check_out")}
                          disabled={isBusy}
                          className="btn-secondary !py-1 text-xs !px-2.5 text-slate-700 dark:text-slate-200"
                        >
                          Check out
                        </button>
                      )}

                      {child.present_status !== "absent" && (
                        <button
                          onClick={() => setPresence(child.id, "absent")}
                          disabled={isBusy}
                          className="btn-secondary !py-1 text-xs !px-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Mark absent"
                        >
                          Absent
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Hub Modal for selected child */}
      {hubChild && (
        <QuickHubModal
          child={hubChild}
          open={!!hubChild}
          onClose={() => setHubChild(null)}
        />
      )}
    </div>
  );
}

/* =========================================================================
   REUSABLE: CLASSROOM TARGET STUDENTS SELECTOR
   ========================================================================= */

interface ClassroomStudentSelectorProps {
  roster: Child[];
  selectedIds: number[];
  setSelectedIds: (ids: number[]) => void;
  targetMode: "all" | "present" | "single" | "custom";
  setTargetMode: (mode: "all" | "present" | "single" | "custom") => void;
  targetIds: number[];
  label?: string;
}

function ClassroomStudentSelector({
  roster,
  selectedIds,
  setSelectedIds,
  targetMode,
  setTargetMode,
  targetIds,
  label = "Target Students:",
}: ClassroomStudentSelectorProps) {
  const singleChild = targetIds.length === 1 ? roster.find((c) => c.id === targetIds[0]) ?? null : null;

  const handleSelectMode = (mode: "all" | "present" | "single" | "custom") => {
    setTargetMode(mode);
    if (mode === "all") {
      setSelectedIds(roster.map((c) => c.id));
    } else if (mode === "present") {
      setSelectedIds(roster.filter((c) => c.present_status === "checked_in").map((c) => c.id));
    } else if (mode === "single") {
      if (roster.length > 0) {
        setSelectedIds([roster[0].id]);
      }
    }
  };

  const handleToggleChild = (id: number) => {
    if (targetMode === "single") {
      setSelectedIds([id]);
      return;
    }
    setTargetMode("custom");
    setSelectedIds(
      selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]
    );
  };

  return (
    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {label}
          </span>
          <span className="badge bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-950/40 dark:text-brand-300 font-bold">
            {targetIds.length === 1 && singleChild
              ? `1 Student: ${singleChild.first_name} ${singleChild.last_name}`
              : targetIds.length === roster.length
              ? `All ${roster.length} Students in Classroom`
              : `${targetIds.length} of ${roster.length} Selected`}
          </span>
        </div>

        {/* Mode Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSelectMode("all")}
            className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${
              targetMode === "all"
                ? "bg-brand-600 text-white"
                : "text-brand-700 hover:bg-brand-50 dark:hover:bg-brand-950/40"
            }`}
          >
            All Students ({roster.length})
          </button>
          <span className="text-slate-300">·</span>
          <button
            type="button"
            onClick={() => handleSelectMode("present")}
            className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${
              targetMode === "present"
                ? "bg-emerald-600 text-white"
                : "text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            }`}
          >
            Present Only ({roster.filter((c) => c.present_status === "checked_in").length})
          </button>
          <span className="text-slate-300">·</span>
          <button
            type="button"
            onClick={() => handleSelectMode("single")}
            className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${
              targetMode === "single"
                ? "bg-amber-600 text-white"
                : "text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
            }`}
          >
            Single Student
          </button>
          <span className="text-slate-300">·</span>
          <button
            type="button"
            onClick={() => {
              setTargetMode("custom");
              setSelectedIds([]);
            }}
            className="text-xs font-bold text-slate-400 hover:text-slate-600"
          >
            Clear
          </button>
        </div>
      </div>

      {/* If Single Student mode, show dropdown shortcut */}
      {targetMode === "single" && (
        <div className="max-w-xs pt-1">
          <select
            className="input !py-1.5 !text-xs font-semibold"
            value={targetIds[0] ?? ""}
            onChange={(e) => setSelectedIds([Number(e.target.value)])}
          >
            {roster.map((c) => (
              <option key={c.id} value={c.id}>
                {c.first_name} {c.last_name} ({c.present_status === "checked_in" ? "Present" : "Out"})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Child Chips Matrix */}
      <div className="flex flex-wrap gap-2 pt-1 max-h-48 overflow-y-auto pr-1">
        {roster.map((c) => {
          const isSelected = targetIds.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => handleToggleChild(c.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold border transition-all ${
                isSelected
                  ? "bg-brand-50 border-brand-400 text-brand-900 shadow-sm dark:bg-brand-950/50 dark:border-brand-600 dark:text-brand-200 ring-2 ring-brand-500/20"
                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
              }`}
            >
              <div className="relative">
                {c.avatar?.url ? (
                  <img
                    src={c.avatar.url}
                    alt={c.first_name}
                    className="h-5 w-5 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-5 w-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-black text-slate-600 dark:text-slate-300">
                    {c.first_name[0]}
                  </div>
                )}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white ${
                    c.present_status === "checked_in"
                      ? "bg-emerald-500"
                      : c.present_status === "absent"
                      ? "bg-rose-500"
                      : "bg-slate-300"
                  }`}
                />
              </div>
              <span>
                {c.first_name} {c.last_name}
              </span>
              {isSelected && <Check size={13} className="text-brand-600 dark:text-brand-400" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================================
   TAB 2: CLASSROOM CARE LOGGING (BATCH & INDIVIDUAL)
   ========================================================================= */

type CareKind = "meal" | "sleep" | "diaper" | "hydration" | "diary";

function ClassroomCareTab({
  classroomId,
  roster,
  selectedIds,
  setSelectedIds,
}: {
  classroomId: number;
  roster: Child[];
  selectedIds: number[];
  setSelectedIds: (ids: number[]) => void;
}) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<CareKind>("meal");
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");

  // Form states:
  // Meal
  const [mealType, setMealType] = useState("lunch");
  const [mealStatus, setMealStatus] = useState("ate_well");
  const [mealNotes, setMealNotes] = useState("");
  const [mealPhoto, setMealPhoto] = useState<Media | null>(null);

  // Sleep
  const [sleepStart, setSleepStart] = useState("");
  const [sleepEnd, setSleepEnd] = useState("");
  const [sleepQuality, setSleepQuality] = useState(85);
  const [sleepNotes, setSleepNotes] = useState("");

  // Diaper
  const [wetness, setWetness] = useState("wet");
  const [stool, setStool] = useState("none");
  const [diaperNotes, setDiaperNotes] = useState("");

  // Hydration
  const [cups, setCups] = useState(4);
  const [hydrationNotes, setHydrationNotes] = useState("");

  // Diary
  const [diaryTitle, setDiaryTitle] = useState("");
  const [diaryBody, setDiaryBody] = useState("");
  const [diaryType, setDiaryType] = useState("activity");
  const [diaryPhoto, setDiaryPhoto] = useState<Media | null>(null);

  // Target mode & effective target children
  const [targetMode, setTargetMode] = useState<"all" | "present" | "single" | "custom">("all");

  const targetIds = useMemo(() => {
    if (targetMode === "all") return roster.map((c) => c.id);
    if (targetMode === "present") return roster.filter((c) => c.present_status === "checked_in").map((c) => c.id);
    if (selectedIds.length > 0) return selectedIds;
    return roster.length > 0 ? [roster[0].id] : [];
  }, [targetMode, selectedIds, roster]);

  const singleChild = useMemo(() => {
    if (targetIds.length === 1) {
      return roster.find((c) => c.id === targetIds[0]) ?? null;
    }
    return null;
  }, [targetIds, roster]);

  const handleBatchSubmit = async () => {
    if (targetIds.length === 0) {
      setErrMsg("Please select at least one child.");
      return;
    }
    setSubmitting(true);
    setErrMsg("");
    setToastMsg("");

    let successCount = 0;
    for (const childId of targetIds) {
      try {
        if (kind === "meal") {
          await api.post(`/children/${childId}/meals`, {
            meal_type: mealType,
            status: mealStatus,
            notes: mealNotes || undefined,
            photo_media_id: mealPhoto?.id ?? undefined,
            served_at: new Date().toISOString(),
          });
        } else if (kind === "sleep") {
          await api.post(`/children/${childId}/sleep`, {
            start_at: sleepStart ? new Date(sleepStart).toISOString() : new Date().toISOString(),
            end_at: sleepEnd ? new Date(sleepEnd).toISOString() : new Date().toISOString(),
            quality: sleepQuality,
            notes: sleepNotes || undefined,
          });
        } else if (kind === "diaper") {
          await api.post(`/children/${childId}/diaper`, {
            wetness,
            stool,
            notes: diaperNotes || undefined,
            occurred_at: new Date().toISOString(),
          });
        } else if (kind === "hydration") {
          await api.put(`/children/${childId}/hydration`, {
            cups_count: cups,
            notes: hydrationNotes || undefined,
          });
        } else if (kind === "diary") {
          await api.post(`/children/${childId}/diary`, {
            entry_type: diaryType,
            title: diaryTitle || "Daily Activity",
            body: diaryBody,
            media_ids: diaryPhoto ? [diaryPhoto.id] : [],
          });
        }
        successCount++;
      } catch {
        // Continue loop
      }
    }

    setSubmitting(false);
    await qc.invalidateQueries({ queryKey: ["classroom-roster", classroomId] });
    setToastMsg(
      `Successfully logged ${kind} activity for ${
        targetIds.length === 1 && singleChild
          ? `${singleChild.first_name} ${singleChild.last_name}`
          : targetIds.length === roster.length
          ? `all ${roster.length} children`
          : `${successCount} children`
      }! ✓`
    );
  };

  return (
    <div className="card p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
      <div>
        <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <HeartPulse className="text-brand-600" size={18} />
          <span>Batch Care Activity Logging</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Record meals, naps, diaper changes, hydration, or diary entries for multiple children at once.
        </p>
      </div>

      {toastMsg && (
        <div className="rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 p-3 text-xs font-bold flex items-center justify-between animate-in fade-in">
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg("")}><X size={14} /></button>
        </div>
      )}
      {errMsg && (
        <div className="rounded-xl bg-rose-50 text-rose-700 border border-rose-200 p-3 text-xs font-bold">
          {errMsg}
        </div>
      )}

      {/* Target Children Picker */}
      <ClassroomStudentSelector
        roster={roster}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        targetMode={targetMode}
        setTargetMode={setTargetMode}
        targetIds={targetIds}
      />

      {/* Care Activity Kind Tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "meal", label: "Meal / Snack", icon: Utensils },
            { id: "sleep", label: "Nap / Sleep", icon: Moon },
            { id: "diaper", label: "Diaper Change", icon: Baby },
            { id: "hydration", label: "Hydration (Water)", icon: Sparkles },
            { id: "diary", label: "Daily Activity / Note", icon: FileText },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setKind(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                kind === t.id
                  ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <Icon size={15} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Form Fields according to Kind */}
      <div className="p-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/40 space-y-4">
        {kind === "meal" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Meal Type">
                <select className="input" value={mealType} onChange={(e) => setMealType(e.target.value)}>
                  <option value="breakfast">Breakfast</option>
                  <option value="morning_snack">Morning Snack</option>
                  <option value="lunch">Lunch</option>
                  <option value="afternoon_snack">Afternoon Snack</option>
                  <option value="dinner">Dinner</option>
                </select>
              </FormField>

              <FormField label="Intake / Status">
                <select className="input" value={mealStatus} onChange={(e) => setMealStatus(e.target.value)}>
                  <option value="ate_well">Ate well (All/Most)</option>
                  <option value="ate_some">Ate some (Half)</option>
                  <option value="refused">Refused / Very little</option>
                </select>
              </FormField>
            </div>

            <FormField label="Notes (optional)">
              <input
                className="input"
                placeholder="e.g. Loved the vegetable soup, asked for seconds"
                value={mealNotes}
                onChange={(e) => setMealNotes(e.target.value)}
              />
            </FormField>

            <ImageUpload label="Meal Photo (optional)" value={mealPhoto} onChange={setMealPhoto} />
          </div>
        )}

        {kind === "sleep" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Sleep Start">
                <DatePicker hasTime value={sleepStart} onChange={setSleepStart} />
              </FormField>
              <FormField label="Sleep End">
                <DatePicker hasTime value={sleepEnd} onChange={setSleepEnd} />
              </FormField>
            </div>

            <FormField label={`Sleep Quality: ${sleepQuality}%`}>
              <input
                type="range"
                min={0}
                max={100}
                value={sleepQuality}
                onChange={(e) => setSleepQuality(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </FormField>

            <FormField label="Sleep Notes (optional)">
              <input
                className="input"
                placeholder="e.g. Fell asleep quickly with soothing music"
                value={sleepNotes}
                onChange={(e) => setSleepNotes(e.target.value)}
              />
            </FormField>
          </div>
        )}

        {kind === "diaper" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Wetness">
                <select className="input" value={wetness} onChange={(e) => setWetness(e.target.value)}>
                  <option value="dry">Dry</option>
                  <option value="wet">Wet</option>
                  <option value="very_wet">Very wet</option>
                </select>
              </FormField>

              <FormField label="Stool / Bowel">
                <select className="input" value={stool} onChange={(e) => setStool(e.target.value)}>
                  <option value="none">None</option>
                  <option value="normal">Normal</option>
                  <option value="loose">Loose</option>
                  <option value="hard">Hard</option>
                </select>
              </FormField>
            </div>

            <FormField label="Notes (optional)">
              <input
                className="input"
                placeholder="e.g. Diaper cream applied"
                value={diaperNotes}
                onChange={(e) => setDiaperNotes(e.target.value)}
              />
            </FormField>
          </div>
        )}

        {kind === "hydration" && (
          <div className="space-y-4">
            <FormField label="Water Cups Count">
              <div className="flex items-center gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCups(n)}
                    className={`h-10 w-10 rounded-xl font-extrabold text-sm border transition-all ${
                      cups === n
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </FormField>

            <FormField label="Notes (optional)">
              <input
                className="input"
                placeholder="e.g. Drank after active playground games"
                value={hydrationNotes}
                onChange={(e) => setHydrationNotes(e.target.value)}
              />
            </FormField>
          </div>
        )}

        {kind === "diary" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Entry Type" className="sm:col-span-1">
                <select className="input" value={diaryType} onChange={(e) => setDiaryType(e.target.value)}>
                  <option value="activity">Play / Activity</option>
                  <option value="learning">Learning Session</option>
                  <option value="outdoor">Outdoor Time</option>
                  <option value="general">General Note</option>
                </select>
              </FormField>

              <FormField label="Activity Title" required className="sm:col-span-2">
                <input
                  className="input"
                  placeholder="e.g. Water painting and story time"
                  value={diaryTitle}
                  onChange={(e) => setDiaryTitle(e.target.value)}
                />
              </FormField>
            </div>

            <FormField label="Description / Summary" required>
              <textarea
                className="input"
                rows={3}
                placeholder="What did the children do? Describe the group activity..."
                value={diaryBody}
                onChange={(e) => setDiaryBody(e.target.value)}
              />
            </FormField>

            <ImageUpload label="Activity Photo (optional)" value={diaryPhoto} onChange={setDiaryPhoto} />
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleBatchSubmit}
          disabled={submitting || targetIds.length === 0}
          className="btn btn-primary text-sm px-6 py-3 shadow-md shadow-primary/25"
        >
          {submitting
            ? "Saving activities…"
            : `Log ${kind} for ${
                targetIds.length === 1 && singleChild
                  ? singleChild.first_name
                  : targetIds.length === roster.length
                  ? `All ${roster.length} Children`
                  : `${targetIds.length} Children`
              } ✓`}
        </button>
      </div>
    </div>
  );
}

/* =========================================================================
   TAB 3: CLASSROOM DAILY REPORTS (BATCH & INDIVIDUAL)
   ========================================================================= */

function ClassroomReportsTab({
  classroomId,
  roster,
  selectedIds,
  setSelectedIds,
}: {
  classroomId: number;
  roster: Child[];
  selectedIds: number[];
  setSelectedIds: (ids: number[]) => void;
}) {
  const qc = useQueryClient();
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState("");
  const [moods, setMoods] = useState<Record<string, ReportMood["rating"]>>({
    social: "great",
    creative: "good",
    happy: "great",
    calm: "good",
  });
  const [ratings, setRatings] = useState<Record<string, { rating: ReportRating["rating"]; note: string }>>({
    social: { rating: "thriving", note: "" },
    participation: { rating: "doing_well", note: "" },
  });
  const [tips, setTips] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  // Target mode & effective target children
  const [targetMode, setTargetMode] = useState<"all" | "present" | "single" | "custom">("all");

  const targetIds = useMemo(() => {
    if (targetMode === "all") return roster.map((c) => c.id);
    if (targetMode === "present") return roster.filter((c) => c.present_status === "checked_in").map((c) => c.id);
    if (selectedIds.length > 0) return selectedIds;
    return roster.length > 0 ? [roster[0].id] : [];
  }, [targetMode, selectedIds, roster]);

  const singleChild = useMemo(() => {
    if (targetIds.length === 1) {
      return roster.find((c) => c.id === targetIds[0]) ?? null;
    }
    return null;
  }, [targetIds, roster]);

  const handleBatchReport = async () => {
    if (targetIds.length === 0) return;
    setSubmitting(true);
    setToastMsg("");

    let successCount = 0;
    for (const childId of targetIds) {
      try {
        await api.put(`/children/${childId}/reports`, {
          date: reportDate,
          summary,
          home_tips: tips.split("\n").map((s) => s.trim()).filter(Boolean),
          moods: MOODS.filter((m) => moods[m.key]).map((m) => ({ key: m.key, rating: moods[m.key] })),
          ratings: DIMENSIONS.filter((d) => ratings[d.key]?.rating).map((d) => ({
            dimension: d.key,
            rating: ratings[d.key].rating,
            note: ratings[d.key].note ?? "",
          })),
        });
        successCount++;
      } catch {
        // Continue
      }
    }

    setSubmitting(false);
    await qc.invalidateQueries({ queryKey: ["reports"] });
    await qc.invalidateQueries({ queryKey: ["classroom-roster", classroomId] });
    setToastMsg(
      `Daily report successfully published for ${
        targetIds.length === 1 && singleChild
          ? `${singleChild.first_name} ${singleChild.last_name}`
          : targetIds.length === roster.length
          ? `all ${roster.length} children`
          : `${successCount} children`
      }! ✓`
    );
  };

  return (
    <div className="card p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <FileText className="text-brand-600" size={18} />
            <span>Classroom Daily Reports</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Quickly publish daily summaries and mood ratings to parents for the whole classroom.
          </p>
        </div>

        <div className="w-48">
          <label className="label">Report Date</label>
          <DatePicker value={reportDate} onChange={setReportDate} />
        </div>
      </div>

      {toastMsg && (
        <div className="rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 p-3 text-xs font-bold flex items-center justify-between animate-in fade-in">
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg("")}><X size={14} /></button>
        </div>
      )}

      {/* Target Selection */}
      <ClassroomStudentSelector
        roster={roster}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        targetMode={targetMode}
        setTargetMode={setTargetMode}
        targetIds={targetIds}
      />

      {/* Day Summary */}
      <FormField label="Day Summary" required hint="Sent to parents of all selected children">
        <textarea
          className="input"
          rows={3}
          placeholder="e.g. The children had a wonderfully creative day! We explored colors, built towering blocks, and played actively in the sensory sandbox."
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </FormField>

      {/* Mood Ratings */}
      <div>
        <label className="label">Group Moods Today</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-1.5">
          {MOODS.map((m) => (
            <div key={m.key} className="card p-3 border border-slate-200/70 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                {m.label}
              </span>
              <select
                className="input !py-1 text-xs"
                value={moods[m.key] ?? "good"}
                onChange={(e) =>
                  setMoods({ ...moods, [m.key]: e.target.value as ReportMood["rating"] })
                }
              >
                {MOOD_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Dimension Ratings */}
      <div>
        <label className="label">Developmental Dimensions</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1.5">
          {DIMENSIONS.slice(0, 4).map((d) => (
            <div key={d.key} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {d.label}
              </span>
              <select
                className="input !py-1 text-xs !w-36"
                value={ratings[d.key]?.rating ?? "doing_well"}
                onChange={(e) =>
                  setRatings({
                    ...ratings,
                    [d.key]: {
                      rating: e.target.value as ReportRating["rating"],
                      note: ratings[d.key]?.note ?? "",
                    },
                  })
                }
              >
                {RATING_OPTIONS.map((ro) => (
                  <option key={ro} value={ro}>
                    {ro.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Home Tips */}
      <FormField label="Tips for Home (optional)" hint="One tip per line">
        <textarea
          className="input"
          rows={2}
          placeholder="e.g. Ask your child about the sensory story they heard today!"
          value={tips}
          onChange={(e) => setTips(e.target.value)}
        />
      </FormField>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleBatchReport}
          disabled={submitting || targetIds.length === 0}
          className="btn btn-primary text-sm px-6 py-3 shadow-md shadow-primary/25"
        >
          {submitting
            ? "Publishing reports…"
            : `Publish report for ${
                targetIds.length === 1 && singleChild
                  ? singleChild.first_name
                  : targetIds.length === roster.length
                  ? `All ${roster.length} Children`
                  : `${targetIds.length} Children`
              } ✓`}
        </button>
      </div>
    </div>
  );
}

/* =========================================================================
   TAB 4: TEACHERS
   ========================================================================= */

const teacherSchema = z.object({
  teacher_user_id: z.string().min(1, "required"),
  role: z.enum(["lead", "assistant"]),
});
type TeacherForm = z.infer<typeof teacherSchema>;

function TeachersTab({ classroomId, room }: { classroomId: number; room: Classroom }) {
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const form = useForm<TeacherForm>({
    resolver: zodResolver(teacherSchema),
    defaultValues: { teacher_user_id: "", role: "assistant" },
  });

  const teachers = useQuery({
    queryKey: ["teachers-all"],
    queryFn: async () =>
      (await api.get<ListResponse<User>>("/admin/users", { params: { role: "teacher", per_page: 100 } })).data.data,
  });

  const assign = useMutation({
    mutationFn: async (v: TeacherForm) =>
      api.post(`/admin/classrooms/${classroomId}/teachers`, {
        teacher_user_id: Number(v.teacher_user_id),
        role: v.role,
      }),
    onSuccess: () => {
      form.reset({ teacher_user_id: "", role: "assistant" });
      void qc.invalidateQueries({ queryKey: ["classroom", String(classroomId)] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const unassign = useMutation({
    mutationFn: async (teacherId: number) =>
      api.delete(`/admin/classrooms/${classroomId}/teachers/${teacherId}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["classroom", String(classroomId)] }),
  });

  return (
    <section className="card max-w-xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm">
      <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
        Assigned Teachers
      </h2>
      <ul className="mb-4 divide-y divide-slate-100 dark:divide-slate-800">
        {(room.teachers ?? []).map((ct) => (
          <li key={ct.id} className="flex items-center gap-3 py-2.5 text-sm">
            <span className="font-bold text-slate-800 dark:text-slate-100">
              {ct.teacher?.name ?? `#${ct.teacher_user_id}`}
            </span>
            <span
              className={`badge ${
                ct.role === "lead" ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-600"
              }`}
            >
              {ct.role}
            </span>
            <button
              className="ms-auto text-slate-400 hover:text-rose-600 transition-colors"
              onClick={() => unassign.mutate(ct.teacher_user_id)}
              aria-label="Remove teacher"
              type="button"
            >
              <X size={16} />
            </button>
          </li>
        ))}
        {(room.teachers ?? []).length === 0 && (
          <p className="py-4 text-xs font-semibold text-slate-400">No teachers assigned yet.</p>
        )}
      </ul>

      <form onSubmit={form.handleSubmit((v) => assign.mutate(v))} className="flex items-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        <div className="flex-1">
          <label className="label">Teacher</label>
          <select className="input" {...form.register("teacher_user_id")}>
            <option value="">— Select teacher —</option>
            {(teachers.data ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Role</label>
          <select className="input" {...form.register("role")}>
            <option value="assistant">Assistant</option>
            <option value="lead">Lead</option>
          </select>
        </div>
        <button className="btn btn-primary" disabled={assign.isPending} type="submit">
          <Plus size={16} /> Add
        </button>
      </form>
      {error && <p className="mt-2 text-sm font-semibold text-rose-600">{error}</p>}
    </section>
  );
}

/* =========================================================================
   TAB 4: CLASSROOM MILESTONES & BADGES (FOR ONE STUDENT OR FOR ALL)
   ========================================================================= */

type MilestonesAction = "award" | "assess" | "manage";

function ClassroomMilestonesTab({
  classroomId: _classroomId,
  roster,
  selectedIds,
  setSelectedIds,
}: {
  classroomId?: number;
  roster: Child[];
  selectedIds: number[];
  setSelectedIds: (ids: number[]) => void;
}) {
  const qc = useQueryClient();
  const [action, setAction] = useState<MilestonesAction>("award");
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");

  // Target mode: "all" | "present" | "single" | "custom"
  const [targetMode, setTargetMode] = useState<"all" | "present" | "single" | "custom">("all");

  // Badge Award state
  const [awardTplId, setAwardTplId] = useState<string>("");
  const [awardDate, setAwardDate] = useState(() => toISODate(new Date()));
  const [awardNote, setAwardNote] = useState("");

  // Skill Assessment state (batch & single)
  const [assessCatId, setAssessCatId] = useState<string>("");
  const [assessProgress, setAssessProgress] = useState<number>(100);
  const [assessStatus, setAssessStatus] = useState<"not_started" | "in_progress" | "achieved">("achieved");
  const [assessDescription, setAssessDescription] = useState("");

  // Single-child draft state for individual sliders
  const [childDrafts, setChildDrafts] = useState<Record<number, { progress: number; status: string; description: string }>>({});

  // Queries
  const categoriesQuery = useQuery({
    queryKey: ["milestone-categories"],
    queryFn: async () => (await api.get<ItemResponse<MilestoneCategory[]>>("/milestone-categories")).data.data ?? [],
  });

  const templatesQuery = useQuery({
    queryKey: ["achievement-templates"],
    queryFn: async () => (await api.get<ItemResponse<AchievementTemplate[]>>("/achievement-templates")).data.data ?? [],
  });

  // Effective targets
  const targetIds = useMemo(() => {
    if (targetMode === "all") return roster.map((c) => c.id);
    if (targetMode === "present") return roster.filter((c) => c.present_status === "checked_in").map((c) => c.id);
    if (selectedIds.length > 0) return selectedIds;
    return roster.length > 0 ? [roster[0].id] : [];
  }, [targetMode, selectedIds, roster]);

  const singleChild = useMemo(() => {
    if (targetIds.length === 1) {
      return roster.find((c) => c.id === targetIds[0]) ?? null;
    }
    return null;
  }, [targetIds, roster]);

  // Single child milestones & achievements
  const singleMilestones = useQuery({
    queryKey: ["milestones", singleChild?.id],
    enabled: !!singleChild,
    queryFn: async () =>
      (await api.get<ItemResponse<ChildMilestone[]>>(`/children/${singleChild!.id}/milestones`)).data.data ?? [],
  });

  const singleAchievements = useQuery({
    queryKey: ["achievements", singleChild?.id],
    enabled: !!singleChild,
    queryFn: async () =>
      (await api.get<ItemResponse<ChildAchievement[]>>(`/children/${singleChild!.id}/achievements`)).data.data ?? [],
  });

  const existingSingleFor = (categoryId: number) =>
    singleMilestones.data?.find((m) => m.category_id === categoryId);

  const draftSingleFor = (categoryId: number) => {
    const ex = existingSingleFor(categoryId);
    return (
      childDrafts[categoryId] ?? {
        progress: ex?.progress_pct ?? 0,
        status: ex?.status ?? "in_progress",
        description: ex?.description ?? "",
      }
    );
  };


  // Submit Badge Award (For 1 student or for all/selected students)
  const handleAwardBadges = async () => {
    if (!awardTplId) {
      setErrMsg("Please select a badge to award.");
      return;
    }
    if (targetIds.length === 0) {
      setErrMsg("Please select at least one student.");
      return;
    }

    setSubmitting(true);
    setErrMsg("");
    setToastMsg("");

    const template = templatesQuery.data?.find((t) => String(t.id) === awardTplId);
    let successCount = 0;

    for (const childId of targetIds) {
      try {
        await api.post(`/children/${childId}/achievements`, {
          achievement_template_id: Number(awardTplId),
          awarded_date: awardDate,
          note: awardNote || undefined,
        });
        successCount++;
      } catch {
        // continue
      }
    }

    setSubmitting(false);
    void qc.invalidateQueries({ queryKey: ["achievements"] });
    if (singleChild) {
      void qc.invalidateQueries({ queryKey: ["achievements", singleChild.id] });
    }

    setToastMsg(
      `🏆 Awarded "${template?.title ?? "Badge"}" to ${
        targetIds.length === 1 && singleChild
          ? `${singleChild.first_name} ${singleChild.last_name}`
          : `${successCount} student${successCount > 1 ? "s" : ""}`
      }! ✓`
    );
    setAwardNote("");
  };

  // Submit Milestone Assessment (For 1 student or for all/selected students)
  const handleBatchAssess = async () => {
    if (!assessCatId) {
      setErrMsg("Please select a skill category to assess.");
      return;
    }
    if (targetIds.length === 0) {
      setErrMsg("Please select at least one student.");
      return;
    }

    setSubmitting(true);
    setErrMsg("");
    setToastMsg("");

    const category = categoriesQuery.data?.find((c) => String(c.id) === assessCatId);
    let successCount = 0;

    for (const childId of targetIds) {
      try {
        await api.put(`/children/${childId}/milestones`, {
          category_id: Number(assessCatId),
          progress_pct: assessProgress,
          status: assessStatus,
          description: assessDescription || undefined,
        });
        successCount++;
      } catch {
        // continue
      }
    }

    setSubmitting(false);
    void qc.invalidateQueries({ queryKey: ["milestones"] });
    if (singleChild) {
      void qc.invalidateQueries({ queryKey: ["milestones", singleChild.id] });
    }

    setToastMsg(
      `📊 Applied "${category?.name ?? "Skill"}" assessment to ${
        targetIds.length === 1 && singleChild
          ? `${singleChild.first_name} ${singleChild.last_name}`
          : `${successCount} student${successCount > 1 ? "s" : ""}`
      }! ✓`
    );
  };

  // Save individual category for a single student
  const handleSaveSingleCategory = async (categoryId: number) => {
    if (!singleChild) return;
    const d = draftSingleFor(categoryId);
    try {
      await api.put(`/children/${singleChild.id}/milestones`, {
        category_id: categoryId,
        progress_pct: d.progress,
        status: d.status,
        description: d.description || undefined,
      });
      void qc.invalidateQueries({ queryKey: ["milestones", singleChild.id] });
      setToastMsg("Skill assessment updated ✓");
      setTimeout(() => setToastMsg(""), 3000);
    } catch (err) {
      setErrMsg(errorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Card with Target Selector */}
      <div className="card p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Trophy className="text-amber-500" size={20} />
              <span>Milestones & Achievement Badges</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Award badges or assess developmental milestones for one student or for all students together.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setAction("award")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                action === "award"
                  ? "bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <Award size={14} /> Award Badges
            </button>
            <button
              type="button"
              onClick={() => setAction("assess")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                action === "assess"
                  ? "bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <Sliders size={14} /> Skill Assessment
            </button>
            <button
              type="button"
              onClick={() => setAction("manage")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                action === "manage"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <Settings2 size={14} /> Manage Badges & Skills
            </button>
          </div>
        </div>

        {toastMsg && (
          <div className="rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 p-3 text-xs font-bold flex items-center justify-between animate-in fade-in">
            <span>{toastMsg}</span>
            <button onClick={() => setToastMsg("")}>
              <X size={14} />
            </button>
          </div>
        )}
        {errMsg && (
          <div className="rounded-xl bg-rose-50 text-rose-700 border border-rose-200 p-3 text-xs font-bold">
            {errMsg}
          </div>
        )}

        {/* Target Students Selection Bar */}
        {action !== "manage" && (
          <ClassroomStudentSelector
            roster={roster}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            targetMode={targetMode}
            setTargetMode={setTargetMode}
            targetIds={targetIds}
          />
        )}
      </div>

      {/* =========================================================================
          ACTION 1: AWARD ACHIEVEMENT BADGES (ONE OR ALL STUDENTS)
          ========================================================================= */}
      {action === "award" && (
        <div className="card p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Award className="text-amber-500" size={17} />
                <span>Award Achievement Badge</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {targetIds.length === 1 && singleChild
                  ? `Recognizing ${singleChild.first_name} ${singleChild.last_name}`
                  : `Awarding to ${targetIds.length} student${targetIds.length > 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Badge Templates Selection Grid */}
            <div>
              <label className="label">Choose Badge Template</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {(templatesQuery.data ?? []).map((tp) => {
                  const isSelected = awardTplId === String(tp.id);
                  return (
                    <button
                      key={tp.id}
                      type="button"
                      onClick={() => setAwardTplId(String(tp.id))}
                      className={`p-3 rounded-2xl border text-center transition-all ${
                        isSelected
                          ? "border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 ring-2 ring-amber-500/30"
                          : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/80"
                      }`}
                    >
                      <span
                        className="mx-auto block h-9 w-9 rounded-full shadow-sm flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: tp.color || "#f59e0b" }}
                      >
                        🏆
                      </span>
                      <div className="mt-2 text-xs font-bold text-slate-800 dark:text-slate-100">
                        {tp.title}
                      </div>
                      {tp.description && (
                        <div className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">
                          {tp.description}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              {(!templatesQuery.data || templatesQuery.data.length === 0) && (
                <p className="text-xs text-slate-400 py-3">
                  No badge templates found. Create some in the "Manage Badges & Skills" tab!
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
              <div className="sm:col-span-4">
                <label className="label">Award Date</label>
                <DatePicker value={awardDate} onChange={setAwardDate} />
              </div>

              <div className="sm:col-span-8">
                <label className="label">Observation / Note (Optional)</label>
                <input
                  className="input"
                  placeholder="e.g. Demonstrated exceptional kindness and helper spirit today"
                  value={awardNote}
                  onChange={(e) => setAwardNote(e.target.value)}
                />
              </div>
            </div>

            {/* Award Submit CTA */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                disabled={!awardTplId || targetIds.length === 0 || submitting}
                onClick={handleAwardBadges}
                className="btn btn-primary !bg-amber-600 hover:!bg-amber-700 text-white font-bold px-6 py-2.5 shadow-sm flex items-center gap-2"
              >
                <Award size={16} />
                <span>
                  {submitting
                    ? "Awarding..."
                    : `Award 🏆 to ${
                        targetIds.length === 1 && singleChild
                          ? `${singleChild.first_name} ${singleChild.last_name}`
                          : targetIds.length === roster.length
                          ? `All ${roster.length} Students`
                          : `${targetIds.length} Students`
                      }`}
                </span>
              </button>
            </div>
          </div>

          {/* If single student selected, show their previous badges */}
          {singleChild && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Previously Awarded to {singleChild.first_name}:
              </h4>
              <div className="flex flex-wrap gap-2">
                {(singleAchievements.data ?? []).map((a) => (
                  <span
                    key={a.id}
                    className="badge bg-amber-50 text-amber-900 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-200 py-1.5 px-3 flex items-center gap-1.5"
                  >
                    <span>🏆</span>
                    <strong className="font-bold">{a.template?.title}</strong>
                    <span className="text-amber-700 dark:text-amber-400 font-normal">· {a.awarded_date}</span>
                    {a.note && <span className="text-[10px] text-slate-500 italic">"{a.note}"</span>}
                  </span>
                ))}
                {(!singleAchievements.data || singleAchievements.data.length === 0) && (
                  <p className="text-xs text-slate-400">No badges awarded to {singleChild.first_name} yet.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          ACTION 2: ASSESS SKILLS & MILESTONES (ONE OR ALL STUDENTS)
          ========================================================================= */}
      {action === "assess" && (
        <div className="space-y-6">
          {/* Quick Apply Assessment Card (Multi or Single) */}
          <div className="card p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Sliders className="text-brand-600" size={17} />
                  <span>Update Developmental Assessment</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {targetIds.length === 1 && singleChild
                    ? `Assessing ${singleChild.first_name} ${singleChild.last_name}`
                    : `Applying assessment to ${targetIds.length} student${targetIds.length > 1 ? "s" : ""}`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
              <div className="sm:col-span-4">
                <label className="label">Skill Category</label>
                <select
                  className="input"
                  value={assessCatId}
                  onChange={(e) => setAssessCatId(e.target.value)}
                >
                  <option value="">— Select Category —</option>
                  {(categoriesQuery.data ?? []).map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="label">Status</label>
                <select
                  className="input"
                  value={assessStatus}
                  onChange={(e) =>
                    setAssessStatus(e.target.value as "not_started" | "in_progress" | "achieved")
                  }
                >
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="achieved">Achieved</option>
                </select>
              </div>

              <div className="sm:col-span-5">
                <div className="flex items-center justify-between">
                  <label className="label mb-0">Progress Level</label>
                  <span className="text-xs font-black text-brand-600">{assessProgress}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={assessProgress}
                  onChange={(e) => setAssessProgress(Number(e.target.value))}
                  className="w-full mt-2"
                />
              </div>

              <div className="sm:col-span-12">
                <label className="label">Observation Note for Parents (Optional)</label>
                <input
                  className="input"
                  placeholder="e.g. Mastered identifying secondary colors and counting up to 20"
                  value={assessDescription}
                  onChange={(e) => setAssessDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                disabled={!assessCatId || targetIds.length === 0 || submitting}
                onClick={handleBatchAssess}
                className="btn btn-primary font-bold px-6 py-2.5 shadow-sm flex items-center gap-2"
              >
                <Check size={16} />
                <span>
                  {submitting
                    ? "Applying..."
                    : `Apply Assessment to ${
                        targetIds.length === 1 && singleChild
                          ? `${singleChild.first_name} ${singleChild.last_name}`
                          : targetIds.length === roster.length
                          ? `All ${roster.length} Students`
                          : `${targetIds.length} Students`
                      }`}
                </span>
              </button>
            </div>
          </div>

          {/* If 1 student selected: Show Full Category Matrix */}
          {singleChild && (
            <div className="card p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Full Skill Matrix for {singleChild.first_name} {singleChild.last_name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Fine-tune each milestone category individually.
                </p>
              </div>

              <div className="space-y-4 divide-y divide-slate-100 dark:divide-slate-800">
                {(categoriesQuery.data ?? []).map((cat) => {
                  const d = draftSingleFor(cat.id);
                  return (
                    <div key={cat.id} className="pt-4 first:pt-0 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                      <div className="sm:col-span-3">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 rounded-full"
                            style={{ backgroundColor: cat.color || "#6366f1" }}
                          />
                          <span>{cat.name}</span>
                        </div>
                        {cat.description && (
                          <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                            {cat.description}
                          </div>
                        )}
                      </div>

                      <div className="sm:col-span-3 flex items-center gap-2">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          className="w-full"
                          value={d.progress}
                          onChange={(e) =>
                            setChildDrafts({
                              ...childDrafts,
                              [cat.id]: { ...d, progress: Number(e.target.value) },
                            })
                          }
                        />
                        <span className="w-10 text-right text-xs font-mono font-bold text-slate-600">
                          {d.progress}%
                        </span>
                      </div>

                      <div className="sm:col-span-2">
                        <select
                          className="input !py-1.5 !text-xs"
                          value={d.status}
                          onChange={(e) =>
                            setChildDrafts({
                              ...childDrafts,
                              [cat.id]: { ...d, status: e.target.value },
                            })
                          }
                        >
                          <option value="not_started">Not Started</option>
                          <option value="in_progress">In Progress</option>
                          <option value="achieved">Achieved</option>
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <input
                          className="input !py-1.5 !text-xs"
                          placeholder="Notes for parents"
                          value={d.description}
                          onChange={(e) =>
                            setChildDrafts({
                              ...childDrafts,
                              [cat.id]: { ...d, description: e.target.value },
                            })
                          }
                        />
                      </div>

                      <div className="sm:col-span-1">
                        <button
                          type="button"
                          className="btn-secondary !py-1.5 !px-2.5 text-xs w-full font-bold"
                          onClick={() => handleSaveSingleCategory(cat.id)}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          ACTION 3: MANAGE CATEGORIES & BADGE TEMPLATES
          ========================================================================= */}
      {action === "manage" && (
        <div className="space-y-6">
          <div className="card p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Manage Skill Categories
            </h3>
            <CategoriesTab />
          </div>

          <div className="card p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Manage Achievement Badges
            </h3>
            <TemplatesTab />
          </div>
        </div>
      )}
    </div>
  );
}
