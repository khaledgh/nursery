import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { DataTable, type Column } from "../../components/DataTable";
import { FormField } from "../../components/FormField";
import { Modal } from "../../components/Modal";
import { usePagedList } from "../../hooks/usePagedList";
import { api, errorMessage } from "../../lib/api";
import type { Announcement } from "../../types/api";

interface AnnouncementRow {
  announcement: Announcement;
  read_at: string | null;
  acknowledged_at: string | null;
}

const schema = z.object({
  title: z.string().min(1).max(191),
  body: z.string().min(1).max(5000),
  category: z.enum(["updates", "reminders", "events", "health", "general"]),
  publish: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

const CATEGORY_TINT: Record<string, string> = {
  updates: "bg-sky-100 text-sky-700",
  reminders: "bg-amber-100 text-amber-700",
  events: "bg-purple-100 text-purple-700",
  health: "bg-rose-100 text-rose-700",
  general: "bg-slate-100 text-slate-600",
};

export function AnnouncementsPage() {
  const { t } = useTranslation();
  const list = usePagedList<AnnouncementRow>("announcements", "/announcements");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { category: "general", publish: true, title: "", body: "" },
  });

  const create = useMutation({
    mutationFn: async (values: FormValues) => api.post("/announcements", values),
    onSuccess: () => {
      setCreating(false);
      form.reset({ category: "general", publish: true, title: "", body: "" });
      void list.refetch();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const columns: Column<AnnouncementRow>[] = [
    { header: t("common.title"), render: (r) => <span className="font-medium">{r.announcement.title}</span> },
    {
      header: "Category",
      render: (r) => <span className={`badge ${CATEGORY_TINT[r.announcement.category]}`}>{r.announcement.category}</span>,
    },
    {
      header: "Published",
      render: (r) =>
        r.announcement.published_at ? new Date(r.announcement.published_at).toLocaleString() : "—",
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("nav.announcements")}</h1>
      <DataTable
        columns={columns}
        rows={list.rows}
        meta={list.meta}
        loading={list.loading}
        onPage={list.setPage}
        rowKey={(r) => r.announcement.id}
        toolbar={
          <button className="btn-primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> {t("common.create")}
          </button>
        }
      />

      <Modal open={creating} title={t("common.create")} onClose={() => setCreating(false)}>
        <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="space-y-4">
          <FormField label={t("common.title")} error={form.formState.errors.title?.message}>
            <input className="input" {...form.register("title")} />
          </FormField>
          <FormField label="Body" error={form.formState.errors.body?.message}>
            <textarea className="input" rows={5} {...form.register("body")} />
          </FormField>
          <FormField label="Category">
            <select className="input" {...form.register("category")}>
              {Object.keys(CATEGORY_TINT).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FormField>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register("publish")} /> Publish immediately (sends push)
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
    </div>
  );
}
