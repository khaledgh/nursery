import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { FormField } from "../../components/FormField";
import { Modal } from "../../components/Modal";
import { ClassroomPicker, ChildPicker } from "../../components/Pickers";
import { api } from "../../lib/api";
import { applyServerErrors } from "../../lib/formErrors";
import type { ItemResponse, Reminder } from "../../types/api";

const schema = z.object({
  scope: z.enum(["global", "classroom", "child"]),
  scope_id: z.string().optional().or(z.literal("")),
  title: z.string().min(1).max(191),
  description: z.string().max(1000).optional().or(z.literal("")),
  date: z.string().optional().or(z.literal("")),
  kind: z.enum(["upcoming", "general"]),
  weather_alert: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

export function RemindersPage() {
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Reminder | null>(null);
  const [error, setError] = useState("");

  const reminders = useQuery({
    queryKey: ["reminders"],
    queryFn: async () => {
      const res = await api.get<ItemResponse<Reminder[]>>("/reminders");
      return res.data.data;
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { scope: "global", kind: "general", weather_alert: false, title: "", description: "", date: "", scope_id: "" },
  });
  const scope = form.watch("scope");

  const create = useMutation({
    mutationFn: async (values: FormValues) =>
      api.post("/reminders", {
        scope: values.scope,
        scope_id: values.scope !== "global" && values.scope_id ? Number(values.scope_id) : undefined,
        title: values.title,
        description: values.description || undefined,
        date: values.date || undefined,
        kind: values.kind,
        weather_alert: values.weather_alert,
      }),
    onSuccess: () => {
      setCreating(false);
      form.reset({ scope: "global", kind: "general", weather_alert: false, title: "", description: "", date: "", scope_id: "" });
      void reminders.refetch();
    },
    onError: (err) => setError(applyServerErrors(form, err)),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`/reminders/${id}`),
    onSuccess: () => {
      setDeleting(null);
      void reminders.refetch();
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("nav.reminders")}</h1>
        <button className="btn-primary" onClick={() => setCreating(true)}>
          <Plus size={16} /> {t("common.create")}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(reminders.data ?? []).map((r) => (
          <div key={r.id} className="card p-5">
            <div className="flex items-start justify-between">
              <div className="font-medium">
                {r.weather_alert && "🌦️ "}
                {r.title}
              </div>
              <button className="text-slate-400 hover:text-red-600" onClick={() => setDeleting(r)} aria-label="Delete">
                <Trash2 size={16} />
              </button>
            </div>
            {r.description && <p className="mt-1 text-sm text-slate-600">{r.description}</p>}
            <div className="mt-3 flex gap-2 text-xs">
              <span className="badge bg-brand-100 text-brand-700">{r.scope}</span>
              <span className="badge bg-slate-100 text-slate-600">{r.kind}</span>
              {r.date && <span className="badge bg-amber-100 text-amber-700">{r.date.slice(0, 10)}</span>}
            </div>
          </div>
        ))}
        {reminders.data?.length === 0 && <p className="text-slate-400">{t("common.noData")}</p>}
      </div>

      <Modal open={creating} title={t("common.create")} onClose={() => setCreating(false)}>
        <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="space-y-4">
          <FormField label={t("common.title")} error={form.formState.errors.title?.message}>
            <input className="input" {...form.register("title")} />
          </FormField>
          <FormField label="Description">
            <textarea className="input" rows={2} {...form.register("description")} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Scope">
              <select className="input" {...form.register("scope")}>
                <option value="global">Global</option>
                <option value="classroom">Classroom</option>
                <option value="child">Child</option>
              </select>
            </FormField>
            {scope !== "global" && (
              <FormField label={scope === "classroom" ? "Classroom" : "Child"}>
                {scope === "classroom" ? (
                  <ClassroomPicker
                    value={form.watch("scope_id") || ""}
                    onChange={(id) => form.setValue("scope_id", id)}
                  />
                ) : (
                  <ChildPicker
                    value={form.watch("scope_id") || ""}
                    onChange={(id) => form.setValue("scope_id", id)}
                  />
                )}
              </FormField>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("common.date")}>
              <input className="input" type="date" {...form.register("date")} />
            </FormField>
            <FormField label="Kind">
              <select className="input" {...form.register("kind")}>
                <option value="general">General</option>
                <option value="upcoming">Upcoming</option>
              </select>
            </FormField>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register("weather_alert")} /> Weather alert
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setCreating(false)}>
              {t("common.cancel")}
            </button>
            <button type="submit" className="btn-primary" disabled={create.isPending}>
              {create.isPending ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={`${t("common.delete")}: ${deleting?.title ?? ""}`}
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
