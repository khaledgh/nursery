import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api, errorMessage } from "../../lib/api";
import { Modal } from "../../components/Modal";
import { ImageUpload } from "../../components/ImageUpload";
import { ClassroomPicker } from "../../components/Pickers";
import { WeekPicker, addDays, startOfWeek, toISODate } from "../../components/WeekPicker";
import type { ItemResponse, Media, WeeklyMenu } from "../../types/api";

const MEAL_TYPES = ["breakfast", "lunch", "snack", "dinner"] as const;

interface CellDraft {
  date: string;
  meal_type: string;
  dish_name: string;
  items: string;
  is_balanced: boolean;
  image: Media | null;
}

/** Weekly menu planner: one grid per classroom, cells upsert via PUT /classrooms/:id/menu. */
export function MenusPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [classroomId, setClassroomId] = useState("");
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const [draft, setDraft] = useState<CellDraft | null>(null);
  const [error, setError] = useState("");

  const weekISO = toISODate(week);
  const menu = useQuery({
    queryKey: ["menu", classroomId, weekISO],
    enabled: !!classroomId,
    queryFn: async () => {
      const res = await api.get<ItemResponse<WeeklyMenu[]>>(`/classrooms/${classroomId}/menu`, {
        params: { week: weekISO },
      });
      return res.data.data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (d: CellDraft) =>
      api.put(`/classrooms/${classroomId}/menu`, {
        date: d.date,
        meal_type: d.meal_type,
        dish_name: d.dish_name,
        items: d.items.split(",").map((s) => s.trim()).filter(Boolean),
        is_balanced: d.is_balanced,
        image_id: d.image?.id ?? null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["menu", classroomId] });
      setDraft(null);
      setError("");
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const cellFor = (date: string, mealType: string) =>
    (menu.data ?? []).find((m) => m.date.slice(0, 10) === date && m.meal_type === mealType);

  const openCell = (date: string, mealType: string) => {
    const existing = cellFor(date, mealType);
    setDraft({
      date,
      meal_type: mealType,
      dish_name: existing?.dish_name ?? "",
      items: (existing?.items ?? []).join(", "),
      is_balanced: existing?.is_balanced ?? true,
      image: existing?.image ?? null,
    });
    setError("");
  };

  const ratingCounts = (m: WeeklyMenu | undefined) => {
    if (!m?.ratings?.length) return null;
    const c = { eats: 0, sometimes: 0, doesnt_eat: 0 };
    for (const r of m.ratings) c[r.rating] += 1;
    return c;
  };

  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("nav.menus")}</h1>
        <div className="flex items-center gap-3">
          <div className="w-56">
            <ClassroomPicker value={classroomId} onChange={setClassroomId} />
          </div>
          <WeekPicker week={week} onChange={setWeek} />
        </div>
      </div>

      {!classroomId ? (
        <div className="card p-10 text-center text-sm text-slate-500">Pick a classroom to plan its menu.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-3">Meal</th>
                {days.map((d) => (
                  <th key={d.toISOString()} className="px-3 py-3 text-center">
                    {d.toLocaleDateString(undefined, { weekday: "short" })}
                    <div className="font-normal">{d.getDate()}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MEAL_TYPES.map((meal) => (
                <tr key={meal} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium capitalize">{meal}</td>
                  {days.map((d) => {
                    const iso = toISODate(d);
                    const cell = cellFor(iso, meal);
                    const counts = ratingCounts(cell);
                    return (
                      <td key={iso} className="px-1.5 py-1.5 align-top">
                        <button
                          type="button"
                          onClick={() => openCell(iso, meal)}
                          className={`min-h-16 w-full rounded-lg border p-2 text-left text-xs transition-colors ${
                            cell
                              ? "border-brand-200 bg-brand-50 hover:border-brand-400"
                              : "border-dashed border-slate-200 text-slate-400 hover:border-brand-300 hover:text-brand-500"
                          }`}
                        >
                          {cell ? (
                            <>
                              <div className="font-medium text-slate-800">{cell.dish_name}</div>
                              {cell.is_balanced && <div className="mt-0.5 text-[10px] text-emerald-600">✓ balanced</div>}
                              {counts && (
                                <div className="mt-1 text-[10px] text-slate-500">
                                  👍{counts.eats} 〜{counts.sometimes} 👎{counts.doesnt_eat}
                                </div>
                              )}
                            </>
                          ) : (
                            "+ add"
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!draft}
        title={draft ? `${draft.meal_type} — ${draft.date}` : ""}
        onClose={() => setDraft(null)}
      >
        {draft && (
          <div className="space-y-3">
            <div>
              <label className="label">Dish name</label>
              <input
                className="input"
                value={draft.dish_name}
                onChange={(e) => setDraft({ ...draft, dish_name: e.target.value })}
                placeholder="Grilled Chicken with Rice"
              />
            </div>
            <div>
              <label className="label">Items (comma separated)</label>
              <input
                className="input"
                value={draft.items}
                onChange={(e) => setDraft({ ...draft, items: e.target.value })}
                placeholder="Steamed broccoli, Carrots, Fresh fruit: Banana"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.is_balanced}
                onChange={(e) => setDraft({ ...draft, is_balanced: e.target.checked })}
              />
              Balanced meal
            </label>
            <ImageUpload label="Photo" value={draft.image} onChange={(m) => setDraft({ ...draft, image: m })} />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={() => setDraft(null)}>
                {t("common.cancel")}
              </button>
              <button
                className="btn-primary"
                disabled={!draft.dish_name || save.isPending}
                onClick={() => save.mutate(draft)}
              >
                {save.isPending ? t("common.saving") : t("common.save")}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
