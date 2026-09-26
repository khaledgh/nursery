import { useQuery } from "@tanstack/react-query";
import {
  Baby,
  Building2,
  CreditCard,
  School,
  Search,
  Users,
  X,
  CornerDownLeft,
  ChevronRight,
  RefreshCw,
  Sparkles,
  Layers,
  BarChart3,
  BellRing,
  ScrollText,
  LayoutDashboard,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth";
import type { SearchHit, SearchResults, SuperAdminSearchResults } from "../types/api";

interface Hit {
  id: number;
  label: string;
  sub: string;
  to: string;
  icon: typeof Baby;
  group: string;
}

/** Debounces a value so typing doesn't fire a request per keystroke. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

const ADMIN_CATEGORIES = [
  { label: "Children", icon: Baby, hint: "Search student name or classroom", filter: "Child" },
  { label: "Parents", icon: Users, hint: "Search parent name or phone", filter: "Parent" },
  { label: "Staff", icon: Users, hint: "Search educators & administrators", filter: "Staff" },
  { label: "Classrooms", icon: School, hint: "Search rooms & capacities", filter: "Room" },
  { label: "Invoices", icon: CreditCard, hint: "Search billings & reference IDs", filter: "INV" },
];

const SUPERADMIN_CATEGORIES = [
  { label: "Nurseries & Tenants", icon: Building2, hint: "Search facilities, ranges & slugs", filter: "Nursery" },
  { label: "Subscription Plans", icon: Layers, hint: "Search tiers, limits & pricing", filter: "Tier" },
  { label: "Platform Invoices", icon: CreditCard, hint: "Search cross-tenant invoices", filter: "INV" },
  { label: "Financial Reports", icon: BarChart3, hint: "Audited run rates & MRR", filter: "Report" },
  { label: "Global Reminders", icon: BellRing, hint: "Platform alerts & schedules", filter: "Reminder" },
  { label: "Audit Logs", icon: ScrollText, hint: "Security & admin event trail", filter: "Audit" },
];

/**
 * ⌘K Command Palette across children, parents, staff, classrooms, and invoices for Admin,
 * and across tenants, login ranges, plans, platform billing, and reports for SuperAdmin.
 */
export function GlobalSearch() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === "superadmin";

  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const query = useDebounced(term.trim(), 200);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      document.body.style.overflow = "";
      setTerm("");
      setCursor(0);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Query: Scoped to SuperAdmin or Nursery Admin
  const { data: hits = [], isFetching } = useQuery({
    queryKey: ["global-search", isSuperAdmin ? "superadmin" : "admin", query],
    enabled: open && query.length >= 2,
    queryFn: async () => {
      const out: Hit[] = [];

      if (isSuperAdmin) {
        // SuperAdmin Cross-Tenant Search
        const { data } = await api.get<{ data: SuperAdminSearchResults }>("/superadmin/search", {
          params: { q: query },
        });
        const r = data.data;

        for (const h of r.nurseries ?? []) {
          out.push({
            id: h.id,
            group: "Nurseries & Facilities",
            icon: Building2,
            label: h.label,
            sub: h.sub,
            to: h.path || `/superadmin/nurseries/${h.id}`,
          });
        }

        for (const h of r.plans ?? []) {
          out.push({
            id: h.id,
            group: "Subscription Plans",
            icon: Layers,
            label: h.label,
            sub: h.sub,
            to: h.path || "/superadmin/plans",
          });
        }

        for (const h of r.invoices ?? []) {
          out.push({
            id: h.id,
            group: "Platform Invoices",
            icon: CreditCard,
            label: h.label,
            sub: h.sub,
            to: h.path || `/superadmin/nurseries/${h.id}`,
          });
        }

        for (const h of r.pages ?? []) {
          out.push({
            id: h.id || Math.random(),
            group: "Platform Navigation",
            icon: LayoutDashboard,
            label: h.label,
            sub: h.sub,
            to: h.path || "/superadmin/dashboard",
          });
        }
      } else {
        // Tenant-Scoped Admin Search
        const { data } = await api.get<{ data: SearchResults }>("/admin/search", {
          params: { q: query },
        });
        const r = data.data;

        const push = (
          rows: SearchHit[] | undefined,
          group: string,
          icon: typeof Baby,
          to: (h: SearchHit) => string
        ) => {
          for (const h of rows ?? []) {
            out.push({ id: h.id, group, icon, label: h.label, sub: h.sub, to: to(h) });
          }
        };

        push(r.children, "Children", Baby, (h) => `/children/${h.id}`);
        push(r.parents, "Parents", Users, (h) => `/parents/${h.id}`);
        push(r.staff, "Staff", Users, () => "/users");
        push(r.classrooms, "Classrooms", School, () => "/classrooms");
        push(r.invoices, "Invoices", CreditCard, () => "/invoices");
      }

      return out;
    },
  });

  const go = (hit: Hit) => {
    navigate(hit.to);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter" && hits[cursor]) {
      e.preventDefault();
      go(hits[cursor]);
    }
  };

  const categories = isSuperAdmin ? SUPERADMIN_CATEGORIES : ADMIN_CATEGORIES;

  return (
    <>
      {/* Header Search Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        className="group flex w-44 sm:w-56 md:w-64 items-center gap-2 rounded-xl border border-slate-200/90 dark:border-slate-700/90 bg-slate-50/90 dark:bg-slate-800/80 px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 transition-all hover:bg-white dark:hover:bg-slate-800 hover:border-teal-500/60 hover:text-slate-800 dark:hover:text-slate-200 hover:shadow-sm"
        type="button"
        title="Open search (Ctrl+K or ⌘K)"
      >
        <Search
          size={14}
          className="shrink-0 text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform"
        />
        <span className="flex-1 text-start text-xs font-semibold truncate">
          {isSuperAdmin ? "Search platform…" : "Search nursery…"}
        </span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 shadow-xs">
          ⌘K
        </kbd>
      </button>

      {/* Modern Backdrop & Command Palette Modal in Portal */}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-start justify-center p-3 sm:p-4 pt-[10vh] sm:pt-[12vh]">
            {/* Dimmed Blurred Backdrop across 100% of the viewport */}
            <div
              className="fixed inset-0 bg-slate-950/70 dark:bg-black/85 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
              onClick={() => setOpen(false)}
            />

            {/* Palette Card */}
            <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden ring-1 ring-black/10 dark:ring-white/10 animate-in fade-in-0 zoom-in-95 duration-150">
              {/* Search Input Bar */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                <Search size={18} className="shrink-0 text-teal-600 dark:text-teal-400" />
                <input
                  ref={inputRef}
                  value={term}
                  onChange={(e) => {
                    setTerm(e.target.value);
                    setCursor(0);
                  }}
                  onKeyDown={onKeyDown}
                  placeholder={
                    isSuperAdmin
                      ? "Search nurseries, login ranges, plans, invoices, pages…"
                      : "Search children, parents, staff, classrooms, invoices…"
                  }
                  className="flex-1 border-none bg-transparent text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 placeholder:font-normal"
                />

                <div className="flex items-center gap-1.5 shrink-0">
                  {isFetching && (
                    <RefreshCw size={15} className="animate-spin text-teal-600 dark:text-teal-400" />
                  )}
                  {term && (
                    <button
                      type="button"
                      onClick={() => {
                        setTerm("");
                        inputRef.current?.focus();
                      }}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Clear input"
                    >
                      <X size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800 px-2 py-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    ESC
                  </button>
                </div>
              </div>

              {/* Results / Quick Guide Area */}
              <div className="max-h-[60vh] sm:max-h-[420px] overflow-y-auto">
                {query.length < 2 ? (
                  <div className="p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        <Sparkles size={14} className="text-teal-600 dark:text-teal-400" />
                        <span>
                          {isSuperAdmin
                            ? "Platform Console Directory"
                            : "Quick Search Directory"}
                        </span>
                      </div>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                        {isSuperAdmin ? "SuperAdmin Mode" : "Nursery Scope"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {categories.map((cat) => {
                        const Icon = cat.icon;
                        return (
                          <button
                            key={cat.label}
                            type="button"
                            onClick={() => {
                              setTerm(cat.filter);
                              inputRef.current?.focus();
                            }}
                            className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-teal-500/10 hover:border-teal-500/30 text-start transition-all group"
                          >
                            <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                              <Icon size={16} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-teal-700 dark:group-hover:text-teal-300">
                                {cat.label}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {cat.hint}
                              </div>
                            </div>
                            <ChevronRight
                              size={14}
                              className="text-slate-300 group-hover:text-teal-500 transition-colors"
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : isFetching && hits.length === 0 ? (
                  <div className="px-5 py-12 text-center space-y-2">
                    <RefreshCw size={24} className="animate-spin text-teal-600 mx-auto" />
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Searching records for “{query}”…
                    </p>
                  </div>
                ) : hits.length === 0 ? (
                  <div className="px-5 py-12 text-center space-y-2">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                      <Search size={20} />
                    </div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      No results found for “{query}”
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                      {isSuperAdmin
                        ? "Try searching by nursery name, login range number, plan code, or invoice number."
                        : "Try searching by full child name, parent phone number, classroom room name, or invoice reference number."}
                    </p>
                  </div>
                ) : (
                  <div className="py-2 px-2">
                    {hits.map((hit, i) => {
                      const Icon = hit.icon;
                      const isSelected = i === cursor;
                      return (
                        <button
                          key={`${hit.group}-${hit.id}-${i}`}
                          onMouseEnter={() => setCursor(i)}
                          onClick={() => go(hit)}
                          type="button"
                          className={`flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-start transition-all ${
                            isSelected
                              ? "bg-teal-50 dark:bg-teal-950/40 text-teal-950 dark:text-teal-100 ring-1 ring-teal-500/30"
                              : "hover:bg-slate-100/70 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200"
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                              isSelected
                                ? "bg-teal-600 text-white shadow-xs"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                            }`}
                          >
                            <Icon size={16} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs sm:text-sm font-bold truncate">
                                {hit.label}
                              </span>
                              <span
                                className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md ${
                                  isSelected
                                    ? "bg-teal-200/60 dark:bg-teal-800/60 text-teal-900 dark:text-teal-100"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                                }`}
                              >
                                {hit.group}
                              </span>
                            </div>
                            {hit.sub && (
                              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                {hit.sub}
                              </div>
                            )}
                          </div>

                          <div className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-teal-600 dark:text-teal-400">
                            <CornerDownLeft
                              size={13}
                              className={isSelected ? "opacity-100" : "opacity-0"}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Keyboard Shortcuts Footer */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-150 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-[10px] shadow-xs">
                      ↑
                    </kbd>
                    <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-[10px] shadow-xs">
                      ↓
                    </kbd>
                    <span className="ml-1">Navigate</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-[10px] shadow-xs">
                      ↵
                    </kbd>
                    <span className="ml-1">Select</span>
                  </span>
                </div>
                <span className="inline-flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-[10px] shadow-xs">
                    esc
                  </kbd>
                  <span className="ml-1">Close</span>
                </span>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
