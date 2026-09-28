import { Baby, CreditCard, MessagesSquare } from "lucide-react";
import type { Dict } from "../../i18n";

interface Props {
  t: Dict["mock"];
  className?: string;
}

const bars = [72, 88, 64, 94, 81];

/** A browser-window sketch of the admin dashboard. */
export function DashboardMockup({ t, className = "" }: Props) {
  return (
    <div
      className={`w-[400px] overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_30px_80px_-25px_rgba(108,92,231,0.45)] ${className}`}
      aria-hidden="true"
    >
      <div className="flex items-center gap-1.5 border-b border-slate-100 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-coral" />
        <span className="h-2.5 w-2.5 rounded-full bg-marigold" />
        <span className="h-2.5 w-2.5 rounded-full bg-teal" />
        <span className="ms-3 h-4 flex-1 rounded-full bg-slate-100" />
      </div>
      <div className="flex">
        <div className="hidden w-16 flex-col items-center gap-3 bg-slate-50 py-4 sm:flex">
          <img src="/mark.webp" alt="" className="h-7 w-7 object-contain" />
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`h-6 w-6 rounded-lg ${i === 0 ? "bg-teal" : "bg-slate-200"}`} />
          ))}
        </div>
        <div className="flex-1 space-y-3 p-4">
          <div className="text-sm font-extrabold text-ink">{t.dashboardTitle}</div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: Baby, label: t.present, value: "86", color: "#2cafa8", bg: "#eefbf9" },
              { icon: CreditCard, label: t.invoicesPaid, value: "94%", color: "#6c5ce7", bg: "#ede9fe" },
              { icon: MessagesSquare, label: t.messages, value: "12", color: "#ff5e7e", bg: "#ffe4e6" },
            ].map(({ icon: Icon, label, value, color, bg }) => (
              <div key={label} className="rounded-xl p-2.5" style={{ background: bg }}>
                <Icon size={14} style={{ color }} />
                <div className="mt-1 text-base font-extrabold text-ink">{value}</div>
                <div className="truncate text-[9px] font-bold text-muted">{label}</div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-slate-100 p-3">
            <div className="mb-2 text-[10px] font-extrabold text-muted">{t.attendanceWeek}</div>
            <div className="flex h-20 items-end gap-2">
              {bars.map((h, i) => (
                <div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-teal to-violet" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
