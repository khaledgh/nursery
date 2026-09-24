import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { ItemResponse } from "../types/api";

export function useNurserySettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await api.get<ItemResponse<Record<string, any>>>("/admin/settings");
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCurrency() {
  const { data } = useNurserySettings();
  const currency = (typeof data?.currency === "string" && data.currency.trim()) ? data.currency.trim().toUpperCase() : "SEK";

  const formatMoney = (minor: number, overrideCurrency?: string) => {
    const curr = (overrideCurrency && (currency === "SEK" || overrideCurrency !== "SEK")) ? overrideCurrency : currency;
    return `${(minor / 100).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${curr}`;
  };

  const formatMoneyCompact = (minor: number, overrideCurrency?: string) => {
    const curr = (overrideCurrency && (currency === "SEK" || overrideCurrency !== "SEK")) ? overrideCurrency : currency;
    return `${(minor / 100).toLocaleString(undefined, {
      maximumFractionDigits: 0,
    })} ${curr}`;
  };

  return { currency, formatMoney, formatMoneyCompact };
}
