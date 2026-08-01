import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tint?: string;
  trend?: string;
  trendDirection?: "up" | "down";
}

export function StatCard({
  icon: Icon,
  label,
  value,
  tint = "bg-brand-50 text-brand-700",
  trend,
  trendDirection = "up",
}: StatCardProps) {
  const isUp = trendDirection === "up" || (trend && trend.startsWith("+"));

  return (
    <div className="card p-6 flex flex-col justify-between hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tint} shrink-0 shadow-sm`}>
          <Icon size={20} />
        </div>
      </div>
      
      <div className="mt-4">
        <div className="text-3xl font-extrabold text-slate-800 leading-tight tracking-tight">{value}</div>
        
        {trend && (
          <div className="flex items-center gap-2 mt-3">
            <span
              className={`inline-flex items-center gap-0.5 rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                isUp ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              }`}
            >
              <span>{isUp ? "▲" : "▼"}</span>
              <span>{trend}</span>
            </span>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">from last week</span>
          </div>
        )}
      </div>
    </div>
  );
}

