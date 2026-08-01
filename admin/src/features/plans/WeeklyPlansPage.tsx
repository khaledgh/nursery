import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Copy } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import { ClassroomPicker } from "../../components/Pickers";
import { WeekPicker, startOfWeek, toISODate } from "../../components/WeekPicker";
import type { ItemResponse, PlanItemKind, WeeklyPlan } from "../../types/api";

interface ItemDraft {
  kind: PlanItemKind;
  day: number | null;
  title: string;
  description: string;
  icon: string;
  color: string;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// JS weekday for Mon..Sun order above (Go time.Weekday: 0=Sunday).
const WEEKDAY_VALUES = [1, 2, 3, 4, 5, 6, 0];

const SECTIONS: { kind: PlanItemKind; title: string; hint: string }[] = [
  { kind: "learning_area", title: "What we're learning this week", hint: "Language, Cognitive, Creative, Social…" },
  { kind: "activity", title: "Activities this week", hint: "One per day — Story Time, Painting Fun…" },
  { kind: "gain", title: "What your child will gain", hint: "Confidence, Curiosity, Kindness, Focus…" },
];

const PRESET_COLORS = ["#5b9c34", "#8fc464", "#f59e0b", "#3b82f6", "#6366f1", "#8b5cf6", "#10b981", "#ef4444", "#ec4899"];

/** Curated weekly learning plan editor (drives the parent app's Overview tab). */
export function WeeklyPlansPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [classroomId, setClassroomId] = useState("");
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const [note, setNote] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const weekISO = toISODate(week);
  const plan = useQuery({
    queryKey: ["weekly-plan", classroomId, weekISO],
    enabled: !!classroomId,
    queryFn: async () => {
      const res = await api.get<ItemResponse<WeeklyPlan | null>>(`/classrooms/${classroomId}/weekly-plan`, {
        params: { week: weekISO },
      });
      return res.data.data;
    },
  });

  // Sync the editable draft whenever a different plan loads.
  useEffect(() => {
    setNote(plan.data?.note ?? "");
    setItems(
      (plan.data?.items ?? []).map((i) => ({
        kind: i.kind,
        day: i.day,
        title: i.title,
        description: i.description,
        icon: i.icon,
        color: i.color,
      })),
    );
    setMessage("");
    setError("");
  }, [plan.data]);

