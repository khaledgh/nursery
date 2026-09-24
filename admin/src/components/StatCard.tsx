import type { LucideIcon } from "lucide-react";
import { Card, CardBody, Chip } from "@heroui/react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tint?: string;
  trend?: string;
  trendDirection?: "up" | "down";
  description?: string;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  tint = "bg-primary/10 text-primary-700",
  trend,
  trendDirection = "up",
  description,
}: StatCardProps) {
  const isUp = trendDirection === "up" || (trend && trend.startsWith("+"));

  return (
    <Card
      shadow="sm"
      className="border border-slate-200/70 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
    >
      <CardBody className="p-5 flex flex-col justify-between overflow-hidden relative">
        {/* Subtle decorative background glow */}
        <div className="absolute -top-12 -right-12 w-28 h-28 rounded-full bg-primary/5 blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {label}
          </span>
          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tint} shrink-0 shadow-sm transition-transform duration-200 group-hover:scale-105`}>
            <Icon size={20} />
          </div>
        </div>

        <div className="mt-4">
          <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            {value}
          </div>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {trend && (
              <Chip
                size="sm"
                variant="flat"
                color={isUp ? "success" : "danger"}
                startContent={
                  <span className="text-xs font-black px-0.5">
                    {isUp ? "▲" : "▼"}
                  </span>
                }
                className="font-bold text-[11px]"
              >
                {trend}
              </Chip>
            )}
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              {description ?? "vs last month"}
            </span>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}


