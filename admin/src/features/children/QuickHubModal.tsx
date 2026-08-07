import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { HeartPulse, FileText, Trophy } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import { ImageUpload } from "../../components/ImageUpload";
import { toISODate } from "../../components/WeekPicker";
import { Modal } from "../../components/Modal";
import { DIMENSIONS, MOODS, MOOD_OPTIONS, RATING_OPTIONS } from "../reports/reportConstants";
import type {
  Child,
  DailyReport,
  ListResponse,
  Media,
  ReportMood,
  ReportRating,
  MilestoneCategory,
  AchievementTemplate,
  ChildMilestone,
  ChildAchievement,
  ItemResponse,
} from "../../types/api";

interface QuickHubModalProps {
  child: Child | null;
  open: boolean;
  onClose: () => void;
  /**
   * Render the tab bodies bare, for the /children/:id page.
   *
   * The care, report, and milestone editors are ~700 lines of interlocking
   * form state. Parameterising the chrome keeps one implementation for both
   * surfaces rather than forking it — a fork would drift, and both write to
   * the same endpoints.
   */
  embedded?: boolean;
  /** Externally controlled tab; only meaningful when embedded. */
  tab?: TabType;
}

/**
 * The child hub rendered inline on the detail page instead of in a modal.
 */
export function ChildHubTabs({ child, tab }: { child: Child; tab: TabType }) {
  return <QuickHubModal child={child} open onClose={() => {}} embedded tab={tab} />;
}

type TabType = "care" | "report" | "milestones";
type LogKind = "diary" | "meal" | "sleep" | "diaper" | "hydration";

