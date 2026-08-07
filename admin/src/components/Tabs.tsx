import { Link, NavLink } from "react-router-dom";

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

const linkClass = (isActive: boolean) =>
  `-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm transition-colors ${
    isActive
      ? "border-brand-600 font-extrabold text-brand-700"
      : "border-transparent font-semibold text-slate-500 hover:border-slate-200 hover:text-slate-800"
  }`;

/**
 * Route-backed tabs.
 *
 * Using links rather than local state is what makes a detail page linkable and
 * survive a refresh — the state-driven tabs these replace lived inside a modal,
 * so there was no URL to share in the first place.
 */
export function Tabs({ tabs, base, query = false, active = "" }: TabsProps) {
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((tab) =>
        query ? (
          <Link
            key={tab.to}
            to={tab.to ? `${base}?tab=${tab.to}` : base}
            className={linkClass(active === tab.to)}
          >
            {tab.label}
          </Link>
        ) : (
          <NavLink
            key={tab.to}
            to={tab.to ? `${base}/${tab.to}` : base}
            end={tab.to === ""}
            className={({ isActive }) => linkClass(isActive)}
          >
            {tab.label}
          </NavLink>
        ),
      )}
    </nav>
  );
}

/** Placeholder for an empty list or an unbuilt section. */
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 p-12 text-center">
      <p className="text-sm font-bold text-slate-600">{title}</p>
      {hint && <p className="max-w-sm text-xs font-semibold text-slate-400">{hint}</p>}
    </div>
  );
}
