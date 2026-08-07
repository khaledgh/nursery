import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

interface Crumb {
  label: string;
  to?: string;
}

interface Props {
  title: string;
  subtitle?: string;
  /** Trailing content: primary actions, filters, a status badge. */
  actions?: ReactNode;
  /** Rendered above the title; the last entry is the current page. */
  breadcrumbs?: Crumb[];
  /** Shows a back affordance on detail pages. */
  backTo?: string;
}

/**
 * The standard page heading.
 *
 * Every page previously hand-rolled its own `<h1>`, so spacing and weight
 * drifted between screens.
 */
export function PageHeader({ title, subtitle, actions, breadcrumbs, backTo }: Props) {
  return (
    <header className="mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {breadcrumbs.map((c, i) => (
            <span key={`${c.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden="true">/</span>}
              {c.to ? (
                <Link to={c.to} className="hover:text-brand-600 transition-colors">
                  {c.label}
                </Link>
              ) : (
                <span className="text-slate-500">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {backTo && (
            <Link
              to={backTo}
              aria-label="Back"
              className="mt-1 rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
            >
              <ChevronLeft size={16} />
            </Link>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold text-slate-900 truncate">{title}</h1>
            {subtitle && <p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
