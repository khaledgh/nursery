import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Baby,
  Calendar,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Phone,
  Plus,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@heroui/react";
import { Modal } from "../../components/Modal";
import { PageHeader } from "../../components/PageHeader";
import { api } from "../../lib/api";
import { INVOICE_STATUS_TINT, PRESENCE_TINT, tint } from "../../lib/tints";
import { useCurrency } from "../../hooks/useCurrency";
import type { ParentDetail, User } from "../../types/api";

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

export function ParentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { formatMoney } = useCurrency();
  const [copied, setCopied] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["parent", id],
    queryFn: async () => (await api.get<{ data: ParentDetail }>(`/admin/parents/${id}`)).data.data,
    enabled: Boolean(id),
  });

  if (isLoading) {
    return (
      <div className="py-24 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent mb-3" />
        <p className="text-sm font-semibold text-slate-500">Loading parent details…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-base font-bold text-rose-600">Parent account not found.</p>
        <Link to="/users" className="btn btn-secondary inline-block">
          Return to Users
        </Link>
      </div>
    );
  }

  const { parent, children, invoices } = data;

  const copyLoginId = async () => {
    if (!parent.login_id) return;
    await navigator.clipboard.writeText(parent.login_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const today = new Date().toISOString().slice(0, 10);
  const hasOverdue = invoices.some((inv) => inv.status !== "paid" && inv.due_date < today);

  return (
    <div className="space-y-6">
      <PageHeader
        title={parent.name}
        subtitle={`${parent.email} · Family Hub & Records`}
        breadcrumbs={[
          { label: "People", to: "/users" },
          { label: "Parents", to: "/users" },
          { label: parent.name },
        ]}
        backTo="/users"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="flat"
              radius="lg"
              startContent={<KeyRound size={15} className="text-amber-600" />}
              onPress={() => setPasswordModalOpen(true)}
              className="font-bold text-slate-700 dark:text-slate-200"
            >
              Change Password
            </Button>
            <Link to="/families/new" className="btn btn-primary shadow-sm font-bold flex items-center gap-1.5">
              <Plus size={16} />
              Add Sibling
            </Link>
          </div>
        }
      />

      {/* Top Financial & KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`card p-5 border ${data.outstanding_minor > 0 ? "border-rose-200/80 bg-rose-50/20 dark:bg-rose-950/10 dark:border-rose-900/50" : "border-slate-200/80 dark:border-slate-800"}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Wallet size={15} className="text-rose-500" />
              Outstanding Balance
            </span>
            {hasOverdue && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                Payment Overdue
              </span>
            )}
          </div>
          <p className={`text-2xl font-black mt-2 ${data.outstanding_minor > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-100"}`}>
            {formatMoney(data.outstanding_minor)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Across {data.unpaid_invoices} unpaid invoice{data.unpaid_invoices === 1 ? "" : "s"}
          </p>
        </div>

        <div className="card p-5 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Check size={15} className="text-emerald-500" />
              Total Paid
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              Collected
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            {formatMoney(data.paid_minor)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Lifetime payments recorded</p>
        </div>

        <div className="card p-5 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Baby size={15} className="text-primary" />
              Linked Children
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-primary/10 text-primary border border-primary/20">
              Enrolled
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2">
            {children.length}
          </p>
          <p className="text-xs text-slate-400 mt-1">Active family children</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* Children Section */}
          <section className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                <Baby size={18} className="text-primary" />
                Children ({children.length})
              </h2>
              <span className="text-xs font-semibold text-slate-400">
                Click any child to open their full profile page
              </span>
            </div>

            {children.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700">
                <Baby size={28} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No children linked yet</p>
                <p className="text-xs text-slate-400 mt-0.5 mb-3">Add a child to this family using the sibling registration</p>
                <Link to="/families/new" className="btn btn-secondary text-xs">
                  Enroll Child
                </Link>
              </div>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {children.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/children/${c.id}`}
                      className="group flex flex-col p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md hover:border-primary/50 hover:bg-primary/5 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary text-sm font-black group-hover:scale-105 transition-transform">
                          {c.first_name[0]}
                          {c.last_name[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-extrabold text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors flex items-center gap-1.5">
                            <span>{c.first_name} {c.last_name}</span>
                            <ExternalLink size={13} className="text-slate-400 group-hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                          </p>
                          <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                            {c.classroom?.name ?? "Unassigned Classroom"}
                            {c.relationship ? ` · ${c.relationship}` : ""}
                          </p>
                        </div>
                        <span className={`badge shrink-0 text-[10px] font-extrabold capitalize ${tint(PRESENCE_TINT, c.present_status)}`}>
                          {c.present_status.replace("_", " ")}
                        </span>
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wider ${c.can_pickup ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>
                          {c.can_pickup ? "Authorized Pickup" : "No Pickup"}
                        </span>
                        <span className="text-primary font-bold group-hover:translate-x-1 transition-transform flex items-center gap-1">
                          View Page →
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Payments & Due Dates Section */}
          <section className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                <Wallet size={18} className="text-amber-500" />
                Invoices & Payment Due Dates ({invoices.length})
              </h2>
            </div>

            {invoices.length === 0 ? (
              <p className="text-sm font-semibold text-slate-400 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-center">
                No invoices recorded for this family yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800">
                    <tr className="text-slate-500 text-[10px] font-extrabold uppercase tracking-wider">
                      <th className="py-3 px-4 text-start">Invoice #</th>
                      <th className="py-3 px-4 text-start">Period</th>
                      <th className="py-3 px-4 text-start">Due Date</th>
                      <th className="py-3 px-4 text-end">Amount</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {invoices.map((inv) => {
                      const isOverdue = inv.status !== "paid" && inv.due_date < today;
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                            {inv.invoice_no}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                            {inv.period || "—"}
                          </td>
                          <td className="py-3 px-4 text-xs font-semibold">
                            <span
                              className={`inline-flex items-center gap-1.5 ${
                                isOverdue
                                  ? "text-rose-600 font-bold"
                                  : inv.status === "paid"
                                  ? "text-slate-500"
                                  : "text-amber-600 font-semibold"
                              }`}
                            >
                              <Calendar size={13} className="shrink-0" />
                              {inv.due_date}
                              {isOverdue && (
                                <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-rose-100 text-rose-700 border border-rose-200">
                                  Overdue
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-end font-bold text-slate-900 dark:text-slate-100">
                            {formatMoney(inv.total_minor, inv.currency)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`badge uppercase text-[10px] font-extrabold ${tint(INVOICE_STATUS_TINT, inv.status)}`}>
                              {inv.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Sidebar Info & Login Credentials */}
        <aside className="space-y-4">
          <div className="card space-y-4 p-5">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              Account Credentials & Login
            </h3>

            {parent.login_id ? (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                  Mobile App Login ID
                </span>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg bg-white dark:bg-slate-900 px-3 py-1.5 font-mono text-sm font-bold text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 shadow-xs">
                    {parent.login_id}
                  </code>
                  <button
                    onClick={() => void copyLoginId()}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    type="button"
                    title="Copy Login ID"
                  >
                    {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  The parent uses this ID and their password to log in to the mobile app.
                </p>
              </div>
            ) : null}

            <div className="space-y-2.5 pt-1">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Email
                </span>
                <a
                  href={`mailto:${parent.email}`}
                  className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors"
                >
                  <Mail size={14} className="text-slate-400 shrink-0" />
                  <span className="truncate">{parent.email}</span>
                </a>
              </div>

              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Phone Number
                </span>
                {parent.phone ? (
                  <a
                    href={`tel:${parent.phone}`}
                    className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors"
                  >
                    <Phone size={14} className="text-slate-400 shrink-0" />
                    <span className="font-mono">{parent.phone}</span>
                  </a>
                ) : (
                  <p className="text-xs text-slate-400 italic">No phone number recorded</p>
                )}
              </div>

              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Account Status
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    parent.status === "active"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                      : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      parent.status === "active" ? "bg-emerald-500" : "bg-slate-400"
                    }`}
                  />
                  {parent.status}
                </span>
              </div>
            </div>

            <Button
              size="sm"
              variant="flat"
              startContent={<KeyRound size={14} />}
              onPress={() => setPasswordModalOpen(true)}
              className="w-full font-bold mt-2"
            >
              Reset Parent Password
            </Button>
          </div>
        </aside>
      </div>

      {/* Password Reset Modal */}
      {passwordModalOpen && (
        <ParentPasswordModal
          user={{
            id: Number(parent.id),
            name: parent.name,
            email: parent.email,
            login_id: parent.login_id,
            role: "parent",
            phone: parent.phone,
            locale: parent.locale,
            status: parent.status as "active" | "inactive",
            last_login_at: null,
            created_at: "",
          }}
          onClose={() => setPasswordModalOpen(false)}
          onSuccess={() => {
            setPasswordModalOpen(false);
            void refetch();
          }}
        />
      )}
    </div>
  );
}

function ParentPasswordModal({
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
    <Modal open={true} title="Change Parent Password" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
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
              The parent can now sign in with this new password.
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
                Minimum 8 characters. Active sessions for this account will be invalidated.
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
