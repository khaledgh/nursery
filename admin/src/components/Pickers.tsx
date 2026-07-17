import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Child, Classroom, ListResponse } from "../types/api";

export function useClassrooms() {
  return useQuery({
    queryKey: ["classrooms-picker"],
    queryFn: async () => {
      const res = await api.get<ListResponse<Classroom>>("/classrooms", { params: { per_page: 100 } });
      return res.data.data;
    },
  });
}

export function useChildren() {
  return useQuery({
    queryKey: ["children-picker"],
    queryFn: async () => {
      const res = await api.get<ListResponse<Child>>("/children", { params: { per_page: 200 } });
      return res.data.data;
    },
  });
}

interface PickerProps {
  value: string;
  onChange: (id: string) => void;
}

export function ClassroomPicker({ value, onChange }: PickerProps) {
  const rooms = useClassrooms();
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— classroom —</option>
      {(rooms.data ?? []).map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
    </select>
  );
}

export function ChildPicker({ value, onChange }: PickerProps) {
  const kids = useChildren();
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— child —</option>
      {(kids.data ?? []).map((c) => (
        <option key={c.id} value={c.id}>
          {c.first_name} {c.last_name}
        </option>
      ))}
    </select>
  );
}
