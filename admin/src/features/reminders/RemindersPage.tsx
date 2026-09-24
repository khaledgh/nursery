import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Calendar, CloudRain } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Card, CardBody, CardHeader, Chip, Button } from "@heroui/react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { FormField } from "../../components/FormField";
import { Modal } from "../../components/Modal";
import { PageHeader } from "../../components/PageHeader";
import { DatePicker } from "../../components/DatePicker";
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
    <div className="space-y-6">
      <PageHeader
        title={t("nav.reminders")}
        subtitle="Manage alerts, upcoming events, and weather notices for parents and staff"
        actions={
          <Button
            color="primary"
            radius="lg"
            startContent={<Plus size={16} />}
            onPress={() => setCreating(true)}
            className="font-bold shadow-md shadow-primary/25"
          >
            {t("common.create")}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(reminders.data ?? []).map((r) => (
          <Card
            key={r.id}
            shadow="sm"
            className="border border-slate-200/70 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 hover:shadow-md transition-all rounded-2xl"
          >
            <CardHeader className="flex items-start justify-between pb-1 px-5 pt-5">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                {r.weather_alert && (
                  <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-100 text-amber-700 shrink-0">
                    <CloudRain size={16} />
                  </span>
                )}
                <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm truncate">
                  {r.title}
                </h3>
              </div>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                color="danger"
                onPress={() => setDeleting(r)}
                aria-label="Delete"
                className="text-slate-400 hover:text-danger shrink-0 -mr-1 -mt-1"
              >
                <Trash2 size={15} />
              </Button>
            </CardHeader>

            <CardBody className="px-5 pb-5 pt-2 space-y-3">
              {r.description && (
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 line-clamp-2">
                  {r.description}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Chip size="sm" variant="flat" color="primary" className="text-[10px] font-bold h-5 uppercase">
                  {r.scope}
                </Chip>
                <Chip size="sm" variant="flat" color="default" className="text-[10px] font-bold h-5 uppercase">
                  {r.kind}
                </Chip>
                {r.date && (
                  <Chip
                    size="sm"
                    variant="flat"
                    color="warning"
                    startContent={<Calendar size={12} className="ml-1" />}
                    className="text-[10px] font-bold h-5"
                  >
                    {r.date.slice(0, 10)}
                  </Chip>
                )}
              </div>
            </CardBody>
          </Card>
        ))}
        {reminders.data?.length === 0 && (
          <div className="col-span-full p-12 text-center text-xs font-semibold text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            {t("common.noData")}
          </div>
        )}
      </div>

      <Modal open={creating} title={t("common.create")} onClose={() => setCreating(false)}>
        <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="space-y-4">
          <FormField label={t("common.title")} error={form.formState.errors.title?.message}>
            <input className="input" placeholder="e.g. Bring extra clothes" {...form.register("title")} />
          </FormField>
          <FormField label="Description">
            <textarea className="input" rows={2} placeholder="Optional details..." {...form.register("description")} />
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
              <DatePicker
                value={form.watch("date") || ""}
                onChange={(d) => form.setValue("date", d)}
              />
            </FormField>
            <FormField label="Kind">
              <select className="input" {...form.register("kind")}>
                <option value="general">General</option>
                <option value="upcoming">Upcoming</option>
              </select>
            </FormField>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
            <input type="checkbox" className="rounded" {...form.register("weather_alert")} /> Weather alert
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="flat" color="default" onPress={() => setCreating(false)}>
              {t("common.cancel")}
            </Button>
            <Button color="primary" type="submit" isLoading={create.isPending} className="font-bold">
              {create.isPending ? t("common.saving") : t("common.save")}
            </Button>
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

