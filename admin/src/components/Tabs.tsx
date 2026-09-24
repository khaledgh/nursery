import { Tabs as HeroTabs, Tab } from "@heroui/react";
import { useLocation, useNavigate } from "react-router-dom";

export interface TabDef {
  /** Path segment, or `?tab=` value when `query` is set. Empty is the default. */
  to: string;
  label: string;
}

interface TabsProps {
  tabs: TabDef[];
  base: string;
  /** Drive tabs from `?tab=` instead of nested routes. */
  query?: boolean;
  /** Current tab value; required in query mode. */
  active?: string;
}

/**
 * Route-backed tabs using HeroUI Tabs with animated indicator.
 */
export function Tabs({ tabs, base, query = false, active = "" }: TabsProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine current key
  let currentKey = active;
  if (!query) {
    const currentPath = location.pathname;
    const match = tabs.find((t) => {
      const fullPath = t.to ? `${base}/${t.to}` : base;
      return t.to === "" ? currentPath === fullPath : currentPath.startsWith(fullPath);
    });
    currentKey = match ? match.to : (tabs[0]?.to ?? "");
  }

  const handleSelection = (key: React.Key) => {
    const k = String(key);
    if (query) {
      navigate(k ? `${base}?tab=${k}` : base);
    } else {
      navigate(k ? `${base}/${k}` : base);
    }
  };

  return (
    <div className="mb-6 flex flex-wrap gap-4 items-center">
      <HeroTabs
        selectedKey={currentKey}
        onSelectionChange={handleSelection}
        aria-label="Navigation Tabs"
        color="primary"
        variant="underlined"
        classNames={{
          tabList: "gap-6 w-full relative rounded-none p-0 border-b border-slate-200 dark:border-slate-800",
          cursor: "w-full bg-primary",
          tab: "max-w-fit px-2 h-11 text-sm font-semibold",
          tabContent: "group-data-[selected=true]:font-bold group-data-[selected=true]:text-primary text-slate-500",
        }}
      >
        {tabs.map((tab) => (
          <Tab key={tab.to} title={tab.label} />
        ))}
      </HeroTabs>
    </div>
  );
}

/** Placeholder for an empty list or an unbuilt section. */
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white/50 dark:bg-slate-900/50 flex flex-col items-center justify-center gap-2 p-12 text-center shadow-sm">
      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{title}</p>
      {hint && <p className="max-w-sm text-xs font-medium text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}

