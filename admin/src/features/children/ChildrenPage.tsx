import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { HeartPulse, Pencil, Plus, Trash2, UserPlus, X, ClipboardList } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { DataTable, type Column } from "../../components/DataTable";
import { FormField } from "../../components/FormField";
import { Modal } from "../../components/Modal";
import { usePagedList } from "../../hooks/usePagedList";
import { api } from "../../lib/api";
import { applyServerErrors } from "../../lib/formErrors";
import { HealthPanel } from "./HealthPanel";
import { QuickHubModal } from "./QuickHubModal";
import type { Child, Classroom, ItemResponse, ListResponse, User } from "../../types/api";
import { Link } from "react-router-dom";

const childSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  gender: z.string().max(20).optional().or(z.literal("")),
  blood_type: z.string().max(5).optional().or(z.literal("")),
  classroom_id: z.string().optional(),
});
type ChildForm = z.infer<typeof childSchema>;

const guardianSchema = z.object({
  parent_user_id: z.string().min(1, "required"),
  relationship: z.enum(["mother", "father", "guardian", "grandparent", "other"]),
  is_primary: z.boolean(),
  can_pickup: z.boolean(),
});
type GuardianForm = z.infer<typeof guardianSchema>;

function useClassrooms() {
  return useQuery({
    queryKey: ["classrooms-all"],
    queryFn: async () => {
      const res = await api.get<ListResponse<Classroom>>("/classrooms", { params: { per_page: 100 } });
      return res.data.data;
    },
  });
}

function useParents() {
  return useQuery({
    queryKey: ["parents-all"],
    queryFn: async () => {
      const res = await api.get<ListResponse<User>>("/admin/users", { params: { role: "parent", per_page: 100 } });
      return res.data.data;
    },
  });
}

