import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import {
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  Pencil,
  Phone,
  Plus,
  Shield,
  ShieldAlert,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button, Select, SelectItem } from "@heroui/react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { DataTable, type Column } from "../../components/DataTable";
import { FormField } from "../../components/FormField";
import { Modal } from "../../components/Modal";
import { PageHeader } from "../../components/PageHeader";
import { usePagedList } from "../../hooks/usePagedList";
import { api } from "../../lib/api";
import { applyServerErrors } from "../../lib/formErrors";
import type { User } from "../../types/api";

const schema = z.object({
  name: z.string().min(2).max(191),
  email: z.string().email(),
  phone: z.string().max(32).optional().or(z.literal("")),
  role: z.enum(["admin", "teacher", "parent"]),
  password: z.string().min(8).max(72).optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]),
});
type FormValues = z.infer<typeof schema>;

function generateSecurePassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const nums = "23456789";
  const special = "!@#$%^&*";
  const all = upper + lower + nums + special;
  let pw = "";
  pw += upper[Math.floor(Math.random() * upper.length)];
  pw += lower[Math.floor(Math.random() * lower.length)];
  pw += nums[Math.floor(Math.random() * nums.length)];
  pw += special[Math.floor(Math.random() * special.length)];
  for (let i = 0; i < 6; i++) {
    pw += all[Math.floor(Math.random() * all.length)];
  }
  return pw.split("").sort(() => 0.5 - Math.random()).join("");
}

