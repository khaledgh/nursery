import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, LogIn, LogOut } from "lucide-react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Chip,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/react";
import { api, errorMessage } from "../../lib/api";
import { ChildPicker } from "../../components/Pickers";
import { PageHeader } from "../../components/PageHeader";
import type { Attendance, Child, ListResponse } from "../../types/api";

type PendingRow = Attendance & { child?: Child };

const STATUS_COLOR: Record<string, "danger" | "warning" | "primary" | "success" | "default"> = {
  absent: "danger",
  late: "warning",
  early_pickup: "primary",
  present: "success",
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
    <div className="space-y-6">
      <PageHeader
        title={t("nav.attendance")}
        subtitle="Manage live check-ins, departures, and review absence or late arrival requests"
      />

      {/* Quick Check In / Check Out Card */}
      <Card shadow="sm" className="border border-slate-200/70 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 rounded-2xl p-2 sm:p-4">
        <CardHeader className="pb-1">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">Quick check-in / check-out</h2>
            <p className="text-xs font-medium text-slate-400 mt-0.5">Select a child to mark their current presence status</p>
          </div>
        </CardHeader>
        <CardBody className="pt-2">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-72">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Child</label>
              <ChildPicker value={checkChildId} onChange={setCheckChildId} />
            </div>
            <Button
              color="primary"
              radius="lg"
              size="md"
              isDisabled={!checkChildId || check.isPending}
              isLoading={check.isPending && check.variables === "check_in"}
              onPress={() => check.mutate("check_in")}
              startContent={!check.isPending && <LogIn size={16} />}
              className="font-bold px-5 bg-primary text-white shadow-md shadow-primary/25 hover:opacity-95"
            >
              Check in
            </Button>
            <Button
              variant="bordered"
              radius="lg"
              size="md"
              isDisabled={!checkChildId || check.isPending}
              isLoading={check.isPending && check.variables === "check_out"}
              onPress={() => check.mutate("check_out")}
              startContent={!check.isPending && <LogOut size={16} />}
              className="font-bold px-5 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm"
            >
              Check out
            </Button>
          </div>
          {message && <p className="mt-3 text-xs font-bold text-success">{message}</p>}
        </CardBody>
      </Card>

      {/* Pending Parent Requests Table */}
      <Card shadow="sm" className="border border-slate-200/70 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 rounded-2xl p-2 sm:p-4">
        <CardHeader className="pb-1">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">Pending parent requests</h2>
            <p className="text-xs font-medium text-slate-400 mt-0.5">Requests submitted by guardians requiring staff confirmation</p>
          </div>
        </CardHeader>
        <CardBody className="pt-2">
          <Table
            aria-label="Pending parent requests"
            shadow="none"
            classNames={{
              wrapper: "p-0 bg-transparent shadow-none",
              th: "bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase text-[11px] font-bold tracking-wider py-3",
              td: "py-3 text-slate-600 dark:text-slate-300 text-sm border-b border-slate-100 dark:border-slate-800/60",
            }}
          >
            <TableHeader>
              <TableColumn>Child</TableColumn>
              <TableColumn>{t("common.date")}</TableColumn>
              <TableColumn>{t("common.status")}</TableColumn>
              <TableColumn>Note</TableColumn>
              <TableColumn className="w-28 text-end">Action</TableColumn>
            </TableHeader>
            <TableBody
              items={pending.data ?? []}
              emptyContent={pending.isLoading ? "Loading requests..." : "No pending requests 🎉"}
            >
              {(row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-bold text-slate-800 dark:text-slate-100">
                    {row.child ? `${row.child.first_name} ${row.child.last_name}` : `#${row.child_id}`}
                  </TableCell>
                  <TableCell>{row.date.slice(0, 10)}</TableCell>
                  <TableCell>
                    <Chip
                      size="sm"
                      variant="flat"
                      color={STATUS_COLOR[row.status] ?? "default"}
                      className="font-bold text-xs capitalize"
                    >
                      {row.status.replace(/_/g, " ")}
                    </Chip>
                  </TableCell>
                  <TableCell className="text-slate-500">{row.note || "—"}</TableCell>
                  <TableCell className="text-end">
                    <Button
                      size="sm"
                      color="primary"
                      radius="lg"
                      isLoading={confirm.isPending && confirm.variables === row.id}
                      onPress={() => confirm.mutate(row.id)}
                      startContent={<Check size={14} />}
                      className="font-bold"
                    >
                      Confirm
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {error && <p className="mt-3 text-xs font-semibold text-danger">{error}</p>}
        </CardBody>
      </Card>
    </div>
  );
}

