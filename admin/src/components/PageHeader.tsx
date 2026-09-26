import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Breadcrumbs, BreadcrumbItem, Button } from "@heroui/react";

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
 * Modern page heading with HeroUI Breadcrumbs and Button.
 */
export function PageHeader({ title, subtitle, actions, breadcrumbs, backTo }: Props) {
  return (
    <header className="mb-3 sm:mb-4 space-y-0.5">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs size="sm" variant="light" color="primary" className="mb-0.5">
          {breadcrumbs.map((c, i) => (
            <BreadcrumbItem key={`${c.label}-${i}`} href={c.to} className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              {c.label}
            </BreadcrumbItem>
          ))}
        </Breadcrumbs>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {backTo && (
            <Button
              as={Link}
              to={backTo}
              isIconOnly
              size="sm"
              variant="flat"
              radius="lg"
              aria-label="Back"
              className="h-8 w-8 min-w-8 text-slate-600 hover:text-slate-900 dark:text-slate-300"
            >
              <ChevronLeft size={16} />
            </Button>
          )}
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-0.5 text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 font-medium">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

