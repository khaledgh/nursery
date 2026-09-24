import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth";

/** Backs the header notification bell's badge. */
export function useUnreadCount() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { data } = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: async () =>
      (await api.get<{ data: { unread: number } }>("/notifications/unread-count")).data.data.unread,
    enabled: Boolean(accessToken),
    refetchInterval: 60_000,
  });
  return data ?? 0;
}
