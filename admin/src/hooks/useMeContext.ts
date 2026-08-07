import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth";
import type { Capability, MeContext, SeatUsage } from "../types/api";

/**
 * Identity, tenant, purchased modules, and seat usage in one call.
 *
 * The SPA fetches this once on load and uses it to hide nav items the plan
 * doesn't include — but hiding is a convenience, not a control. The API
 * enforces the same rules with RequireCapability, so a hand-typed URL still
 * gets a 403.
 */
export function useMeContext() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["me-context"],
    queryFn: async () => (await api.get<{ data: MeContext }>("/me/context")).data.data,
    enabled: Boolean(accessToken),
    staleTime: 5 * 60_000,
  });
}

/** True when the nursery's plan includes this module. */
export function useCapability(capability: Capability): boolean {
  const { data } = useMeContext();
  // Default to visible while loading, so nav doesn't flicker on every refresh.
  if (!data) return true;
  return data.capabilities.includes(capability);
}

/** Seat usage for the dashboard meter and the billing banner. */
export function useSeats(): SeatUsage | undefined {
  return useMeContext().data?.seats;
}

/**
 * Nursery-level write lock. True once a subscription lapses past its grace
 * window — reads deliberately stay available.
 */
export function useWritesBlocked(): boolean {
  const seats = useSeats();
  return seats ? !seats.allows_writes : false;
}
