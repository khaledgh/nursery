import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import type { User } from "../../types/api";
import { ROLE_TINT } from "../../lib/tints";

const schema = z.object({
  name: z.string().min(2).max(191),
  email: z.string().email(),
  phone: z.string().max(32).optional().or(z.literal("")),
  role: z.enum(["admin", "teacher", "parent"]),
  password: z.string().min(8).max(72).optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]),
});
type FormValues = z.infer<typeof schema>;


export function UsersPage() {
  const { t } = useTranslation();
  const [roleFilter, setRoleFilter] = useState("");
  const list = usePagedList<User>("users", "/admin/users", { role: roleFilter || undefined });
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [error, setError] = useState("");

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  const openCreate = () => {
    form.reset({ name: "", email: "", phone: "", role: "parent", password: "", status: "active" });
    setError("");
    setEditing("new");
  };
  const openEdit = (u: User) => {
    // A superadmin belongs to no nursery and is never editable here, so fall
    // back rather than widening the form's role enum — the API rejects
    // superadmin on this endpoint too.
    const role = u.role === "superadmin" ? "admin" : u.role;
    form.reset({ name: u.name, email: u.email, phone: u.phone ?? "", role, password: "", status: u.status });
    setError("");
    setEditing(u);
  };

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      if (editing === "new") {
        if (!values.password) {
          // Only new users must supply one, so this cannot live in the schema.
          form.setError("password", { type: "required", message: "is required for new users" });
          throw new Error("");
        }
        await api.post("/admin/users", { ...values, phone: values.phone || undefined });
      } else if (editing) {
        await api.put(`/admin/users/${editing.id}`, {
          name: values.name,
          email: values.email,
          phone: values.phone || undefined,
          status: values.status,
          password: values.password || undefined,
        });
      }
    },
    onSuccess: () => {
      setEditing(null);
      void list.refetch();
    },
    onError: (err) => setError(applyServerErrors(form, err)),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`/admin/users/${id}`),
    onSuccess: () => {
      setDeleting(null);
      void list.refetch();
    },
  });

  const columns: Column<User>[] = [
    { header: t("common.name"), render: (u) => <span className="font-medium">{u.name}</span> },
    { header: t("auth.email"), render: (u) => u.email },
    {
      header: "Role",
      render: (u) => <span className={`badge ${ROLE_TINT[u.role]}`}>{u.role}</span>,
    },
    {
      header: t("common.status"),
      render: (u) => (
        <span className={`badge ${u.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
          {u.status === "active" ? t("common.active") : t("common.inactive")}
        </span>
      ),
    },
    {
      header: t("common.actions"),
      className: "w-28",
      render: (u) => (
        <div className="flex gap-1">
          <button className="btn-secondary !p-1.5" onClick={() => openEdit(u)} aria-label="Edit">
            <Pencil size={14} />
          </button>
          <button className="btn-secondary !p-1.5 text-red-600" onClick={() => setDeleting(u)} aria-label="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("nav.users")}</h1>
      <DataTable
        columns={columns}
        rows={list.rows}
        meta={list.meta}
        loading={list.loading}
        search={list.search}
        onSearch={list.setSearch}
        onPage={list.setPage}
        rowKey={(u) => u.id}
        toolbar={
          <>
            <select className="input !w-36" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">All roles</option>
              <option value="admin">Admin</option>
              <option value="teacher">Teacher</option>
              <option value="parent">Parent</option>
            </select>
            <button className="btn-primary" onClick={openCreate}>
              <Plus size={16} /> {t("common.create")}
            </button>
          </>
        }
      />

      <Modal open={editing !== null} title={editing === "new" ? t("common.create") : t("common.edit")} onClose={() => setEditing(null)}>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4">
          <FormField label={t("common.name")} error={form.formState.errors.name?.message}>
            <input className="input" {...form.register("name")} />
          </FormField>
          <FormField label={t("auth.email")} error={form.formState.errors.email?.message}>
            <input className="input" type="email" {...form.register("email")} />
          </FormField>
          <FormField label="Phone" error={form.formState.errors.phone?.message}>
            <input className="input" {...form.register("phone")} />
          </FormField>
          {editing === "new" && (
            <FormField label="Role" error={form.formState.errors.role?.message}>
              <select className="input" {...form.register("role")}>
                <option value="parent">Parent</option>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
              </select>
            </FormField>
          )}
          <FormField
            label={editing === "new" ? t("auth.password") : `${t("auth.password")} (leave blank to keep)`}
            error={form.formState.errors.password?.message}
          >
            <input className="input" type="password" autoComplete="new-password" {...form.register("password")} />
          </FormField>
          <FormField label={t("common.status")}>
            <select className="input" {...form.register("status")}>
              <option value="active">{t("common.active")}</option>
              <option value="inactive">{t("common.inactive")}</option>
            </select>
          </FormField>
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
