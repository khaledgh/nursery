import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Images, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { DataTable, type Column } from "../../components/DataTable";
import { FormField } from "../../components/FormField";
import { Modal } from "../../components/Modal";
import { usePagedList } from "../../hooks/usePagedList";
import { api } from "../../lib/api";
import { applyServerErrors } from "../../lib/formErrors";
import { ImageUpload } from "../../components/ImageUpload";
import { EventMediaPanel } from "./EventMediaPanel";
import type { EventItem, Media } from "../../types/api";

const schema = z.object({
  title: z.string().min(1).max(191),
  description: z.string().max(2000).optional().or(z.literal("")),
  location: z.string().max(255).optional().or(z.literal("")),
  starts_at: z.string().min(1, "required"),
  ends_at: z.string().optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;

const STATUS_TINT: Record<string, string> = {
  upcoming: "bg-emerald-100 text-emerald-700",
  completed: "bg-slate-100 text-slate-500",
  cancelled: "bg-rose-100 text-rose-700",
};

export function EventsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"upcoming" | "previous">("upcoming");
  const list = usePagedList<EventItem>(`events-${tab}`, "/events", { tab });
  const [creating, setCreating] = useState(false);
  const [mediaFor, setMediaFor] = useState<EventItem | null>(null);
  const [cover, setCover] = useState<Media | null>(null);
  const [error, setError] = useState("");

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const toRFC3339 = (local: string) => new Date(local).toISOString();

  const create = useMutation({
    mutationFn: async (values: FormValues) =>
      api.post("/events", {
        title: values.title,
        description: values.description || undefined,
        location: values.location || undefined,
        starts_at: toRFC3339(values.starts_at),
        ends_at: values.ends_at ? toRFC3339(values.ends_at) : undefined,
        cover_media_id: cover?.id ?? undefined,
      }),
    onSuccess: () => {
      setCreating(false);
      setCover(null);
      form.reset();
      void list.refetch();
    },
    onError: (err) => setError(applyServerErrors(form, err)),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => api.put(`/events/${id}/status`, { status }),
    onSuccess: () => void list.refetch(),
  });

  const columns: Column<EventItem>[] = [
    { header: t("common.title"), render: (e) => <span className="font-medium">{e.title}</span> },
    { header: "When", render: (e) => new Date(e.starts_at).toLocaleString() },
    { header: "Location", render: (e) => e.location || "—" },
    {
      header: t("common.status"),
      render: (e) => <span className={`badge ${STATUS_TINT[e.status]}`}>{e.status}</span>,
    },
    {
      header: t("common.actions"),
      className: "w-52",
      render: (e) => (
        <div className="flex gap-1">
          <button className="btn-secondary !px-2 !py-1 text-xs" title="Photo album" onClick={() => setMediaFor(e)}>
            <Images size={14} />
          </button>
          {e.status === "upcoming" && (
            <>
              <button className="btn-secondary !px-2 !py-1 text-xs" onClick={() => setStatus.mutate({ id: e.id, status: "completed" })}>
                Complete
              </button>
              <button
                className="btn-secondary !px-2 !py-1 text-xs text-red-600"
                onClick={() => setStatus.mutate({ id: e.id, status: "cancelled" })}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold">{t("nav.events")}</h1>
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
          {(["upcoming", "previous"] as const).map((tb) => (
            <button
              key={tb}
              onClick={() => setTab(tb)}
              className={`rounded-md px-3 py-1 text-sm ${tab === tb ? "bg-brand-600 text-white" : "text-slate-600"}`}
            >
              {tb}
            </button>
          ))}
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={list.rows}
        meta={list.meta}
        loading={list.loading}
        onPage={list.setPage}
        rowKey={(e) => e.id}
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
          <FormField label="Description">
            <textarea className="input" rows={3} {...form.register("description")} />
          </FormField>
          <FormField label="Location">
            <input className="input" {...form.register("location")} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Starts" error={form.formState.errors.starts_at?.message}>
              <input className="input" type="datetime-local" {...form.register("starts_at")} />
            </FormField>
            <FormField label="Ends">
              <input className="input" type="datetime-local" {...form.register("ends_at")} />
            </FormField>
          </div>
          <ImageUpload label="Cover image" value={cover} onChange={setCover} />
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

      <Modal open={mediaFor !== null} title={`Photos — ${mediaFor?.title ?? ""}`} onClose={() => setMediaFor(null)} wide>
        {mediaFor && <EventMediaPanel eventId={mediaFor.id} />}
      </Modal>
    </div>
  );
}
