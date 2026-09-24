import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { api } from "../lib/api";
import type { ListResponse } from "../types/api";

export interface SortDescriptor {
  column?: string;
  direction?: "ascending" | "descending";
}

/**
 * Standard list-page state: server pagination + debounced search + server sorting
 * wired to the standard backend `{ data, meta }` PageQuery envelope.
 */
export function usePagedList<T>(
  key: string,
  url: string,
  extraParams: Record<string, string | number | undefined> = {}
) {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor | undefined>(undefined);

  // Debounce search input by 300ms before sending to server
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Compute server sort param: "column" for asc, "-column" for desc
  const sortParam = sortDescriptor?.column
    ? sortDescriptor.direction === "descending"
      ? `-${sortDescriptor.column}`
      : sortDescriptor.column
    : undefined;

  const query = useQuery({
    queryKey: [key, page, debouncedSearch, sortParam, extraParams],
    queryFn: async () => {
      const res = await api.get<ListResponse<T>>(url, {
        params: {
          page,
          per_page: 20,
          search: debouncedSearch || undefined,
          sort: sortParam,
          ...extraParams,
        },
      });
      return res.data;
    },
    placeholderData: keepPreviousData,
  });

  const handleSortChange = (descriptor: SortDescriptor) => {
    setSortDescriptor(descriptor);
    setPage(1);
  };

  return {
    rows: query.data?.data ?? [],
    meta: query.data?.meta,
    loading: query.isPending,
    page,
    setPage,
    search: searchInput,
    setSearch: (v: string) => {
      setSearchInput(v);
    },
    sortDescriptor,
    setSortDescriptor: handleSortChange,
    refetch: query.refetch,
  };
}
