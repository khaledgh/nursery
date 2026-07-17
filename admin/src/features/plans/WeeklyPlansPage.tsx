import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
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

  const addItem = (kind: PlanItemKind) =>
    setItems([...items, { kind, day: kind === "activity" ? 1 : null, title: "", description: "", icon: "", color: "#7c3aed" }]);

  const updateItem = (index: number, patch: Partial<ItemDraft>) =>
    setItems(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("nav.plans")}</h1>
        <div className="flex items-center gap-3">
          <div className="w-56">
            <ClassroomPicker value={classroomId} onChange={setClassroomId} />
          </div>
          <WeekPicker week={week} onChange={setWeek} />
        </div>
      </div>

      {!classroomId ? (
        <div className="card p-10 text-center text-sm text-slate-500">Pick a classroom to edit its weekly plan.</div>
      ) : (
        <>
          {SECTIONS.map((section) => (
            <div key={section.kind} className="card space-y-3 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">{section.title}</h2>
                  <p className="text-xs text-slate-500">{section.hint}</p>
                </div>
                <button className="btn-secondary" onClick={() => addItem(section.kind)} type="button">
                  <Plus size={16} /> Add
                </button>
              </div>
              {items.map((item, index) =>
                item.kind !== section.kind ? null : (
                  <div key={index} className="grid grid-cols-12 items-start gap-2">
                    {item.kind === "activity" && (
                      <select
                        className="input col-span-2"
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
                      className={`input ${item.kind === "activity" ? "col-span-3" : "col-span-4"}`}
                      placeholder="Title"
                      value={item.title}
                      onChange={(e) => updateItem(index, { title: e.target.value })}
                    />
                    <input
                      className="input col-span-4"
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateItem(index, { description: e.target.value })}
                    />
                    <input
                      className="input col-span-2"
                      placeholder="Icon (e.g. book)"
                      value={item.icon}
                      onChange={(e) => updateItem(index, { icon: e.target.value })}
                    />
                    <div className="col-span-1 flex items-center gap-1">
                      <input
                        type="color"
                        className="h-9 w-9 cursor-pointer rounded border border-slate-200"
                        value={item.color || "#7c3aed"}
                        onChange={(e) => updateItem(index, { color: e.target.value })}
                      />
                      <button
                        type="button"
                        className="text-slate-400 hover:text-red-600"
                        onClick={() => removeItem(index)}
                        aria-label="Remove"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ),
              )}
            </div>
          ))}

          <div className="card space-y-3 p-5">
            <h2 className="font-semibold">A note from the teachers</h2>
            <textarea
              className="input"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="We're so excited for another week of learning, laughter and growth!"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-emerald-600">{message}</p>}
          <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? t("common.saving") : t("common.save")}
          </button>
        </>
      )}
    </div>
  );
}
