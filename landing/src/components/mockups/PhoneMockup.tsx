import { Bell, Camera, CheckCircle2, Moon, Palette, Send, Users, Utensils } from "lucide-react";
import type { Dict } from "../../i18n";

type Variant = "parent" | "teacher";

interface Props {
  t: Dict["mock"];
  variant?: Variant;
  className?: string;
}

const kids = [
  { name: "Lina", color: "#ff5e7e" },
  { name: "Adam", color: "#00a8ff" },
  { name: "Maya", color: "#ffb142" },
  { name: "Omar", color: "#6c5ce7" },
  { name: "Yara", color: "#2cafa8" },
];

/** A phone frame drawing a simplified Nursee+ screen, so copy stays translatable. */
export function PhoneMockup({ t, variant = "parent", className = "" }: Props) {
  return (
    <div
      className={`relative w-[240px] rounded-[2.4rem] border-[7px] border-ink bg-ink shadow-[0_30px_80px_-20px_rgba(30,41,59,0.55)] ${className}`}
      aria-hidden="true"
    >
      <div className="absolute start-1/2 top-1.5 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-ink rtl:translate-x-1/2" />
      <div className="relative h-[480px] overflow-hidden rounded-[1.9rem] bg-[#f8fafc]">
        <div className="bg-gradient-to-br from-teal to-violet px-4 pt-8 pb-10 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold opacity-80">{t.greeting} 👋</div>
              <div className="text-base font-extrabold">{variant === "parent" ? t.childName : t.present}</div>
            </div>
            <div className="relative rounded-full bg-white/20 p-1.5">
              <Bell size={14} />
              <span className="absolute -end-0.5 -top-0.5 h-2 w-2 rounded-full bg-coral" />
            </div>
          </div>
        </div>

        {variant === "parent" ? (
          <div className="-mt-6 space-y-2 px-3">
            <div className="flex items-center gap-2 rounded-2xl bg-white p-2.5 shadow-sm">
              <CheckCircle2 size={16} className="text-teal" />
              <span className="text-[11px] font-bold text-ink">{t.checkedIn}</span>
            </div>
            <div className="text-[11px] font-extrabold text-ink px-1 pt-1">{t.today}</div>
            {[
              { icon: Utensils, color: "#f59e0b", bg: "#fef3c7", title: t.breakfast, sub: t.ateWell },
              { icon: Moon, color: "#6366f1", bg: "#e0e7ff", title: t.nap, sub: t.napTime },
              { icon: Palette, color: "#10b981", bg: "#d1fae5", title: t.activity, sub: t.painting },
            ].map(({ icon: Icon, color, bg, title, sub }) => (
              <div key={title} className="flex items-center gap-2.5 rounded-2xl bg-white p-2.5 shadow-sm">
                <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background: bg, color }}>
                  <Icon size={15} />
                </span>
                <div className="min-w-0">
                  <div className="text-[11px] font-extrabold text-ink">{title}</div>
                  <div className="truncate text-[10px] font-semibold text-muted">{sub}</div>
                </div>
              </div>
            ))}
            <div className="rounded-2xl bg-white p-2.5 shadow-sm">
              <div className="mb-1 text-[10px] font-bold text-muted">{t.teacherName}</div>
              <div className="inline-block rounded-2xl rounded-es-sm bg-violet-light px-3 py-1.5 text-[11px] font-bold text-violet-dark">
                {t.teacherMsg}
              </div>
            </div>
          </div>
        ) : (
          <div className="-mt-6 space-y-2 px-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: Utensils, bg: "#fef3c7", color: "#f59e0b" },
                { icon: Moon, bg: "#e0e7ff", color: "#6366f1" },
                { icon: Camera, bg: "#fce7f3", color: "#ec4899" },
              ].map(({ icon: Icon, bg, color }, i) => (
                <div key={i} className="grid h-14 place-items-center rounded-2xl bg-white shadow-sm">
                  <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background: bg, color }}>
                    <Icon size={15} />
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1.5 px-1 pt-1 text-[11px] font-extrabold text-ink">
              <Users size={13} className="text-teal" /> {t.attendanceWeek}
            </div>
            {kids.map((k, i) => (
              <div key={k.name} className="flex items-center gap-2.5 rounded-2xl bg-white p-2 shadow-sm">
                <span
                  className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-extrabold text-white"
                  style={{ background: k.color }}
                >
                  {k.name[0]}
                </span>
                <span className="flex-1 text-[11px] font-bold text-ink">{k.name}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${
                    i === 3 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {i === 3 ? "8:40" : "✓"}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-full bg-white p-1.5 ps-3 shadow-md">
          <span className="flex-1 text-[10px] font-semibold text-muted">…</span>
          <span className="grid h-7 w-7 place-items-center rounded-full bg-teal text-white">
            <Send size={12} />
          </span>
        </div>
      </div>
    </div>
  );
}