export function ChildrenPage() {
  const { t } = useTranslation();
  const list = usePagedList<Child>("children", "/children");
  const classrooms = useClassrooms();
  const parents = useParents();
  const [editing, setEditing] = useState<Child | "new" | null>(null);
  const [deleting, setDeleting] = useState<Child | null>(null);
  const [guardiansFor, setGuardiansFor] = useState<Child | null>(null);
  const [healthFor, setHealthFor] = useState<Child | null>(null);
  const [hubFor, setHubFor] = useState<Child | null>(null);
  const [error, setError] = useState("");

  const form = useForm<ChildForm>({ resolver: zodResolver(childSchema) });
  const gForm = useForm<GuardianForm>({
    resolver: zodResolver(guardianSchema),
    defaultValues: { relationship: "mother", is_primary: false, can_pickup: true, parent_user_id: "" },
  });

  // Guardians panel reloads the child to show the fresh list after changes.
  const guardiansDetail = useQuery({
    queryKey: ["child", guardiansFor?.id],
    enabled: guardiansFor !== null,
    queryFn: async () => {
      const res = await api.get<ItemResponse<Child>>(`/children/${guardiansFor!.id}`);
      return res.data.data;
    },
  });

  const openCreate = () => {
    form.reset({ first_name: "", last_name: "", dob: "", gender: "", blood_type: "", classroom_id: "" });
    setError("");
    setEditing("new");
  };
  const openEdit = (c: Child) => {
    form.reset({
      first_name: c.first_name,
      last_name: c.last_name,
      dob: c.dob.slice(0, 10),
      gender: c.gender ?? "",
      blood_type: c.blood_type ?? "",
      classroom_id: c.classroom_id ? String(c.classroom_id) : "",
    });
    setError("");
    setEditing(c);
  };

  const save = useMutation({
    mutationFn: async (values: ChildForm) => {
      const payload = {
        first_name: values.first_name,
        last_name: values.last_name,
        dob: values.dob,
        gender: values.gender || undefined,
        blood_type: values.blood_type || undefined,
        classroom_id: values.classroom_id ? Number(values.classroom_id) : undefined,
      };
      if (editing === "new") await api.post("/admin/children", payload);
      else if (editing) await api.put(`/admin/children/${editing.id}`, payload);
    },
    onSuccess: () => {
      setEditing(null);
      void list.refetch();
    },
    onError: (err) => setError(applyServerErrors(form, err)),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`/admin/children/${id}`),
    onSuccess: () => {
      setDeleting(null);
      void list.refetch();
    },
  });

  const addGuardian = useMutation({
    mutationFn: async (values: GuardianForm) =>
      api.post(`/admin/children/${guardiansFor!.id}/guardians`, {
        ...values,
        parent_user_id: Number(values.parent_user_id),
      }),
    onSuccess: () => {
      gForm.reset({ relationship: "mother", is_primary: false, can_pickup: true, parent_user_id: "" });
      void guardiansDetail.refetch();
    },
    // gForm, not form: "already a guardian" belongs on the guardian picker.
    onError: (err) => setError(applyServerErrors(gForm, err)),
  });

  const removeGuardian = useMutation({
    mutationFn: async (parentId: number) => api.delete(`/admin/children/${guardiansFor!.id}/guardians/${parentId}`),
    onSuccess: () => void guardiansDetail.refetch(),
  });

  const columns: Column<Child>[] = [
    {
      header: t("common.name"),
      render: (c) => (
        <Link to={`/children/${c.id}`} className="font-bold text-brand-700 hover:underline">
          {c.first_name} {c.last_name}
        </Link>
      ),
    },
    { header: "DOB", render: (c) => c.dob.slice(0, 10) },
    { header: t("nav.classrooms"), render: (c) => c.classroom?.name ?? "—" },
    {
      header: "Presence",
      render: (c) => (
        <span
          className={`badge ${
            c.present_status === "checked_in"
              ? "bg-emerald-100 text-emerald-700"
              : c.present_status === "absent"
                ? "bg-rose-100 text-rose-700"
                : "bg-slate-100 text-slate-500"
          }`}
        >
          {c.present_status.replace("_", " ")}
        </span>
      ),
    },
    {
      header: t("common.actions"),
      className: "w-44",
      render: (c) => (
        <div className="flex gap-1">
          <button className="btn-secondary !p-1.5 text-brand-650" title="Care & Milestones Hub" onClick={() => setHubFor(c)}>
            <ClipboardList size={14} />
          </button>
          <button className="btn-secondary !p-1.5" title="Guardians" onClick={() => setGuardiansFor(c)}>
            <UserPlus size={14} />
          </button>
          <button className="btn-secondary !p-1.5" title="Health records" onClick={() => setHealthFor(c)}>
            <HeartPulse size={14} />
          </button>
          <button className="btn-secondary !p-1.5" onClick={() => openEdit(c)} aria-label="Edit">
            <Pencil size={14} />
          </button>
          <button className="btn-secondary !p-1.5 text-red-600" onClick={() => setDeleting(c)} aria-label="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("nav.children")}</h1>
      <DataTable
        columns={columns}
        rows={list.rows}
        meta={list.meta}
        loading={list.loading}
        search={list.search}
        onSearch={list.setSearch}
        onPage={list.setPage}
        rowKey={(c) => c.id}
        toolbar={
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={16} /> {t("common.create")}
          </button>
        }
      />

      <Modal open={editing !== null} title={editing === "new" ? t("common.create") : t("common.edit")} onClose={() => setEditing(null)}>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="First name" error={form.formState.errors.first_name?.message}>
              <input className="input" {...form.register("first_name")} />
            </FormField>
            <FormField label="Last name" error={form.formState.errors.last_name?.message}>
              <input className="input" {...form.register("last_name")} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Date of birth" error={form.formState.errors.dob?.message}>
              <input className="input" type="date" {...form.register("dob")} />
            </FormField>
            <FormField label="Gender">
              <select className="input" {...form.register("gender")}>
                <option value="">—</option>
                <option value="girl">Girl</option>
                <option value="boy">Boy</option>
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Blood type">
              <input className="input" placeholder="O+" {...form.register("blood_type")} />
            </FormField>
            <FormField label={t("nav.classrooms")}>
              <select className="input" {...form.register("classroom_id")}>
                <option value="">—</option>
                {(classrooms.data ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </FormField>
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

      <Modal
        open={guardiansFor !== null}
        title={`Guardians — ${guardiansFor?.first_name ?? ""} ${guardiansFor?.last_name ?? ""}`}
        onClose={() => setGuardiansFor(null)}
        wide
      >
        <ul className="mb-4 divide-y divide-slate-100">
          {(guardiansDetail.data?.guardians ?? []).map((g) => (
            <li key={g.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="font-medium">{g.parent?.name ?? `#${g.parent_user_id}`}</span>
              <span className="badge bg-slate-100 text-slate-600">{g.relationship}</span>
              {g.is_primary && <span className="badge bg-brand-100 text-brand-700">primary</span>}
              {g.can_pickup && <span className="badge bg-emerald-100 text-emerald-700">can pick up</span>}
              <button
                className="ms-auto text-slate-400 hover:text-red-600"
                onClick={() => removeGuardian.mutate(g.parent_user_id)}
                aria-label="Remove guardian"
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
        <form
          onSubmit={gForm.handleSubmit((v) => addGuardian.mutate(v))}
          className="grid grid-cols-1 items-end gap-3 sm:grid-cols-4"
        >
          <FormField label="Parent" error={gForm.formState.errors.parent_user_id?.message}>
            <select className="input" {...gForm.register("parent_user_id")}>
              <option value="">—</option>
              {(parents.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Relationship">
            <select className="input" {...gForm.register("relationship")}>
              <option value="mother">Mother</option>
              <option value="father">Father</option>
              <option value="guardian">Guardian</option>
              <option value="grandparent">Grandparent</option>
              <option value="other">Other</option>
            </select>
          </FormField>
          <div className="flex gap-4 pb-2 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" {...gForm.register("is_primary")} /> Primary
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" {...gForm.register("can_pickup")} /> Pickup
            </label>
          </div>
          <button type="submit" className="btn-primary" disabled={addGuardian.isPending}>
            <Plus size={16} /> Add
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </Modal>

      <Modal
        open={healthFor !== null}
        title={`Health — ${healthFor?.first_name ?? ""} ${healthFor?.last_name ?? ""}`}
        onClose={() => setHealthFor(null)}
        wide
      >
        {healthFor && <HealthPanel childId={healthFor.id} />}
      </Modal>

      <QuickHubModal
        child={hubFor}
        open={hubFor !== null}
        onClose={() => setHubFor(null)}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={`${t("common.delete")}: ${deleting?.first_name ?? ""}`}
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
