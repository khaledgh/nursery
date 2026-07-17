import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import { Modal } from "../../components/Modal";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ChildPicker } from "../../components/Pickers";
import { toISODate } from "../../components/WeekPicker";
import type {
  AchievementTemplate,
  ChildAchievement,
  ChildMilestone,
  ItemResponse,
  MilestoneCategory,
} from "../../types/api";

type Tab = "categories" | "templates" | "assess";

/** Skill categories, achievement badge templates, and per-child assessments. */
export function MilestonesPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("assess");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("nav.milestones")}</h1>
      <div className="flex gap-2">
        {(
          [
            { id: "assess", label: "Assess children" },
            { id: "categories", label: "Skill categories" },
            { id: "templates", label: "Achievement badges" },
          ] as { id: Tab; label: string }[]
        ).map((x) => (
          <button key={x.id} type="button" className={tab === x.id ? "btn-primary" : "btn-secondary"} onClick={() => setTab(x.id)}>
            {x.label}
          </button>
        ))}
      </div>
      {tab === "categories" && <CategoriesTab />}
      {tab === "templates" && <TemplatesTab />}
      {tab === "assess" && <AssessTab />}
    </div>
  );
}

interface CategoryDraft {
  id?: number;
  name: string;
  description: string;
  color: string;
  icon: string;
}

function CategoriesTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<CategoryDraft | null>(null);
  const [deleting, setDeleting] = useState<MilestoneCategory | null>(null);
  const [error, setError] = useState("");

  const cats = useQuery({
    queryKey: ["milestone-categories"],
    queryFn: async () => (await api.get<ItemResponse<MilestoneCategory[]>>("/milestone-categories")).data.data ?? [],
  });

  const save = useMutation({
    mutationFn: async (d: CategoryDraft) =>
      d.id ? api.put(`/milestone-categories/${d.id}`, d) : api.post("/milestone-categories", d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["milestone-categories"] });
      setEditing(null);
      setError("");
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`/milestone-categories/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["milestone-categories"] });
      setDeleting(null);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">Skill areas shown on the parent app's Milestones screen.</p>
        <button
          className="btn-primary"
          onClick={() => setEditing({ name: "", description: "", color: "#7c3aed", icon: "" })}
        >
          <Plus size={16} /> {t("common.create")}
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(cats.data ?? []).map((c) => (
          <div key={c.id} className="flex items-start justify-between rounded-xl border border-slate-200 p-4">
            <div className="flex items-start gap-3">
              <span
                className="mt-0.5 inline-block h-8 w-8 rounded-full"
                style={{ backgroundColor: c.color || "#7c3aed" }}
                title={c.icon}
              />
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-slate-500">{c.description}</div>
                {c.icon && <div className="mt-1 text-[10px] text-slate-400">icon: {c.icon}</div>}
              </div>
            </div>
            <div className="flex gap-1">
              <button className="text-slate-400 hover:text-brand-600" onClick={() => setEditing({ ...c })} aria-label="Edit">
                <Pencil size={15} />
              </button>
              <button className="text-slate-400 hover:text-red-600" onClick={() => setDeleting(c)} aria-label="Delete">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {!cats.data?.length && <p className="text-sm text-slate-500">{t("common.noData")}</p>}
      </div>

      <Modal open={!!editing} title={editing?.id ? "Edit category" : "New category"} onClose={() => setEditing(null)}>
        {editing && (
          <div className="space-y-3">
            <input
              className="input"
              placeholder="Name (e.g. Communication)"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
            <input
              className="input"
              placeholder="Description (e.g. Uses simple sentences and new words)"
              value={editing.description}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className="input"
                placeholder="Icon (e.g. chatbubbles)"
                value={editing.icon}
                onChange={(e) => setEditing({ ...editing, icon: e.target.value })}
              />
              <input
                type="color"
                className="h-10 w-full cursor-pointer rounded-lg border border-slate-200"
                value={editing.color || "#7c3aed"}
                onChange={(e) => setEditing({ ...editing, color: e.target.value })}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={() => setEditing(null)}>
                {t("common.cancel")}
              </button>
              <button className="btn-primary" disabled={!editing.name || save.isPending} onClick={() => save.mutate(editing)}>
                {save.isPending ? t("common.saving") : t("common.save")}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title={`Delete "${deleting?.name}"?`}
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function TemplatesTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ title: "", description: "", icon: "", color: "#7c3aed" });
  const [error, setError] = useState("");

  const templates = useQuery({
    queryKey: ["achievement-templates"],
    queryFn: async () => (await api.get<ItemResponse<AchievementTemplate[]>>("/achievement-templates")).data.data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => api.post("/achievement-templates", draft),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["achievement-templates"] });
      setCreating(false);
      setDraft({ title: "", description: "", icon: "", color: "#7c3aed" });
      setError("");
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">Badge templates teachers can award (Kind Helper, Super Listener…).</p>
        <button className="btn-primary" onClick={() => setCreating(true)}>
          <Plus size={16} /> {t("common.create")}
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(templates.data ?? []).map((tp) => (
          <div key={tp.id} className="rounded-xl border border-slate-200 p-4 text-center">
            <span className="mx-auto block h-10 w-10 rounded-full" style={{ backgroundColor: tp.color || "#7c3aed" }} />
            <div className="mt-2 font-medium">{tp.title}</div>
            <div className="text-xs text-slate-500">{tp.description}</div>
          </div>
        ))}
        {!templates.data?.length && <p className="text-sm text-slate-500">{t("common.noData")}</p>}
      </div>

      <Modal open={creating} title="New achievement badge" onClose={() => setCreating(false)}>
        <div className="space-y-3">
          <input
            className="input"
            placeholder="Title (e.g. Kind Helper)"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
          <input
            className="input"
            placeholder="Description (e.g. Helped clean up toys without being asked)"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              className="input"
              placeholder="Icon (e.g. thumbs-up)"
              value={draft.icon}
              onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
            />
            <input
              type="color"
              className="h-10 w-full cursor-pointer rounded-lg border border-slate-200"
              value={draft.color}
              onChange={(e) => setDraft({ ...draft, color: e.target.value })}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setCreating(false)}>
              {t("common.cancel")}
            </button>
            <button className="btn-primary" disabled={!draft.title || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function AssessTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [childId, setChildId] = useState("");
  const [drafts, setDrafts] = useState<Record<number, { progress: number; status: string; description: string }>>({});
  const [awardTplId, setAwardTplId] = useState("");
  const [awardDate, setAwardDate] = useState(() => toISODate(new Date()));
  const [awardNote, setAwardNote] = useState("");
  const [error, setError] = useState("");

  const cats = useQuery({
    queryKey: ["milestone-categories"],
    queryFn: async () => (await api.get<ItemResponse<MilestoneCategory[]>>("/milestone-categories")).data.data ?? [],
  });
  const templates = useQuery({
    queryKey: ["achievement-templates"],
    queryFn: async () => (await api.get<ItemResponse<AchievementTemplate[]>>("/achievement-templates")).data.data ?? [],
  });
  const milestones = useQuery({
    queryKey: ["milestones", childId],
    enabled: !!childId,
    queryFn: async () => (await api.get<ItemResponse<ChildMilestone[]>>(`/children/${childId}/milestones`)).data.data ?? [],
  });
  const achievements = useQuery({
    queryKey: ["achievements", childId],
    enabled: !!childId,
    queryFn: async () =>
      (await api.get<ItemResponse<ChildAchievement[]>>(`/children/${childId}/achievements`)).data.data ?? [],
  });

  const existingFor = (categoryID: number) => milestones.data?.find((m) => m.category_id === categoryID);
  const draftFor = (categoryID: number) => {
    const ex = existingFor(categoryID);
    return (
      drafts[categoryID] ?? {
        progress: ex?.progress_pct ?? 0,
        status: ex?.status ?? "in_progress",
        description: ex?.description ?? "",
      }
    );
  };

  const assess = useMutation({
    mutationFn: async (categoryID: number) => {
      const d = draftFor(categoryID);
      return api.put(`/children/${childId}/milestones`, {
        category_id: categoryID,
        progress_pct: d.progress,
        status: d.status,
        description: d.description,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["milestones", childId] });
      setError("");
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const award = useMutation({
    mutationFn: async () =>
      api.post(`/children/${childId}/achievements`, {
        achievement_template_id: Number(awardTplId),
        awarded_date: awardDate,
        note: awardNote,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["achievements", childId] });
      setAwardTplId("");
      setAwardNote("");
      setError("");
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <div className="space-y-4">
      <div className="card max-w-md p-5">
        <label className="label">Child</label>
        <ChildPicker value={childId} onChange={setChildId} />
      </div>

      {childId && (
        <>
          <div className="card space-y-4 p-5">
            <h2 className="font-semibold">Skill progress</h2>
            {(cats.data ?? []).map((c) => {
              const d = draftFor(c.id);
              return (
                <div key={c.id} className="grid grid-cols-12 items-center gap-3 border-b border-slate-100 pb-3 last:border-0">
                  <div className="col-span-3">
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-xs text-slate-500">{c.description}</div>
                  </div>
                  <div className="col-span-3 flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      className="w-full"
                      value={d.progress}
                      onChange={(e) => setDrafts({ ...drafts, [c.id]: { ...d, progress: Number(e.target.value) } })}
                    />
                    <span className="w-10 text-right text-sm">{d.progress}%</span>
                  </div>
                  <select
                    className="input col-span-2"
                    value={d.status}
                    onChange={(e) => setDrafts({ ...drafts, [c.id]: { ...d, status: e.target.value } })}
                  >
                    {["not_started", "in_progress", "achieved"].map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input col-span-3"
                    placeholder="Note for parents"
                    value={d.description}
                    onChange={(e) => setDrafts({ ...drafts, [c.id]: { ...d, description: e.target.value } })}
                  />
                  <button
                    className="btn-secondary col-span-1"
                    disabled={assess.isPending}
                    onClick={() => assess.mutate(c.id)}
                  >
                    {t("common.save")}
                  </button>
                </div>
              );
            })}
            {!cats.data?.length && (
              <p className="text-sm text-slate-500">Create skill categories first (Skill categories tab).</p>
            )}
          </div>

          <div className="card space-y-3 p-5">
            <h2 className="font-semibold">Award an achievement</h2>
            <div className="grid grid-cols-12 gap-3">
              <select className="input col-span-4" value={awardTplId} onChange={(e) => setAwardTplId(e.target.value)}>
                <option value="">— badge —</option>
                {(templates.data ?? []).map((tp) => (
                  <option key={tp.id} value={tp.id}>
                    {tp.title}
                  </option>
                ))}
              </select>
              <input
                className="input col-span-3"
                type="date"
                value={awardDate}
                onChange={(e) => setAwardDate(e.target.value)}
              />
              <input
                className="input col-span-3"
                placeholder="Note"
                value={awardNote}
                onChange={(e) => setAwardNote(e.target.value)}
              />
              <button
                className="btn-primary col-span-2"
                disabled={!awardTplId || award.isPending}
                onClick={() => award.mutate()}
              >
                Award 🏆
              </button>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {(achievements.data ?? []).map((a) => (
                <span key={a.id} className="badge bg-amber-100 text-amber-800">
                  {a.template?.title} · {a.awarded_date}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
