import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, LogIn, LogOut } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import { ChildPicker } from "../../components/Pickers";
import type { Attendance, Child, ListResponse } from "../../types/api";

type PendingRow = Attendance & { child?: Child };

const STATUS_BADGE: Record<string, string> = {
  absent: "bg-rose-100 text-rose-700",
  late: "bg-amber-100 text-amber-700",
  early_pickup: "bg-sky-100 text-sky-700",
  present: "bg-emerald-100 text-emerald-700",
};

/** Staff queue for parent attendance requests + quick check-in/out. */
export function AttendancePage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [checkChildId, setCheckChildId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const pending = useQuery({
    queryKey: ["attendance-pending"],
    queryFn: async () =>
      (await api.get<ListResponse<PendingRow>>("/attendance/pending", { params: { per_page: 50 } })).data.data,
  });

  const confirm = useMutation({
    mutationFn: async (id: number) => api.post(`/attendance/${id}/confirm`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["attendance-pending"] }),
    onError: (err) => setError(errorMessage(err)),
  });

  const check = useMutation({
    mutationFn: async (action: "check_in" | "check_out") =>
      api.post(`/children/${checkChildId}/check`, { action }),
    onSuccess: (_, action) => {
      setMessage(action === "check_in" ? "Checked in ✓" : "Checked out ✓");
      setError("");
      setTimeout(() => setMessage(""), 2500);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("nav.attendance")}</h1>

      <div className="card p-5">
        <h2 className="mb-3 font-semibold">Quick check-in / check-out</h2>
        <div className="flex items-end gap-3">
          <div className="w-64">
            <label className="label">Child</label>
            <ChildPicker value={checkChildId} onChange={setCheckChildId} />
          </div>
          <button
            className="btn-primary"
            disabled={!checkChildId || check.isPending}
            onClick={() => check.mutate("check_in")}
          >
            <LogIn size={16} /> Check in
          </button>
          <button
            className="btn-secondary"
            disabled={!checkChildId || check.isPending}
            onClick={() => check.mutate("check_out")}
          >
            <LogOut size={16} /> Check out
          </button>
        </div>
        {message && <p className="mt-2 text-sm text-emerald-600">{message}</p>}
      </div>

      <div className="card p-5">
        <h2 className="mb-3 font-semibold">Pending parent requests</h2>
        {pending.isLoading ? (
          <p className="text-sm text-slate-500">{t("common.loading")}</p>
        ) : !pending.data?.length ? (
          <p className="text-sm text-slate-500">No pending requests 🎉</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="py-2">Child</th>
                <th className="py-2">{t("common.date")}</th>
                <th className="py-2">{t("common.status")}</th>
                <th className="py-2">Note</th>
                <th className="py-2 w-28" />
              </tr>
            </thead>
            <tbody>
              {pending.data.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 font-medium">
                    {row.child ? `${row.child.first_name} ${row.child.last_name}` : `#${row.child_id}`}
                  </td>
                  <td className="py-2.5">{row.date.slice(0, 10)}</td>
                  <td className="py-2.5">
                    <span className={`badge ${STATUS_BADGE[row.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {row.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="py-2.5 text-slate-500">{row.note || "—"}</td>
                  <td className="py-2.5">
                    <button
                      className="btn-primary !px-3 !py-1.5"
                      disabled={confirm.isPending}
                      onClick={() => confirm.mutate(row.id)}
                    >
                      <Check size={14} /> Confirm
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
