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
  const currency = typeof data?.currency === "string" && data.currency.trim() ? data.currency.trim().toUpperCase() : "USD";

  const getSymbol = (curr: string) => {
    switch (curr) {
      case "USD":
        return "$";
      case "EUR":
        return "€";
      case "GBP":
        return "£";
      default:
        return null;
    }
  };

  const formatMoney = (minor: number, overrideCurrency?: string) => {
    const curr = (overrideCurrency && overrideCurrency.trim()) ? overrideCurrency.trim().toUpperCase() : currency;
    const sym = getSymbol(curr);
    const formatted = (minor / 100).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return sym ? `${sym}${formatted}` : `${formatted} ${curr}`;
  };

  const formatMoneyCompact = (minor: number, overrideCurrency?: string) => {
    const curr = (overrideCurrency && overrideCurrency.trim()) ? overrideCurrency.trim().toUpperCase() : currency;
    const sym = getSymbol(curr);
    const formatted = (minor / 100).toLocaleString(undefined, {
      maximumFractionDigits: 0,
    });
    return sym ? `${sym}${formatted}` : `${formatted} ${curr}`;
  };

  return { currency, formatMoney, formatMoneyCompact };
}
