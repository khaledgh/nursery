import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, LogIn, Pause, Play, Plus } from "lucide-react";
import { useState } from "react";
import { FormField } from "../../components/FormField";
import { Modal } from "../../components/Modal";
import { PageHeader } from "../../components/PageHeader";
import { StatCard } from "../../components/StatCard";
import { api, errorMessage } from "../../lib/api";
import { SUBSCRIPTION_STATUS_TINT, tint } from "../../lib/tints";
import { useAuthStore } from "../../store/auth";
import type { NurseryOverview, ListResponse, PlatformStats, Plan } from "../../types/api";

function money(minor: number) {
  return `${(minor / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })} SEK`;
}

/** The platform console: every nursery, its plan, and its seat usage. */
export function NurseriesPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<NurseryOverview | null>(null);
  const [banner, setBanner] = useState("");

  const stats = useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => (await api.get<{ data: PlatformStats }>("/superadmin/stats")).data.data,
  });
  const nurseries = useQuery({
    queryKey: ["superadmin-nurseries"],
    queryFn: async () =>
      (await api.get<ListResponse<NurseryOverview>>("/superadmin/nurseries?per_page=100")).data.data,
  });
  const plans = useQuery({
    queryKey: ["superadmin-plans"],
    queryFn: async () => (await api.get<{ data: Plan[] }>("/superadmin/plans")).data.data,
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["superadmin-nurseries"] });
    void qc.invalidateQueries({ queryKey: ["platform-stats"] });
  };

  const setStatus = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "suspend" | "activate" }) =>
      api.post(`/superadmin/nurseries/${id}/${action}`),
    onSuccess: refresh,
    onError: (e) => setBanner(errorMessage(e)),
  });

  return (
    <>
      <PageHeader
        title="Nurseries"
        subtitle="Every tenant on the platform."
        actions={
          <button onClick={() => setCreating(true)} className="btn btn-primary">
            <Plus size={16} /> New nursery
          </button>
        }
      />

      {banner && <p className="mb-4 text-sm font-semibold text-rose-600">{banner}</p>}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Nurseries" value={stats.data?.nurseries ?? 0} icon={Building2} />
        <StatCard label="Children" value={stats.data?.children ?? 0} icon={Building2} />
        <StatCard label="MRR" value={money(stats.data?.mrr_minor ?? 0)} icon={Building2} />
        <StatCard label="Past due" value={stats.data?.nurseries_past_due ?? 0} icon={Building2} />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="table-header text-start">Nursery</th>
              <th className="table-header text-start">Plan</th>
              <th className="table-header text-start">Students</th>
              <th className="table-header text-start">Status</th>
              <th className="table-header text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {nurseries.data?.map((n) => (
              <tr key={n.id} className="table-row">
                <td className="table-cell">
                  <p className="font-bold text-slate-800">{n.name}</p>
                  <p className="font-mono text-xs text-slate-400">{n.slug}</p>
                </td>
                <td className="table-cell">
                  <button
                    onClick={() => setEditing(n)}
                    className="font-bold text-brand-600 hover:underline"
                    type="button"
                  >
                    {n.plan_code || "—"}
                  </button>
                </td>
                <td className="table-cell">
                  {n.students_used} / {n.students_max || "∞"}
                </td>
                <td className="table-cell">
                  <span className={`badge ${tint(SUBSCRIPTION_STATUS_TINT, n.subscription_status)}`}>
                    {(n.subscription_status ?? "—").replace("_", " ")}
                  </span>
                </td>
                <td className="table-cell">
                  <div className="flex justify-end gap-2">
                    <ImpersonateButton nurseryId={n.id} />
                    <button
                      onClick={() =>
                        setStatus.mutate({
                          id: n.id,
                          action: n.status === "active" ? "suspend" : "activate",
                        })
                      }
                      className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                      title={n.status === "active" ? "Suspend" : "Activate"}
                      type="button"
                    >
                      {n.status === "active" ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CreateNurseryModal
        open={creating}
        plans={plans.data ?? []}
        onClose={() => setCreating(false)}
        onDone={() => {
          setCreating(false);
          refresh();
        }}
      />
      <AssignPlanModal
        nursery={editing}
        plans={plans.data ?? []}
        onClose={() => setEditing(null)}
        onDone={() => {
          setEditing(null);
          refresh();
        }}
      />
    </>
  );
}

/**
 * Enters a nursery as its admin.
 *
 * The token is short-lived and records the real superadmin, so anything done
 * while inside stays attributed to them in the audit log.
 */
