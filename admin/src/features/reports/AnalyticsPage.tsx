import { useQuery } from "@tanstack/react-query";
import { Baby, CheckCircle2, Download, TrendingUp, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "../../components/PageHeader";
import { StatCard } from "../../components/StatCard";
import { api } from "../../lib/api";
import type { Child, Invoice, ListResponse } from "../../types/api";

// One accessible categorical ramp, shared by every chart on the page so the
// same status never changes colour between views. Chart colours were
// previously hardcoded per-file.
const SERIES = ["#5b9c34", "#8fc464", "#f59e0b", "#e11d48", "#3b82f6", "#8b5cf6"];

const STATUS_COLOR: Record<string, string> = {
  paid: "#5b9c34",
  due: "#f59e0b",
  overdue: "#e11d48",
  cancelled: "#94a3b8",
};

function money(minor: number) {
  return `${(minor / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })} SEK`;
}

/** Turns rows into a CSV download without pulling in a dependency. */
function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Enrolment, attendance, and revenue in one place.
 *
 * Everything here is computed from data the API already returns. Nothing is
 * estimated or back-filled — where a real series isn't available yet, the
 * section says so rather than showing a plausible-looking invention.
 */
export function AnalyticsPage() {
  const [room, setRoom] = useState("");

  const children = useQuery({
    queryKey: ["analytics-children"],
    queryFn: async () =>
      (await api.get<ListResponse<Child>>("/children", { params: { per_page: 500 } })).data.data,
  });

  const invoices = useQuery({
    queryKey: ["analytics-invoices"],
    queryFn: async () =>
      (await api.get<ListResponse<Invoice>>("/invoices", { params: { per_page: 500 } })).data.data,
  });

  const kids = useMemo(
    () => (children.data ?? []).filter((c) => !room || c.classroom?.name === room),
    [children.data, room],
  );
  const rooms = useMemo(
    () => [...new Set((children.data ?? []).map((c) => c.classroom?.name).filter(Boolean))] as string[],
    [children.data],
  );

  const presence = useMemo(
    () => [
      { name: "Checked in", value: kids.filter((c) => c.present_status === "checked_in").length },
      { name: "Checked out", value: kids.filter((c) => c.present_status === "checked_out").length },
      { name: "Absent", value: kids.filter((c) => c.present_status === "absent").length },
    ],
    [kids],
  );

  const byRoom = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of kids) map[c.classroom?.name ?? "Unassigned"] = (map[c.classroom?.name ?? "Unassigned"] ?? 0) + 1;
    return Object.entries(map).map(([name, children]) => ({ name, children }));
  }, [kids]);

  const revenue = useMemo(() => {
    const list = invoices.data ?? [];
    const sum = (pred: (i: Invoice) => boolean) =>
      list.filter(pred).reduce((n, i) => n + i.total_minor, 0);
    return {
      collected: sum((i) => i.status === "paid"),
      outstanding: sum((i) => i.status === "due" || i.status === "overdue"),
      overdue: sum((i) => i.status === "overdue"),
      byStatus: ["paid", "due", "overdue", "cancelled"].map((s) => ({
        name: s,
        value: list.filter((i) => i.status === s).length,
      })).filter((d) => d.value > 0),
    };
  }, [invoices.data]);

  const exportChildren = () =>
    downloadCSV("children.csv", [
      ["First name", "Last name", "DOB", "Classroom", "Presence"],
      ...kids.map((c) => [
        c.first_name,
        c.last_name,
        c.dob.slice(0, 10),
        c.classroom?.name ?? "",
        c.present_status,
      ]),
    ]);

  const exportInvoices = () =>
    downloadCSV("invoices.csv", [
      ["Invoice", "Period", "Due", "Amount", "Currency", "Status"],
      ...(invoices.data ?? []).map((i) => [
        i.invoice_no,
        i.period,
        i.due_date,
        (i.total_minor / 100).toFixed(2),
        i.currency,
        i.status,
      ]),
    ]);

  return (
    <>
      <PageHeader
        title="Reports & analytics"
        subtitle="Enrolment, attendance, and revenue."
        actions={
          <>
            <select className="input !w-44" value={room} onChange={(e) => setRoom(e.target.value)}>
              <option value="">All classrooms</option>
              {rooms.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button onClick={exportChildren} className="btn btn-secondary" type="button">
              <Download size={15} /> Children
            </button>
            <button onClick={exportInvoices} className="btn btn-secondary" type="button">
              <Download size={15} /> Invoices
            </button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Baby} label="Children" value={kids.length} tint="bg-brand-50 text-brand-700" />
        <StatCard icon={CheckCircle2} label="Present now" value={presence[0].value} tint="bg-emerald-50 text-emerald-700" />
        <StatCard icon={TrendingUp} label="Collected" value={money(revenue.collected)} tint="bg-sky-50 text-sky-700" />
        <StatCard icon={Wallet} label="Outstanding" value={money(revenue.outstanding)} tint="bg-rose-50 text-rose-700" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-slate-700">
            Children per classroom
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byRoom}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="children" fill={SERIES[0]} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="card p-6">
          <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-slate-700">
            Presence right now
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={presence} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
                {presence.map((_, i) => (
                  <Cell key={i} fill={SERIES[i]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <p className="mt-2 text-center text-xs font-semibold text-slate-400">
            A live snapshot. Historical attendance needs a per-day API that does
            not exist yet, so it is not charted rather than estimated.
          </p>
        </section>

        <section className="card p-6 lg:col-span-2">
          <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-slate-700">
            Invoices by status
          </h2>
          {revenue.byStatus.length === 0 ? (
            <p className="py-8 text-center text-xs font-semibold text-slate-400">No invoices yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={revenue.byStatus} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
                  {revenue.byStatus.map((d) => (
                    <Cell key={d.name} fill={STATUS_COLOR[d.name] ?? SERIES[0]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
          {revenue.overdue > 0 && (
            <p className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
              {money(revenue.overdue)} is overdue.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
