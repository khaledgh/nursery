import { useQuery } from "@tanstack/react-query";
import { Baby, CreditCard, School, Search, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { SearchHit, SearchResults } from "../types/api";

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

/**
 * ⌘K palette across children, parents, staff, classrooms, and invoices.
 *
 * The header previously rendered a search input with no state and no handler —
 * it looked functional but did nothing.
 */
export function GlobalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const query = useDebounced(term.trim(), 250);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else {
      setTerm("");
      setCursor(0);
    }
  }, [open]);

  const { data: hits = [], isFetching } = useQuery({
    queryKey: ["global-search", query],
    enabled: open && query.length >= 2,
    queryFn: async () => {
      // One tenant-scoped, capability-aware call. This replaced a four-request
      // client fan-out that also surfaced invoices to nurseries whose plan
      // excluded the payments module.
      const { data } = await api.get<{ data: SearchResults }>("/admin/search", {
        params: { q: query },
      });
      const r = data.data;

      const out: Hit[] = [];
      const push = (
        rows: SearchHit[] | undefined,
        group: string,
        icon: typeof Baby,
        to: (h: SearchHit) => string,
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

  let lastGroup = "";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-48 items-center gap-2 rounded-xl border-none bg-slate-50/70 px-4 py-2 ps-3 text-xs text-slate-400 transition-all hover:bg-slate-100 md:w-64"
        type="button"
      >
        <Search size={16} className="shrink-0" />
        <span className="flex-1 text-start">Search…</span>
        <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-400 md:inline">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="card relative z-10 w-full max-w-xl overflow-hidden p-0">
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <Search size={18} className="shrink-0 text-slate-400" />
              <input
                ref={inputRef}
                value={term}
                onChange={(e) => {
                  setTerm(e.target.value);
                  setCursor(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Search children, parents, staff, rooms, invoices…"
                className="flex-1 border-none bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="max-h-80 overflow-y-auto">
              {query.length < 2 ? (
                <p className="px-5 py-8 text-center text-xs font-semibold text-slate-400">
                  Type at least two characters.
                </p>
              ) : isFetching && hits.length === 0 ? (
                <p className="px-5 py-8 text-center text-xs font-semibold text-slate-400">Searching…</p>
              ) : hits.length === 0 ? (
                <p className="px-5 py-8 text-center text-xs font-semibold text-slate-400">
                  Nothing matched “{query}”.
                </p>
              ) : (
                <ul className="py-2">
                  {hits.map((hit, i) => {
                    const header = hit.group !== lastGroup ? hit.group : null;
                    lastGroup = hit.group;
                    const Icon = hit.icon;
                    return (
                      <li key={`${hit.group}-${hit.id}`}>
                        {header && (
                          <p className="px-5 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {header}
                          </p>
                        )}
                        <button
                          onMouseEnter={() => setCursor(i)}
                          onClick={() => go(hit)}
                          type="button"
                          className={`flex w-full items-center gap-3 px-5 py-2.5 text-start transition-colors ${
                            i === cursor ? "bg-brand-50" : "hover:bg-slate-50"
                          }`}
                        >
                          <Icon size={15} className="shrink-0 text-slate-400" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold text-slate-800">{hit.label}</span>
                            {hit.sub && (
                              <span className="block truncate text-xs font-semibold text-slate-400">{hit.sub}</span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