function ImpersonateButton({ nurseryId }: { nurseryId: number }) {
  const { user, setTokens } = useAuthStore();
  const go = useMutation({
    mutationFn: async () =>
      (
        await api.post<{ data: { access_token: string; access_expires_at: string } }>(
          `/superadmin/nurseries/${nurseryId}/impersonate`,
        )
      ).data.data,
    onSuccess: (tokens) => {
      if (!user) return;
      // No refresh token is issued: impersonation must expire, not renew.
      setTokens(
        {
          access_token: tokens.access_token,
          access_expires_at: tokens.access_expires_at,
          refresh_token: "",
          refresh_expires_at: tokens.access_expires_at,
        },
        user,
      );
      window.location.href = "/";
    },
  });
  return (
    <button
      onClick={() => go.mutate()}
      className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
      title="Enter this nursery"
      type="button"
    >
      <LogIn size={14} />
    </button>
  );
}

function CreateNurseryModal({
  open,
  plans,
  onClose,
  onDone,
}: {
  open: boolean;
  plans: Plan[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    slug: "",
    plan_code: "starter",
    admin_name: "",
    admin_email: "",
    admin_password: "",
  });
  const [err, setErr] = useState("");

  const create = useMutation({
    mutationFn: async () => api.post("/superadmin/nurseries", form),
    onSuccess: onDone,
    onError: (e) => setErr(errorMessage(e)),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <Modal open={open} title="New nursery" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Name">
            <input className="input" value={form.name} onChange={set("name")} />
          </FormField>
          <FormField label="Slug">
            <input
              className="input"
              value={form.slug}
              onChange={set("slug")}
              placeholder="sunny"
            />
          </FormField>
        </div>
        <FormField label="Plan">
          <select className="input" value={form.plan_code} onChange={set("plan_code")}>
            {plans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} — {p.max_students} students
              </option>
            ))}
          </select>
        </FormField>

        <p className="border-t border-slate-100 pt-4 text-xs font-bold uppercase tracking-wider text-slate-400">
          First admin
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Name">
            <input className="input" value={form.admin_name} onChange={set("admin_name")} />
          </FormField>
          <FormField label="Email">
            <input className="input" type="email" value={form.admin_email} onChange={set("admin_email")} />
          </FormField>
        </div>
        <FormField label="Password">
          <input
            className="input"
            type="password"
            value={form.admin_password}
            onChange={set("admin_password")}
          />
        </FormField>

        {err && <p className="text-sm font-semibold text-rose-600">{err}</p>}
        <div className="flex gap-2 border-t border-slate-100 pt-4">
          <button onClick={() => create.mutate()} className="btn btn-primary" disabled={create.isPending}>
            Create nursery
          </button>
          <button onClick={onClose} className="btn btn-secondary" type="button">
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AssignPlanModal({
  nursery,
  plans,
  onClose,
  onDone,
}: {
  nursery: NurseryOverview | null;
  plans: Plan[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [planCode, setPlanCode] = useState("");
  const [maxStudents, setMaxStudents] = useState("");
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { plan_code: planCode || nursery?.plan_code };
      if (maxStudents) body.max_students = Number(maxStudents);
      if (status) body.status = status;
      return api.put(`/superadmin/nurseries/${nursery?.id}/subscription`, body);
    },
    onSuccess: onDone,
    onError: (e) => setErr(errorMessage(e)),
  });

  if (!nursery) return null;

  return (
    <Modal open title={`Subscription — ${nursery.name}`} onClose={onClose}>
      <div className="space-y-4">
        <FormField label="Plan">
          <select
            className="input"
            value={planCode || nursery.plan_code}
            onChange={(e) => setPlanCode(e.target.value)}
          >
            {plans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} — {p.max_students} students
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Student limit override">
          <input
            className="input"
            type="number"
            placeholder={`Plan default (${nursery.students_max})`}
            value={maxStudents}
            onChange={(e) => setMaxStudents(e.target.value)}
          />
        </FormField>
        <FormField label="Status">
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Leave unchanged</option>
            {["trialing", "active", "past_due", "suspended", "cancelled"].map((s) => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>
        </FormField>
        <p className="text-xs font-semibold text-slate-400">
          Limits are copied onto the subscription, so editing a plan later never
          silently re-caps an existing customer.
        </p>
        {err && <p className="text-sm font-semibold text-rose-600">{err}</p>}
        <div className="flex gap-2 border-t border-slate-100 pt-4">
          <button onClick={() => save.mutate()} className="btn btn-primary" disabled={save.isPending}>
            Save
          </button>
          <button onClick={onClose} className="btn btn-secondary" type="button">
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
