import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api";
import type { ListResponse } from "../types/api";

/**
 * Standard list-page state: page + debached-enough search wired to the
 * `{ data, meta }` envelope every list endpoint returns.
 */
export function usePagedList<T>(key: string, url: string, extraParams: Record<string, string | number | undefined> = {}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: [key, page, search, extraParams],
    queryFn: async () => {
      const res = await api.get<ListResponse<T>>(url, {
        params: { page, per_page: 20, search: search || undefined, ...extraParams },
      });
      return res.data;
    },
    placeholderData: keepPreviousData,
  });

  return {
    rows: query.data?.data ?? [],
    meta: query.data?.meta,
    loading: query.isPending,
    page,
    setPage,
    search,
    setSearch: (v: string) => {
      setSearch(v);
      setPage(1);
    },
    refetch: query.refetch,
  };
}