export function UsersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [roleFilter, setRoleFilter] = useState("");
  const list = usePagedList<User>("users", "/admin/users", { role: roleFilter || undefined });

  // Dialog states
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<User | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  const openCreate = () => {
    form.reset({ name: "", email: "", phone: "", role: "parent", password: "", status: "active" });
    setError("");
    setEditing("new");
  };

  const openEdit = (u: User) => {
    const role = u.role === "superadmin" ? "admin" : u.role;
    form.reset({ name: u.name, email: u.email, phone: u.phone ?? "", role, password: "", status: u.status });
    setError("");
    setEditing(u);
  };

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      if (editing === "new") {
        if (!values.password) {
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
    {
      header: t("common.name"),
      sortKey: "name",
      allowsSorting: true,
      render: (u) => {
        const isParent = u.role === "parent";
        return (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200">
              {u.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              {isParent ? (
                <Link
                  to={`/parents/${u.id}`}
                  className="group flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100 hover:text-primary dark:hover:text-primary transition-colors text-left"
                  title="Open parent page (children, payments & due dates)"
                >
                  <span className="truncate group-hover:underline">{u.name}</span>
                  <ExternalLink size={13} className="text-slate-400 group-hover:text-primary transition-colors opacity-70 group-hover:opacity-100 shrink-0" />
                </Link>
              ) : (
                <span className="font-bold text-slate-800 dark:text-slate-100 truncate block">
                  {u.name}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: "Login ID",
      render: (u) => {
        const loginIdentifier = u.login_id || `#${u.id}`;
        const isCopied = copiedId === loginIdentifier;
        return (
          <div className="inline-flex items-center gap-1.5">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80">
              {loginIdentifier}
            </span>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(loginIdentifier);
                setCopiedId(loginIdentifier);
                setTimeout(() => setCopiedId(null), 2000);
              }}
              title="Copy Login ID"
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {isCopied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
            </button>
          </div>
        );
      },
    },
    {
      header: t("auth.email"),
      sortKey: "email",
      allowsSorting: true,
      render: (u) => (
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate max-w-[200px] block">
          {u.email}
        </span>
      ),
    },
    {
      header: "Phone",
      render: (u) => {
        if (!u.phone) {
          return <span className="text-slate-300 dark:text-slate-600 text-xs font-mono">—</span>;
        }
        return (
          <a
            href={`tel:${u.phone}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-primary dark:hover:text-primary transition-colors"
          >
            <Phone size={12} className="text-slate-400 shrink-0" />
            <span className="font-mono">{u.phone}</span>
          </a>
        );
      },
    },
    {
      header: "Role",
      render: (u) => {
        switch (u.role) {
          case "superadmin":
            return (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                <ShieldAlert size={12} className="text-amber-500 shrink-0" />
                Superadmin
              </span>
            );
          case "admin":
            return (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30">
                <Shield size={12} className="text-indigo-500 shrink-0" />
                Admin
              </span>
            );
          case "teacher":
            return (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                <GraduationCap size={12} className="text-emerald-500 shrink-0" />
                Teacher
              </span>
            );
          case "parent":
          default:
            return (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/30">
                <Users size={12} className="text-sky-500 shrink-0" />
                Parent
              </span>
            );
        }
      },
    },
    {
      header: t("common.status"),
      render: (u) => {
        const isActive = u.status === "active";
        return (
          <span
            className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-bold ${
              isActive
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20"
            }`}
          >
            <span className="relative flex h-2 w-2">
              {isActive && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isActive ? "bg-emerald-500" : "bg-slate-400 dark:bg-slate-500"
                }`}
              />
            </span>
            {isActive ? t("common.active") : t("common.inactive")}
          </span>
        );
      },
    },
    {
      header: t("common.actions"),
      className: "w-36",
      render: (u) => (
        <div className="flex gap-1 items-center">
          {u.role === "parent" && (
            <Button
              isIconOnly
              size="sm"
              variant="light"
              radius="lg"
              onPress={() => navigate(`/parents/${u.id}`)}
              aria-label="View Family Page"
              title="Open Parent Page"
              className="text-sky-600 hover:text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-950/30"
            >
              <Eye size={15} />
            </Button>
          )}
          <Button
            isIconOnly
            size="sm"
            variant="light"
            radius="lg"
            onPress={() => setPasswordTarget(u)}
            aria-label="Change Password"
            title="Change Password"
            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
          >
            <KeyRound size={15} />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            radius="lg"
            onPress={() => openEdit(u)}
            aria-label="Edit"
            title="Edit User"
            className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Pencil size={15} />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            color="danger"
            radius="lg"
            onPress={() => setDeleting(u)}
            aria-label="Delete"
            title="Delete User"
            className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          >
            <Trash2 size={15} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("nav.users")}
        subtitle="Manage administrator, teacher, and parent accounts with quick credentials and family details"
        actions={
          <Button
            color="primary"
            radius="lg"
            startContent={<Plus size={16} />}
            onPress={openCreate}
            className="font-bold shadow-md shadow-primary/25"
          >
            {t("common.create")}
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={list.rows}
        meta={list.meta}
        loading={list.loading}
        search={list.search}
        onSearch={list.setSearch}
        onPage={list.setPage}
        rowKey={(u) => u.id}
        sortDescriptor={list.sortDescriptor}
        onSortChange={list.setSortDescriptor}
        toolbar={
          <div className="flex items-center gap-2">
            <Select
              size="sm"
              variant="bordered"
              radius="lg"
              placeholder="All roles"
              selectedKeys={roleFilter ? [roleFilter] : []}
              onChange={(e) => setRoleFilter(e.target.value)}
              aria-label="Filter by role"
              className="w-36"
              classNames={{
                trigger: "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-sm rounded-xl",
                popoverContent: "bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xl rounded-2xl p-1",
              }}
            >
              <SelectItem key="" textValue="All roles">All roles</SelectItem>
              <SelectItem key="admin" textValue="Admin">Admin</SelectItem>
              <SelectItem key="teacher" textValue="Teacher">Teacher</SelectItem>
              <SelectItem key="parent" textValue="Parent">Parent</SelectItem>
            </Select>
          </div>
        }
      />

      {/* Create / Edit User Modal */}
      <Modal open={editing !== null} title={editing === "new" ? t("common.create") : t("common.edit")} onClose={() => setEditing(null)}>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4">
          <FormField label={t("common.name")} error={form.formState.errors.name?.message}>
            <input className="input" {...form.register("name")} />
          </FormField>
          <FormField label={t("auth.email")} error={form.formState.errors.email?.message}>
            <input className="input" type="email" {...form.register("email")} />
          </FormField>
          <FormField label="Phone" error={form.formState.errors.phone?.message}>
            <input className="input" placeholder="e.g. +46 70 123 4567" {...form.register("phone")} />
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

      {/* Easy Password Change Modal */}
      {passwordTarget && (
        <ChangePasswordModal
          user={passwordTarget}
          onClose={() => setPasswordTarget(null)}
          onSuccess={() => {
            setPasswordTarget(null);
            void list.refetch();
          }}
        />
      )}

      {/* Confirm Delete */}
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

/**
 * Dedicated Change Password Modal with 1-click password generation and visibility toggle.
 */
function ChangePasswordModal({
  user,
  onClose,
  onSuccess,
}: {
  user: User;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [savedSuccess, setSavedSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: async (newPw: string) => {
      await api.put(`/admin/users/${user.id}`, { password: newPw });
    },
    onSuccess: () => {
      setSavedSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1200);
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error?.message || "Failed to update password. Must be at least 8 characters.");
    },
  });

  const handleGenerate = () => {
    const pw = generateSecurePassword();
    setPassword(pw);
    setShowPassword(true);
    setError("");
  };

  const handleCopy = async () => {
    if (!password) return;
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    setError("");
    mutation.mutate(password);
  };

  return (
    <Modal open={true} title="Change User Password" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* User Card Header */}
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold text-sm">
            <KeyRound size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{user.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {user.email} {user.login_id ? `· Login ID: ${user.login_id}` : ""}
            </p>
          </div>
        </div>

        {savedSuccess ? (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-1">
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
              ✓ Password updated successfully!
            </p>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">
              The user can now sign in with their new password.
            </p>
          </div>
        ) : (
          <>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  New Password
                </label>
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                >
                  <Sparkles size={12} />
                  Generate Strong Password
                </button>
              </div>

              <div className="relative flex items-center">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="Enter minimum 8 characters…"
                  className="input pr-20 font-mono text-sm"
                  autoFocus
                />
                <div className="absolute right-2 flex items-center gap-1">
                  {password ? (
                    <button
                      type="button"
                      onClick={handleCopy}
                      title="Copy Password"
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? "Hide password" : "Show password"}
                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">
                Minimum 8 characters. Any active sessions for this account will be invalidated.
              </p>
            </div>

            {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button size="sm" variant="flat" onPress={onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                color="primary"
                type="submit"
                isLoading={mutation.isPending}
                className="font-bold shadow-sm"
              >
                Save New Password
              </Button>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}
