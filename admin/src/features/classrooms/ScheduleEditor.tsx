import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import type { ItemResponse, ScheduleItem } from "../../types/api";

interface RowDraft {
  weekday: number;
  starts_at: string;
  title: string;
  description: string;
  icon: string;
  color: string;
}

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

/** Weekly routine editor ("Circle Time 09:00") for one classroom. */
export function ScheduleEditor({ classroomId }: { classroomId: number }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [rows, setRows] = useState<RowDraft[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const schedule = useQuery({
    queryKey: ["classroom-schedule", classroomId],
    queryFn: async () =>
      (await api.get<ItemResponse<ScheduleItem[]>>(`/classrooms/${classroomId}/schedule`)).data.data ?? [],
  });

  useEffect(() => {
    setRows(
      (schedule.data ?? []).map((i) => ({
        weekday: i.weekday,
        starts_at: i.starts_at,
        title: i.title,
        description: i.description,
        icon: i.icon,
        color: i.color,
      })),
    );
  }, [schedule.data]);

  const save = useMutation({
    mutationFn: async () =>
      api.put(`/classrooms/${classroomId}/schedule`, {
        items: rows
          .filter((r) => r.title.trim() && r.starts_at)
          .map((r, idx) => ({ ...r, title: r.title.trim(), sort: idx })),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["classroom-schedule", classroomId] });
      setMessage("Saved ✓");
      setError("");
      setTimeout(() => setMessage(""), 2500);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const update = (index: number, patch: Partial<RowDraft>) =>
    setRows(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        The daily routine parents see on Home ("Today at a Glance") and the Classroom screen.
      </p>
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-12 items-center gap-2">
          <select
            className="input col-span-2"
            value={row.weekday}
            onChange={(e) => update(index, { weekday: Number(e.target.value) })}
          >
            {WEEKDAYS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <input
            className="input col-span-2"
            type="time"
            value={row.starts_at}
            onChange={(e) => update(index, { starts_at: e.target.value })}
          />
          <input
            className="input col-span-3"
            placeholder="Circle Time"
            value={row.title}
            onChange={(e) => update(index, { title: e.target.value })}
          />
          <input
            className="input col-span-3"
            placeholder="Stories, songs and greetings"
            value={row.description}
            onChange={(e) => update(index, { description: e.target.value })}
          />
          <input
            className="input col-span-1"
            placeholder="icon"
            value={row.icon}
            onChange={(e) => update(index, { icon: e.target.value })}
          />
          <button
            type="button"
            className="col-span-1 text-slate-400 hover:text-red-600"
            onClick={() => setRows(rows.filter((_, i) => i !== index))}
            aria-label="Remove"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn-secondary"
        onClick={() =>
          setRows([...rows, { weekday: 1, starts_at: "09:00", title: "", description: "", icon: "", color: "" }])
        }
      >
        <Plus size={16} /> Add slot
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-emerald-600">{message}</p>}
      <div className="flex justify-end">
        <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? t("common.saving") : t("common.save")}
        </button>
      </div>
    </div>
  );
}
