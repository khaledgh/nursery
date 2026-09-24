import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Pagination,
  Input,
  Spinner,
} from "@heroui/react";
import type { Meta } from "../types/api";
import type { SortDescriptor } from "../hooks/usePagedList";

export interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  sortKey?: string;
  allowsSorting?: boolean;
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
  sortDescriptor?: SortDescriptor;
  onSortChange?: (descriptor: SortDescriptor) => void;
}

export function DataTable<T>({
  columns,
  rows,
  meta,
  loading,
  search,
  onSearch,
  onPage,
  rowKey,
  toolbar,
  sortDescriptor,
  onSortChange,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.per_page)) : 1;

  const topContent = (
    <div className="flex flex-wrap items-center justify-between gap-3 p-1">
      {onSearch && (
        <div className="w-full sm:w-72">
          <Input
            isClearable
            size="sm"
            variant="bordered"
            radius="lg"
            placeholder={t("common.search")}
            startContent={<Search size={16} className="text-slate-400 shrink-0" />}
            value={search ?? ""}
            onClear={() => onSearch("")}
            onValueChange={(val) => onSearch(val)}
            classNames={{
              inputWrapper: "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm",
            }}
          />
        </div>
      )}
      <div className="ms-auto flex items-center gap-2">{toolbar}</div>
    </div>
  );

  const bottomContent =
    meta && onPage && meta.total > 0 ? (
      <div className="flex flex-wrap items-center justify-between gap-4 p-2 text-sm text-slate-500">
        <span className="text-xs font-semibold">
          {t("common.page")} {meta.page} {t("common.of")} {totalPages} · {meta.total} {t("common.items") || "items"}
        </span>
        <Pagination
          isCompact
          showControls
          showShadow
          color="primary"
          page={meta.page}
          total={totalPages}
          onChange={onPage}
          className="shadow-sm"
        />
      </div>
    ) : null;

  return (
    <Table
      aria-label="Data Table"
      topContent={topContent}
      bottomContent={bottomContent}
      shadow="sm"
      sortDescriptor={sortDescriptor as any}
      onSortChange={(desc) => onSortChange?.(desc as any)}
      classNames={{
        base: "max-w-full overflow-hidden",
        wrapper: "border border-slate-200/70 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 rounded-2xl shadow-sm p-4",
        th: "bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase text-[11px] font-bold tracking-wider py-3.5",
        td: "py-3.5 text-slate-600 dark:text-slate-300 text-sm border-b border-slate-100 dark:border-slate-800/60",
      }}
    >
      <TableHeader>
        {columns.map((col, idx) => (
          <TableColumn
            key={col.sortKey ?? String(idx)}
            className={col.className}
            allowsSorting={col.allowsSorting}
          >
            {col.header}
          </TableColumn>
        ))}
      </TableHeader>
      <TableBody
        items={rows}
        emptyContent={loading ? " " : t("common.noData")}
        loadingContent={<Spinner label={t("common.loading") ?? "Loading..."} color="primary" />}
        isLoading={loading}
      >
        {(item) => (
          <TableRow key={String(rowKey(item))} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
            {columns.map((col, colIdx) => (
              <TableCell key={colIdx} className={col.className}>
                {col.render(item)}
              </TableCell>
            ))}
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