export function QuickHubModal({ child, open, onClose, embedded = false, tab }: QuickHubModalProps) {
  const qc = useQueryClient();

  const [localTab, setActiveTab] = useState<TabType>("care");
  // Embedded, the tab comes from the URL so it survives a refresh and can be
  // linked to; in the modal it stays local state.
  const activeTab: TabType = embedded ? (tab ?? "care") : localTab;
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // ----------------------------------------------------
  // Tab 1: CARE LOG STATE & MUTATIONS
  // ----------------------------------------------------
  const [careKind, setCareKind] = useState<LogKind>("diary");
  // Diary fields
  const [diaryType, setDiaryType] = useState("activity");
  const [diaryTitle, setDiaryTitle] = useState("");
  const [diaryBody, setDiaryBody] = useState("");
  // Meal fields
  const [mealType, setMealType] = useState("lunch");
  const [mealStatus, setMealStatus] = useState("ate_well");
  const [mealNote, setMealNote] = useState("");
  // Sleep fields
  const [sleepStart, setSleepStart] = useState("");
  const [sleepEnd, setSleepEnd] = useState("");
  const [sleepQuality, setSleepQuality] = useState(80);
  const [sleepDeep, setSleepDeep] = useState("");
  const [sleepLight, setSleepLight] = useState("");
  const [sleepAwake, setSleepAwake] = useState("");
  const [sleepFellAsleep, setSleepFellAsleep] = useState("");
  const [sleepMood, setSleepMood] = useState("happy");
  // Diaper fields
  const [diaperWetness, setDiaperWetness] = useState("wet");
  const [diaperStool, setDiaperStool] = useState("none");
  const [diaperComfort, setDiaperComfort] = useState("happy");
  const [diaperNote, setDiaperNote] = useState("");
  // Hydration fields
  const [hydrationCups, setHydrationCups] = useState(4);
  const [hydrationRating, setHydrationRating] = useState("good");
  // General photo upload (used for diary and meal)
  const [carePhoto, setCarePhoto] = useState<Media | null>(null);

  const toRFC3339 = (local: string) => (local ? new Date(local).toISOString() : "");

  const submitCare = useMutation({
    mutationFn: async () => {
      if (!child) return;
      const id = child.id;
      switch (careKind) {
        case "diary":
          return api.post(`/children/${id}/diary`, {
            type: diaryType,
            title: diaryTitle,
            body: diaryBody,
            is_live: true,
            media_ids: carePhoto ? [carePhoto.id] : undefined,
          });
        case "meal":
          return api.post(`/children/${id}/meals`, {
            meal_type: mealType,
            status: mealStatus,
            note: mealNote,
            image_id: carePhoto?.id ?? undefined,
          });
        case "sleep":
          return api.post(`/children/${id}/sleep`, {
            start_at: toRFC3339(sleepStart),
            end_at: toRFC3339(sleepEnd),
            quality_pct: sleepQuality,
            deep_min: sleepDeep ? Number(sleepDeep) : 0,
            light_min: sleepLight ? Number(sleepLight) : 0,
            awake_min: sleepAwake ? Number(sleepAwake) : 0,
            took_to_sleep_min: sleepFellAsleep ? Number(sleepFellAsleep) : 0,
            mood_after: sleepMood,
          });
        case "diaper":
          return api.post(`/children/${id}/diaper`, {
            time: new Date().toISOString(),
            wetness: diaperWetness,
            stool: diaperStool,
            comfort: diaperComfort,
            note: diaperNote,
          });
        case "hydration":
          return api.put(`/children/${id}/hydration`, {
            date: new Date().toISOString().slice(0, 10),
            cups: hydrationCups,
            rating: hydrationRating,
          });
      }
    },
    onSuccess: () => {
      setSuccessMsg("Logged successfully ✓");
      setErrorMsg("");
      setDiaryTitle("");
      setDiaryBody("");
      setMealNote("");
      setDiaperNote("");
      setCarePhoto(null);
      setTimeout(() => setSuccessMsg(""), 3000);
    },
    onError: (err) => {
      setSuccessMsg("");
      setErrorMsg(errorMessage(err));
    },
  });

  // ----------------------------------------------------
  // Tab 2: DAILY REPORT STATE & MUTATIONS
  // ----------------------------------------------------
  const [reportDate, setReportDate] = useState(() => toISODate(new Date()));
  const [repSummary, setRepSummary] = useState("");
  const [repHighlight, setRepHighlight] = useState("");
  const [repHighlightMedia, setRepHighlightMedia] = useState<Media | null>(null);
  const [repTips, setRepTips] = useState("");
  const [repMoods, setRepMoods] = useState<Record<string, ReportMood["rating"] | "">>({});
  const [repRatings, setRepRatings] = useState<Record<string, { rating: ReportRating["rating"] | ""; note: string }>>({});

  const existingReport = useQuery({
    queryKey: ["child-report", child?.id, reportDate],
    enabled: !!child && activeTab === "report",
    queryFn: async () => {
      const res = await api.get<ListResponse<DailyReport>>(`/children/${child!.id}/reports`, {
        params: { from: reportDate, to: reportDate, per_page: 1 },
      });
      return res.data.data[0] ?? null;
    },
  });

  useEffect(() => {
    if (activeTab === "report") {
      const r = existingReport.data;
      setRepSummary(r?.summary ?? "");
      setRepHighlight(r?.highlight_text ?? "");
      setRepHighlightMedia(r?.highlight_media ?? null);
      setRepTips((r?.home_tips ?? []).join("\n"));
      setRepMoods(Object.fromEntries((r?.moods ?? []).map((m) => [m.key, m.rating])));
      setRepRatings(
        Object.fromEntries((r?.ratings ?? []).map((x) => [x.dimension, { rating: x.rating, note: x.note }])),
      );
      setSuccessMsg("");
      setErrorMsg("");
    }
  }, [existingReport.data, activeTab]);

  const saveReport = useMutation({
    mutationFn: async () => {
      if (!child) return;
      return api.put(`/children/${child.id}/reports`, {
        date: reportDate,
        summary: repSummary,
        highlight_text: repHighlight,
        highlight_media_id: repHighlightMedia?.id ?? null,
        home_tips: repTips.split("\n").map((s) => s.trim()).filter(Boolean),
        moods: MOODS.filter((m) => repMoods[m.key]).map((m) => ({ key: m.key, rating: repMoods[m.key] })),
        ratings: DIMENSIONS.filter((d) => repRatings[d.key]?.rating).map((d) => ({
          dimension: d.key,
          rating: repRatings[d.key].rating,
          note: repRatings[d.key].note ?? "",
        })),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["child-report", child?.id, reportDate] });
      setSuccessMsg("Daily report saved ✓");
      setErrorMsg("");
      setTimeout(() => setSuccessMsg(""), 3000);
    },
    onError: (err) => {
      setSuccessMsg("");
      setErrorMsg(errorMessage(err));
    },
  });

  // ----------------------------------------------------
  // Tab 3: MILESTONES STATE & MUTATIONS
  // ----------------------------------------------------
  const [milestonesDrafts, setMilestonesDrafts] = useState<Record<number, { progress: number; status: string; description: string }>>({});
  const [awardTemplateId, setAwardTemplateId] = useState("");
  const [awardDate, setAwardDate] = useState(() => toISODate(new Date()));
  const [awardNote, setAwardNote] = useState("");

  const milestoneCategories = useQuery({
    queryKey: ["modal-categories"],
    enabled: !!child && activeTab === "milestones",
    queryFn: async () => (await api.get<ItemResponse<MilestoneCategory[]>>("/milestone-categories")).data.data ?? [],
  });

  const achievementTemplates = useQuery({
    queryKey: ["modal-badge-templates"],
    enabled: !!child && activeTab === "milestones",
    queryFn: async () => (await api.get<ItemResponse<AchievementTemplate[]>>("/achievement-templates")).data.data ?? [],
  });

  const childMilestones = useQuery({
    queryKey: ["modal-child-milestones", child?.id],
    enabled: !!child && activeTab === "milestones",
    queryFn: async () => (await api.get<ItemResponse<ChildMilestone[]>>(`/children/${child!.id}/milestones`)).data.data ?? [],
  });

  const childAchievements = useQuery({
    queryKey: ["modal-child-achievements", child?.id],
    enabled: !!child && activeTab === "milestones",
    queryFn: async () => (await api.get<ItemResponse<ChildAchievement[]>>(`/children/${child!.id}/achievements`)).data.data ?? [],
  });

  const existingMilestoneFor = (catId: number) => childMilestones.data?.find((m) => m.category_id === catId);
  const milestoneDraftFor = (catId: number) => {
    const ex = existingMilestoneFor(catId);
    return (
      milestonesDrafts[catId] ?? {
        progress: ex?.progress_pct ?? 0,
        status: ex?.status ?? "in_progress",
        description: ex?.description ?? "",
      }
    );
  };

  const saveMilestone = useMutation({
    mutationFn: async (catId: number) => {
      if (!child) return;
      const d = milestoneDraftFor(catId);
      return api.put(`/children/${child.id}/milestones`, {
        category_id: catId,
        progress_pct: d.progress,
        status: d.status,
        description: d.description,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["modal-child-milestones", child?.id] });
      setSuccessMsg("Milestone saved ✓");
      setErrorMsg("");
      setTimeout(() => setSuccessMsg(""), 3000);
    },
    onError: (err) => {
      setSuccessMsg("");
      setErrorMsg(errorMessage(err));
    },
  });

  const awardBadge = useMutation({
    mutationFn: async () => {
      if (!child || !awardTemplateId) return;
      return api.post(`/children/${child.id}/achievements`, {
        achievement_template_id: Number(awardTemplateId),
        awarded_date: awardDate,
        note: awardNote,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["modal-child-achievements", child?.id] });
      setAwardTemplateId("");
      setAwardNote("");
      setSuccessMsg("Badge awarded 🏆");
      setErrorMsg("");
      setTimeout(() => setSuccessMsg(""), 3000);
    },
    onError: (err) => {
      setSuccessMsg("");
      setErrorMsg(errorMessage(err));
    },
  });

  if (!child) return null;

  // Embedded on the detail page, the surrounding page already shows the child's
  // name and tabs, so the modal chrome and header would only repeat them.
  //
  // Built as an element rather than a component defined during render: a fresh
  // component identity each pass would remount the whole subtree on every
  // keystroke and wipe the form being typed into.
  const body = (
    <>
      {/* Custom Hub Header */}
      <div
        className={`${
          embedded ? "hidden" : ""
        } -mx-6 -mt-6 bg-slate-50 border-b border-slate-200 px-6 py-5 rounded-t-2xl flex items-center justify-between`}
      >
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-100 text-brand-800 font-extrabold shadow-sm border border-brand-200">
            {child.first_name[0]}{child.last_name[0]}
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-800 leading-tight">
              {child.first_name} {child.last_name}
            </h2>
            <div className="flex items-center gap-2 mt-1 text-[11px] font-bold text-slate-400">
              <span className="uppercase tracking-wider">Classroom:</span>
              <span className="text-slate-600 font-extrabold">{child.classroom?.name ?? "Unassigned"}</span>
            </div>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center rounded-xl bg-slate-200/60 p-0.5 border border-slate-200/40">
          <button
            onClick={() => setActiveTab("care")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeTab === "care"
                ? "bg-white text-brand-800 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <HeartPulse size={14} /> Care Log
          </button>
          <button
            onClick={() => setActiveTab("report")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeTab === "report"
                ? "bg-white text-brand-800 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileText size={14} /> Daily Report
          </button>
          <button
            onClick={() => setActiveTab("milestones")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeTab === "milestones"
                ? "bg-white text-brand-800 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Trophy size={14} /> Milestones
          </button>
        </div>
      </div>

      <div className="py-4 min-h-[380px] max-h-[580px] overflow-y-auto">
        {/* ----------------------------------------------------
            TAB 1: CARE LOGGING
            ---------------------------------------------------- */}
        {activeTab === "care" && (
          <div className="space-y-6">
            <div className="flex gap-2 border-b border-slate-100 pb-4 overflow-x-auto">
              {(
                [
                  { id: "diary", label: "Diary" },
                  { id: "meal", label: "Meal" },
                  { id: "sleep", label: "Sleep" },
                  { id: "diaper", label: "Diaper" },
                  { id: "hydration", label: "Hydration" },
                ] as { id: LogKind; label: string }[]
              ).map((k) => (
                <button
                  key={k.id}
                  onClick={() => setCareKind(k.id)}
                  type="button"
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                    careKind === k.id
                      ? "bg-brand-600 text-white shadow-sm"
                      : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>

            {careKind === "diary" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div>
                    <label className="label">Diary Event Type</label>
                    <select className="input" value={diaryType} onChange={(e) => setDiaryType(e.target.value)}>
                      {["activity", "meal", "sleep", "diaper", "note", "photo"].map((v) => (
                        <option key={v} value={v}>
                          {v.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Title</label>
                    <input
                      className="input"
                      placeholder="Title of event..."
                      value={diaryTitle}
                      onChange={(e) => setDiaryTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Details</label>
                    <textarea
                      className="input"
                      rows={3}
                      placeholder="Add details about the child's activity..."
                      value={diaryBody}
                      onChange={(e) => setDiaryBody(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <ImageUpload label="Add Attachment Photo" value={carePhoto} onChange={setCarePhoto} />
                </div>
              </div>
            )}

            {careKind === "meal" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Meal Type</label>
                      <select className="input" value={mealType} onChange={(e) => setMealType(e.target.value)}>
                        {["breakfast", "lunch", "snack", "dinner"].map((v) => (
                          <option key={v} value={v}>
                            {v.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Status</label>
                      <select className="input" value={mealStatus} onChange={(e) => setMealStatus(e.target.value)}>
                        {["ate_well", "ate_half", "ate_little", "didnt_eat"].map((v) => (
                          <option key={v} value={v}>
                            {v.replace(/_/g, " ").toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label">Note (optional)</label>
                    <input
                      className="input"
                      placeholder="E.g., finished all vegetables"
                      value={mealNote}
                      onChange={(e) => setMealNote(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <ImageUpload label="Meal Photo (optional)" value={carePhoto} onChange={setCarePhoto} />
                </div>
              </div>
            )}

            {careKind === "sleep" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Start Time</label>
                      <input
                        className="input"
                        type="datetime-local"
                        value={sleepStart}
                        onChange={(e) => setSleepStart(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">End Time</label>
                      <input
                        className="input"
                        type="datetime-local"
                        value={sleepEnd}
                        onChange={(e) => setSleepEnd(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">Sleep Quality: {sleepQuality}%</label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      className="w-full accent-brand-600"
                      value={sleepQuality}
                      onChange={(e) => setSleepQuality(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Deep Sleep (min)</label>
                    <input
                      className="input"
                      type="number"
                      placeholder="min"
                      value={sleepDeep}
                      onChange={(e) => setSleepDeep(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Light Sleep (min)</label>
                    <input
                      className="input"
                      type="number"
                      placeholder="min"
                      value={sleepLight}
                      onChange={(e) => setSleepLight(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Awake (min)</label>
                    <input
                      className="input"
                      type="number"
                      placeholder="min"
                      value={sleepAwake}
                      onChange={(e) => setSleepAwake(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Fell asleep in (min)</label>
                    <input
                      className="input"
                      type="number"
                      placeholder="min"
                      value={sleepFellAsleep}
                      onChange={(e) => setSleepFellAsleep(e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Mood After Nap</label>
                    <select className="input" value={sleepMood} onChange={(e) => setSleepMood(e.target.value)}>
                      {["happy", "calm", "fussy", "tired"].map((v) => (
                        <option key={v} value={v}>
                          {v.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {careKind === "diaper" && (
              <div className="space-y-4 max-w-lg">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label">Wetness</label>
                    <select className="input" value={diaperWetness} onChange={(e) => setDiaperWetness(e.target.value)}>
                      {["dry", "wet", "heavy"].map((v) => (
                        <option key={v} value={v}>
                          {v.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Stool</label>
                    <select className="input" value={diaperStool} onChange={(e) => setDiaperStool(e.target.value)}>
                      {["none", "hard", "normal", "soft", "loose", "diarrhea"].map((v) => (
                        <option key={v} value={v}>
                          {v.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Comfort</label>
                    <select className="input" value={diaperComfort} onChange={(e) => setDiaperComfort(e.target.value)}>
                      {["happy", "fussy"].map((v) => (
                        <option key={v} value={v}>
                          {v.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Diaper Notes</label>
                  <input
                    className="input"
                    placeholder="Diaper change notes..."
                    value={diaperNote}
                    onChange={(e) => setDiaperNote(e.target.value)}
                  />
                </div>
              </div>
            )}

            {careKind === "hydration" && (
              <div className="grid grid-cols-2 gap-4 max-w-lg">
                <div>
                  <label className="label">Cups Today: {hydrationCups}</label>
                  <input
                    type="range"
                    min={0}
                    max={12}
                    className="w-full accent-brand-600"
                    value={hydrationCups}
                    onChange={(e) => setHydrationCups(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="label">Hydration Rating</label>
                  <select className="input" value={hydrationRating} onChange={(e) => setHydrationRating(e.target.value)}>
                    {["good", "average", "needs_attention"].map((v) => (
                      <option key={v} value={v}>
                        {v.replace(/_/g, " ").toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                className="btn-primary"
                disabled={submitCare.isPending}
                onClick={() => submitCare.mutate()}
              >
                {submitCare.isPending ? "Logging..." : "Log Activity"}
              </button>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------
            TAB 2: DAILY REPORTS
            ---------------------------------------------------- */}
        {activeTab === "report" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 max-w-md bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <label className="label">Report Date</label>
                <input
                  type="date"
                  className="input"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                />
              </div>
            </div>

            {existingReport.isLoading ? (
              <div className="py-8 text-center text-xs font-bold text-slate-400">Loading daily report data...</div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label className="label">Day Summary</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={repSummary}
                    onChange={(e) => setRepSummary(e.target.value)}
                    placeholder="E.g. Emma had a great day today, played cooperatively and ate well."
                  />
                </div>

                <div className="space-y-3">
                  <label className="label text-slate-800">Child Moods today</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {MOODS.map((m) => (
                      <div key={m.key} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <label className="label !text-[11px] !mb-1">{m.label}</label>
                        <select
                          className="input !py-1.5 !px-2"
                          value={repMoods[m.key] ?? ""}
                          onChange={(e) => setRepMoods({ ...repMoods, [m.key]: e.target.value as ReportMood["rating"] })}
                        >
                          <option value="">—</option>
                          {MOOD_OPTIONS.map((o) => (
                            <option key={o} value={o}>
                              {o.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="label text-slate-800">Daily Development Metrics</label>
                  <div className="space-y-2.5">
                    {DIMENSIONS.map((d) => (
                      <div
                        key={d.key}
                        className="grid grid-cols-12 gap-3 items-center bg-slate-50/50 p-3 rounded-xl border border-slate-100/50"
                      >
                        <span className="col-span-12 sm:col-span-4 text-xs font-bold text-slate-650">{d.label}</span>
                        <select
                          className="input col-span-6 sm:col-span-3 !py-1.5"
                          value={repRatings[d.key]?.rating ?? ""}
                          onChange={(e) =>
                            setRepRatings({
                              ...repRatings,
                              [d.key]: {
                                rating: e.target.value as ReportRating["rating"],
                                note: repRatings[d.key]?.note ?? "",
                              },
                            })
                          }
                        >
                          <option value="">—</option>
                          {RATING_OPTIONS.map((o) => (
                            <option key={o} value={o}>
                              {o.replace(/_/g, " ").toUpperCase()}
                            </option>
                          ))}
                        </select>
                        <input
                          className="input col-span-6 sm:col-span-5 !py-1.5 text-xs"
                          placeholder="Note shown to parents..."
                          value={repRatings[d.key]?.note ?? ""}
                          onChange={(e) =>
                            setRepRatings({
                              ...repRatings,
                              [d.key]: { rating: repRatings[d.key]?.rating ?? "", note: e.target.value },
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Today's Highlight Text</label>
                    <textarea
                      className="input"
                      rows={3}
                      value={repHighlight}
                      onChange={(e) => setRepHighlight(e.target.value)}
                      placeholder="Describe a key achievement or moment from today..."
                    />
                  </div>
                  <div>
                    <ImageUpload label="Highlight Photo" value={repHighlightMedia} onChange={setRepHighlightMedia} />
                  </div>
                </div>

                <div>
                  <label className="label">Parent Support Tips (One per line)</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={repTips}
                    onChange={(e) => setRepTips(e.target.value)}
                    placeholder="Encourage hand washing before meals.&#10;Practice sharing spelling blocks."
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    className="btn-primary"
                    disabled={saveReport.isPending}
                    onClick={() => saveReport.mutate()}
                  >
                    {saveReport.isPending ? "Saving Report..." : "Save Daily Report"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ----------------------------------------------------
            TAB 3: MILESTONES & ACHIEVEMENTS
            ---------------------------------------------------- */}
        {activeTab === "milestones" && (
          <div className="space-y-8">
            {/* Skill categories assessment */}
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-2">
                <h3 className="text-sm font-extrabold text-slate-800">Child Skill Assessment</h3>
                <p className="text-[11px] font-bold text-slate-400 mt-0.5">Drag slider to assess progress in categories</p>
              </div>

              {milestoneCategories.isLoading || childMilestones.isLoading ? (
                <div className="py-8 text-center text-xs font-bold text-slate-400">Loading skills...</div>
              ) : (
                <div className="space-y-4">
                  {(milestoneCategories.data ?? []).map((cat) => {
                    const draft = milestoneDraftFor(cat.id);
                    return (
                      <div
                        key={cat.id}
                        className="grid grid-cols-12 gap-3 items-center border border-slate-100 p-4 rounded-2xl hover:bg-slate-50/50 transition-colors"
                      >
                        <div className="col-span-12 md:col-span-3">
                          <span
                            className="inline-block h-3.5 w-3.5 rounded-full border border-white shadow-sm mr-2"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="text-xs font-extrabold text-slate-700">{cat.name}</span>
                          <p className="text-[10px] font-medium text-slate-400 mt-0.5 leading-tight">{cat.description}</p>
                        </div>

                        <div className="col-span-6 md:col-span-3 flex items-center gap-2">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            className="w-full accent-brand-600"
                            value={draft.progress}
                            onChange={(e) =>
                              setMilestonesDrafts({
                                ...milestonesDrafts,
                                [cat.id]: { ...draft, progress: Number(e.target.value) },
                              })
                            }
                          />
                          <span className="w-10 text-right text-xs font-bold text-slate-650">{draft.progress}%</span>
                        </div>

                        <select
                          className="input col-span-6 md:col-span-2 !py-1.5 !px-2 text-xs"
                          value={draft.status}
                          onChange={(e) =>
                            setMilestonesDrafts({
                              ...milestonesDrafts,
                              [cat.id]: { ...draft, status: e.target.value },
                            })
                          }
                        >
                          {["not_started", "in_progress", "achieved"].map((st) => (
                            <option key={st} value={st}>
                              {st.replace(/_/g, " ").toUpperCase()}
                            </option>
                          ))}
                        </select>

                        <input
                          className="input col-span-10 md:col-span-3 !py-1.5 text-xs"
                          placeholder="Note for parents..."
                          value={draft.description}
                          onChange={(e) =>
                            setMilestonesDrafts({
                              ...milestonesDrafts,
                              [cat.id]: { ...draft, description: e.target.value },
                            })
                          }
                        />

                        <button
                          className="btn-secondary col-span-2 md:col-span-1 !py-1.5 !px-2 !text-xs"
                          disabled={saveMilestone.isPending}
                          onClick={() => saveMilestone.mutate(cat.id)}
                        >
                          Save
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Award an Achievement */}
            <div className="space-y-4 border-t border-slate-100 pt-6">
              <div className="border-b border-slate-100 pb-2">
                <h3 className="text-sm font-extrabold text-slate-800">Award Achievements & Badges</h3>
                <p className="text-[11px] font-bold text-slate-400 mt-0.5">Recognize exceptional behavior</p>
              </div>

              {achievementTemplates.isLoading || childAchievements.isLoading ? (
                <div className="py-8 text-center text-xs font-bold text-slate-400">Loading template data...</div>
              ) : (
                <div className="space-y-4">
                  {/* Quick Award Form */}
                  <div className="grid grid-cols-12 gap-3 items-end bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="col-span-12 sm:col-span-4">
                      <label className="label !text-[11px]">Badge Template</label>
                      <select
                        className="input !py-1.5"
                        value={awardTemplateId}
                        onChange={(e) => setAwardTemplateId(e.target.value)}
                      >
                        <option value="">— Select Badge —</option>
                        {(achievementTemplates.data ?? []).map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-12 sm:col-span-3">
                      <label className="label !text-[11px]">Award Date</label>
                      <input
                        type="date"
                        className="input !py-1.5"
                        value={awardDate}
                        onChange={(e) => setAwardDate(e.target.value)}
                      />
                    </div>

                    <div className="col-span-12 sm:col-span-3">
                      <label className="label !text-[11px]">Teacher note (optional)</label>
                      <input
                        type="text"
                        className="input !py-1.5"
                        placeholder="E.g., Kind helper at cleaning"
                        value={awardNote}
                        onChange={(e) => setAwardNote(e.target.value)}
                      />
                    </div>

                    <button
                      className="btn-primary col-span-12 sm:col-span-2 !py-2"
                      disabled={!awardTemplateId || awardBadge.isPending}
                      onClick={() => awardBadge.mutate()}
                    >
                      {awardBadge.isPending ? "Awarding..." : "Award 🏆"}
                    </button>
                  </div>

                  {/* Awarded Badges Display */}
                  <div className="flex flex-wrap gap-2.5 pt-2">
                    {(childAchievements.data ?? []).map((a) => (
                      <span
                        key={a.id}
                        style={{
                          backgroundColor: `${a.template?.color || "#f59e0b"}15`,
                          color: a.template?.color || "#b45309",
                          borderColor: `${a.template?.color || "#f59e0b"}30`,
                        }}
                        className="badge border px-3 py-1 text-xs font-bold flex items-center gap-1.5"
                        title={a.note}
                      >
                        🏆 <span className="font-extrabold">{a.template?.title}</span>
                        <span className="text-[10px] opacity-75 font-semibold">· {a.awarded_date.slice(0, 10)}</span>
                      </span>
                    ))}
                    {(childAchievements.data ?? []).length === 0 && (
                      <span className="text-xs text-slate-400 font-semibold italic">No badges awarded yet</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Global Modal Messages */}
      {(successMsg || errorMsg) && (
        <div className="mt-4 p-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
          {successMsg && <span className="text-brand-700 bg-brand-50 rounded-lg px-3 py-1.5">{successMsg}</span>}
          {errorMsg && <span className="text-rose-700 bg-rose-50 rounded-lg px-3 py-1.5">{errorMsg}</span>}
        </div>
      )}
    </>
  );

  if (embedded) return <div className="card p-6">{body}</div>;
  return (
    <Modal open={open} title="" onClose={onClose} wide>
      {body}
    </Modal>
  );
}
