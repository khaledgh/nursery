import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Child, Classroom, ListResponse, User } from "../types/api";

export function useClassrooms(search?: string) {
  return useQuery({
    queryKey: ["classrooms-picker", search],
    queryFn: async () => {
      const res = await api.get<ListResponse<Classroom>>("/classrooms", {
        params: { search: search || undefined, per_page: 50 },
      });
      return res.data.data;
    },
  });
}

export function useChildren(search?: string) {
  return useQuery({
    queryKey: ["children-picker", search],
    queryFn: async () => {
      const res = await api.get<ListResponse<Child>>("/children", {
        params: { search: search || undefined, per_page: 50 },
      });
      return res.data.data;
    },
  });
}

export function useParents(search?: string) {
  return useQuery({
    queryKey: ["parents-picker", search],
    queryFn: async () => {
      const res = await api.get<ListResponse<User>>("/admin/users", {
        params: { role: "parent", search: search || undefined, per_page: 50 },
      });
      return res.data.data;
    },
  });
}

