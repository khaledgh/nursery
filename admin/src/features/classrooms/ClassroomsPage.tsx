import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarClock, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { DataTable, type Column } from "../../components/DataTable";
import { FormField } from "../../components/FormField";
import { Modal } from "../../components/Modal";
import { usePagedList } from "../../hooks/usePagedList";
import { api, errorMessage } from "../../lib/api";
import { ScheduleEditor } from "./ScheduleEditor";
import type { Classroom, ItemResponse, ListResponse, Locale, User } from "../../types/api";

const schema = z.object({
  name: z.string().min(1).max(191),
  room_location: z.string().max(191).optional().or(z.literal("")),
  age_group: z.string().max(50).optional().or(z.literal("")),
  capacity: z.string().regex(/^\d*$/, "must be a number").optional().or(z.literal("")),
  opens_at: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM").optional().or(z.literal("")),
  closes_at: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM").optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;

export function ClassroomsPage() {
  const { t } = useTranslation();
  const list = usePagedList<Classroom>("classrooms", "/classrooms");
  const [editing, setEditing] = useState<Classroom | "new" | null>(null);
  const [deleting, setDeleting] = useState<Classroom | null>(null);
  const [teachersFor, setTeachersFor] = useState<Classroom | null>(null);
  const [scheduleFor, setScheduleFor] = useState<Classroom | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [teacherToAdd, setTeacherToAdd] = useState("");
  const [teacherRole, setTeacherRole] = useState<"lead" | "assistant">("assistant");

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  const locales = useQuery({
    queryKey: ["locales"],
    queryFn: async () => {
      const res = await api.get<ItemResponse<Locale[]>>("/locales");
      return res.data.data.filter((l) => l.is_active);
    },
  });

  const teachers = useQuery({
    queryKey: ["teachers-all"],
    queryFn: async () => {
      const res = await api.get<ListResponse<User>>("/admin/users", { params: { role: "teacher", per_page: 100 } });
      return res.data.data;
    },
  });

  const detail = useQuery({
    queryKey: ["classroom", teachersFor?.id],
    enabled: teachersFor !== null,
    queryFn: async () => {
      const res = await api.get<ItemResponse<Classroom>>(`/classrooms/${teachersFor!.id}`);
      return res.data.data;
    },
  });

  const openCreate = () => {
    form.reset({ name: "", room_location: "", age_group: "", capacity: "0", opens_at: "", closes_at: "" });
    setTranslations({});
    setError("");
    setEditing("new");
  };
  const openEdit = (r: Classroom) => {
    form.reset({
      name: r.name,
      room_location: r.room_location ?? "",
      age_group: r.age_group ?? "",
      capacity: String(r.capacity),
      opens_at: r.opens_at ?? "",
      closes_at: r.closes_at ?? "",
    });
    setTranslations({});
    setError("");
    setEditing(r);
  };

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const trans = Object.entries(translations)
        .filter(([, name]) => name.trim() !== "")
        .map(([locale, name]) => ({ locale, name }));
      const payload = {
        ...values,
        capacity: values.capacity ? Number(values.capacity) : 0,
        room_location: values.room_location || undefined,
        age_group: values.age_group || undefined,
        opens_at: values.opens_at || undefined,
        closes_at: values.closes_at || undefined,
        translations: trans.length > 0 ? trans : undefined,
      };
      if (editing === "new") await api.post("/admin/classrooms", payload);
      else if (editing) await api.put(`/admin/classrooms/${editing.id}`, payload);
    },
    onSuccess: () => {
      setEditing(null);
      void list.refetch();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`/admin/classrooms/${id}`),
    onSuccess: () => {
      setDeleting(null);
      void list.refetch();
    },
  });

  const assignTeacher = useMutation({
    mutationFn: async () =>
      api.post(`/admin/classrooms/${teachersFor!.id}/teachers`, {
        teacher_user_id: Number(teacherToAdd),
        role: teacherRole,
      }),
    onSuccess: () => {
      setTeacherToAdd("");
      void detail.refetch();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const unassignTeacher = useMutation({
    mutationFn: async (teacherId: number) => api.delete(`/admin/classrooms/${teachersFor!.id}/teachers/${teacherId}`),
    onSuccess: () => void detail.refetch(),
  });

  const columns: Column<Classroom>[] = [
    { header: t("common.name"), render: (r) => <span className="font-medium">{r.name}</span> },
    { header: "Location", render: (r) => r.room_location || "—" },
    { header: "Age group", render: (r) => r.age_group || "—" },
    { header: "Capacity", render: (r) => r.capacity },
    { header: "Hours", render: (r) => (r.opens_at ? `${r.opens_at}–${r.closes_at}` : "—") },
    {
      header: t("common.actions"),
      className: "w-36",
      render: (r) => (
        <div className="flex gap-1">
          <button className="btn-secondary !p-1.5" title="Teachers" onClick={() => setTeachersFor(r)}>
            <Users size={14} />
          </button>
          <button className="btn-secondary !p-1.5" title="Weekly schedule" onClick={() => setScheduleFor(r)}>
            <CalendarClock size={14} />
          </button>
          <button className="btn-secondary !p-1.5" onClick={() => openEdit(r)} aria-label="Edit">
            <Pencil size={14} />
          </button>
          <button className="btn-secondary !p-1.5 text-red-600" onClick={() => setDeleting(r)} aria-label="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("nav.classrooms")}</h1>
      <DataTable
        columns={columns}
        rows={list.rows}
        meta={list.meta}
        loading={list.loading}
        search={list.search}
        onSearch={list.setSearch}
        onPage={list.setPage}
        rowKey={(r) => r.id}
        toolbar={
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={16} /> {t("common.create")}
          </button>
        }
      />

      <Modal open={editing !== null} title={editing === "new" ? t("common.create") : t("common.edit")} onClose={() => setEditing(null)} wide>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label={`${t("common.name")} (default)`} error={form.formState.errors.name?.message}>
              <input className="input" {...form.register("name")} />
            </FormField>
            <FormField label="Location">
              <input className="input" {...form.register("room_location")} />
            </FormField>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Age group">
              <input className="input" placeholder="1–3 years" {...form.register("age_group")} />
            </FormField>
            <FormField label="Capacity" error={form.formState.errors.capacity?.message}>
              <input className="input" type="number" {...form.register("capacity")} />
            </FormField>
            <div className="grid grid-cols-2 gap-2">
              <FormField label="Opens" error={form.formState.errors.opens_at?.message}>
                <input className="input" placeholder="07:30" {...form.register("opens_at")} />
              </FormField>
              <FormField label="Closes" error={form.formState.errors.closes_at?.message}>
                <input className="input" placeholder="17:30" {...form.register("closes_at")} />
              </FormField>
            </div>
          </div>

          <div>
            <div className="label">Name translations</div>
            <div className="grid grid-cols-2 gap-3">
              {(locales.data ?? [])
                .filter((l) => !l.is_default)
                .map((l) => (
                  <div key={l.code} className="flex items-center gap-2">
                    <span className="badge bg-slate-100 text-slate-600 w-10 justify-center">{l.code}</span>
                    <input
                      className="input"
                      dir={l.direction}
                      placeholder={l.native_name}
                      value={translations[l.code] ?? ""}
                      onChange={(e) => setTranslations((prev) => ({ ...prev, [l.code]: e.target.value }))}
                    />
                  </div>
                ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
              {t("common.cancel")}
            </button>
            <button type="submit" className="btn-primary" disabled={save.isPending}>
              {save.isPending ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={teachersFor !== null} title={`Teachers — ${teachersFor?.name ?? ""}`} onClose={() => setTeachersFor(null)}>
        <ul className="mb-4 divide-y divide-slate-100">
          {(detail.data?.teachers ?? []).map((ct) => (
            <li key={ct.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="font-medium">{ct.teacher?.name ?? `#${ct.teacher_user_id}`}</span>
              <span className={`badge ${ct.role === "lead" ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-600"}`}>
                {ct.role}
              </span>
              <button
                className="ms-auto text-slate-400 hover:text-red-600"
                onClick={() => unassignTeacher.mutate(ct.teacher_user_id)}
                aria-label="Remove teacher"
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="label">Teacher</label>
            <select className="input" value={teacherToAdd} onChange={(e) => setTeacherToAdd(e.target.value)}>
              <option value="">—</option>
              {(teachers.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={teacherRole} onChange={(e) => setTeacherRole(e.target.value as "lead" | "assistant")}>
              <option value="assistant">Assistant</option>
              <option value="lead">Lead</option>
            </select>
          </div>
          <button className="btn-primary" disabled={!teacherToAdd || assignTeacher.isPending} onClick={() => assignTeacher.mutate()}>
            <Plus size={16} /> Add
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </Modal>

      <Modal
        open={scheduleFor !== null}
        title={`Schedule — ${scheduleFor?.name ?? ""}`}
        onClose={() => setScheduleFor(null)}
        wide
      >
        {scheduleFor && <ScheduleEditor classroomId={scheduleFor.id} />}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={`${t("common.delete")}: ${deleting?.name ?? ""}`}
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
