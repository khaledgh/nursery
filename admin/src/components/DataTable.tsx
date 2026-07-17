import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Meta } from "../types/api";

export interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  meta?: Meta;
  loading?: boolean;
  search?: string;
  onSearch?: (value: string) => void;
  onPage?: (page: number) => void;
  rowKey: (row: T) => string | number;
  toolbar?: ReactNode;
}

export function DataTable<T>({ columns, rows, meta, loading, search, onSearch, onPage, rowKey, toolbar }: DataTableProps<T>) {
  const { t } = useTranslation();
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.per_page)) : 1;

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
        {onSearch && (
          <div className="relative">
            <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input ps-9 w-64"
              placeholder={t("common.search")}
              value={search ?? ""}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
        )}
        <div className="ms-auto flex items-center gap-2">{toolbar}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-start">
              {columns.map((c, i) => (
                <th key={i} className={`px-4 py-3 text-start font-medium text-slate-600 ${c.className ?? ""}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400">
                  {t("common.loading")}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400">
                  {t("common.noData")}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={rowKey(row)} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  {columns.map((c, i) => (
                    <td key={i} className={`px-4 py-3 ${c.className ?? ""}`}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {meta && onPage && (
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
          <span>
            {t("common.page")} {meta.page} {t("common.of")} {totalPages} · {meta.total}
          </span>
          <div className="flex gap-1">
            <button
              className="btn-secondary !px-2 !py-1"
              disabled={meta.page <= 1}
              onClick={() => onPage(meta.page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="btn-secondary !px-2 !py-1"
              disabled={meta.page >= totalPages}
              onClick={() => onPage(meta.page + 1)}
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
