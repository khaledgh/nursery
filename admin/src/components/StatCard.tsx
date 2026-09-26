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
      className="border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl hover:shadow-md transition-all duration-200"
    >
      <CardBody className="p-3.5 sm:p-4 flex flex-col justify-between overflow-hidden relative">
        {/* Subtle decorative background glow */}
        <div className="absolute -top-10 -right-10 w-20 h-20 rounded-full bg-primary/5 blur-xl pointer-events-none" />

        <div className="flex items-center justify-between gap-2.5">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
            {label}
          </span>
          <div className={`flex h-8 w-8 sm:h-8.5 sm:w-8.5 items-center justify-center rounded-lg ${tint} shrink-0 shadow-sm transition-transform duration-200`}>
            <Icon size={16} />
          </div>
        </div>

        <div className="mt-2">
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {value}
          </div>

          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {trend && (
              <Chip
                size="sm"
                variant="flat"
                color={isUp ? "success" : "danger"}
                startContent={
                  <span className="text-[10px] font-black px-0.5">
                    {isUp ? "▲" : "▼"}
                  </span>
                }
                className="font-bold text-[10px] h-4.5"
              >
                {trend}
              </Chip>
            )}
            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
              {description ?? "vs last month"}
            </span>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}