  const save = useMutation({
    mutationFn: async () =>
      api.put(`/classrooms/${classroomId}/weekly-plan`, {
        week: weekISO,
        note,
        items: items
          .filter((i) => i.title.trim())
          .map((i, idx) => ({ ...i, title: i.title.trim(), sort: idx })),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["weekly-plan", classroomId] });
      setMessage("Saved ✓");
      setError("");
      setTimeout(() => setMessage(""), 2500);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const copyPreviousPlan = useMutation({
    mutationFn: async () => {
      const prevWeek = new Date(week.getTime() - 7 * 24 * 60 * 60 * 1000); 
      const prevWeekISO = toISODate(startOfWeek(prevWeek));
      const res = await api.get<ItemResponse<WeeklyPlan | null>>(`/classrooms/${classroomId}/weekly-plan`, {
        params: { week: prevWeekISO },
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      if (data) {
        setNote(data.note ?? "");
        setItems(
          (data.items ?? []).map((i) => ({
            kind: i.kind,
            day: i.day,
            title: i.title,
            description: i.description,
            icon: i.icon,
            color: i.color,
          })),
        );
        setMessage("Copied previous week's plan! Click 'Save' to apply changes ✓");
        setError("");
        setTimeout(() => setMessage(""), 4000);
      } else {
        setError("No weekly plan found for the previous week.");
        setTimeout(() => setError(""), 3000);
      }
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const addItem = (kind: PlanItemKind) =>
    setItems([...items, { kind, day: kind === "activity" ? 1 : null, title: "", description: "", icon: "sparkles", color: "#5b9c34" }]);

  const updateItem = (index: number, patch: Partial<ItemDraft>) =>
    setItems(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">{t("nav.plans")}</h1>
          <p className="text-sm font-semibold text-slate-400 mt-1">Plan lessons, activities, and targets for classrooms.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!classroomId || copyPreviousPlan.isPending}
            onClick={() => copyPreviousPlan.mutate()}
            className="btn-secondary text-brand-700 font-bold flex items-center gap-1.5"
            title="Import all items and notes from last week's plan"
          >
            <Copy size={15} />
            {copyPreviousPlan.isPending ? "Copying..." : "Copy Last Week"}
          </button>
          <div className="w-56">
            <ClassroomPicker value={classroomId} onChange={setClassroomId} />
          </div>
          <WeekPicker week={week} onChange={setWeek} />
        </div>
      </div>

      {!classroomId ? (
        <div className="card p-12 text-center text-sm font-bold text-slate-400">
          Pick a classroom from the dropdown to start managing its weekly plan.
        </div>
      ) : (
        <>
          {SECTIONS.map((section) => (
            <div key={section.kind} className="card space-y-4 p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-[15px] font-extrabold text-slate-800">{section.title}</h2>
                  <p className="text-[11px] font-bold text-slate-400 mt-0.5">{section.hint}</p>
                </div>
                <button className="btn-primary !py-2" onClick={() => addItem(section.kind)} type="button">
                  <Plus size={16} /> Add
                </button>
              </div>
              
              <div className="space-y-3">
                {items.map((item, index) =>
                  item.kind !== section.kind ? null : (
                    <div key={index} className="grid grid-cols-12 items-center gap-2 bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">
                      {item.kind === "activity" && (
                        <select
                          className="input col-span-2 !py-1.5"
                          value={item.day ?? 1}
                          onChange={(e) => updateItem(index, { day: Number(e.target.value) })}
                        >
                          {WEEKDAYS.map((d, i) => (
                            <option key={d} value={WEEKDAY_VALUES[i]}>
                              {d}
                            </option>
                          ))}
                        </select>
                      )}
                      
                      <input
                        className={`input !py-1.5 ${item.kind === "activity" ? "col-span-3" : "col-span-4"}`}
                        placeholder="Title"
                        value={item.title}
                        onChange={(e) => updateItem(index, { title: e.target.value })}
                      />
                      
                      <input
                        className="input col-span-2 !py-1.5"
                        placeholder="Description (optional)"
                        value={item.description}
                        onChange={(e) => updateItem(index, { description: e.target.value })}
                      />
                      
                      <select
                        className="input col-span-2 !py-1.5 text-xs font-bold text-slate-650"
                        value={item.icon}
                        onChange={(e) => updateItem(index, { icon: e.target.value })}
                      >
                        <option value="">— Icon —</option>
                        <option value="sparkles">✨ Learning / General</option>
                        <option value="book">📖 Reading / Language</option>
                        <option value="color-palette">🎨 Art & Crafts</option>
                        <option value="musical-notes">🎵 Music & Dance</option>
                        <option value="sunny">☀️ Outdoor Play</option>
                        <option value="restaurant">🍴 Meal / Kitchen</option>
                        <option value="moon">🌙 Nap / Rest</option>
                        <option value="trophy">🏆 Achievement</option>
                        <option value="happy">😊 Social / Play</option>
                        <option value="heart">❤️ Care & Health</option>
                        <option value="star">⭐ Special Event</option>
                        <option value="bulb">💡 Science / Cognitive</option>
                        <option value="fitness">🏃 Physical / Sports</option>
                      </select>

                      <div className="col-span-2 flex items-center justify-center gap-1.5 flex-wrap">
                        {PRESET_COLORS.map((clr) => (
                          <button
                            key={clr}
                            type="button"
                            style={{ backgroundColor: clr }}
                            className={`h-4.5 w-4.5 rounded-full border border-white shadow-sm transition-transform shrink-0 ${
                              item.color === clr ? "scale-125 ring-1 ring-slate-400" : "hover:scale-110"
                            }`}
                            onClick={() => updateItem(index, { color: clr })}
                            title={clr}
                          />
                        ))}
                        <input
                          type="color"
                          className="h-5.5 w-5.5 cursor-pointer rounded-full border border-slate-200 p-0 overflow-hidden shrink-0"
                          value={item.color || "#7c3aed"}
                          onChange={(e) => updateItem(index, { color: e.target.value })}
                          title="Custom Color"
                        />
                      </div>

                      <div className="col-span-1 flex justify-end">
                        <button
                          type="button"
                          className="text-slate-450 hover:text-red-600 transition-colors p-1.5 rounded-lg hover:bg-red-50"
                          onClick={() => removeItem(index)}
                          aria-label="Remove"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ),
                )}
                {items.filter((i) => i.kind === section.kind).length === 0 && (
                  <p className="text-xs text-slate-400 font-semibold italic text-center py-2">No items added to this section yet.</p>
                )}
              </div>
            </div>
          ))}

          <div className="card space-y-3 p-6">
            <h2 className="text-[15px] font-extrabold text-slate-800">A note from the teachers</h2>
            <textarea
              className="input"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="We're so excited for another week of learning, laughter and growth!"
            />
          </div>

          {error && <p className="text-sm font-bold text-red-650 bg-red-50/50 border border-red-100 rounded-xl px-4 py-2.5">{error}</p>}
          {message && <p className="text-sm font-bold text-brand-750 bg-brand-50/50 border border-brand-100 rounded-xl px-4 py-2.5">{message}</p>}
          
          <div className="flex justify-end pt-4">
            <button className="btn-primary !px-8" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? t("common.saving") : "Save Changes"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
