import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth";
import type { ItemResponse } from "../types/api";
import { useMeContext } from "./useMeContext";

/** Currency the platform bills nurseries in (superadmin setting). */
export function usePlatformCurrency(enabled = true) {
  return useQuery({
    queryKey: ["platform-currency"],
    queryFn: async () =>
      (await api.get<ItemResponse<{ currency: string }>>("/superadmin/platform-currency")).data.data.currency,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Money formatting for the current console: a nursery admin sees their
 * nursery's billing currency, the superadmin sees the platform currency.
 * Any ISO code (LBP, SAR, AED, SEK…) gets its proper symbol via Intl.
 */
export function useCurrency() {
  const { i18n } = useTranslation();
  const isSuperAdmin = useAuthStore((s) => s.user?.role === "superadmin");
  const ctx = useMeContext();
  const platform = usePlatformCurrency(isSuperAdmin);

  const currency = ((isSuperAdmin ? platform.data : ctx.data?.nursery?.currency) || "USD").toUpperCase();

  const format = (minor: number, curr: string, digits: number) => {
    try {
      return new Intl.NumberFormat(i18n.language || undefined, {
        style: "currency",
        currency: curr,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(minor / 100);
    } catch {
      return `${(minor / 100).toLocaleString(undefined, { maximumFractionDigits: digits })} ${curr}`;
    }
  };

  const pick = (override?: string) => (override && override.trim() ? override.trim().toUpperCase() : currency);

  const formatMoney = (minor: number, overrideCurrency?: string) => format(minor, pick(overrideCurrency), 2);
  const formatMoneyCompact = (minor: number, overrideCurrency?: string) => format(minor, pick(overrideCurrency), 0);

  return { currency, formatMoney, formatMoneyCompact };
}

/** Common currencies offered in pickers; LBP and USD first for Lebanese nurseries. */
export const CURRENCY_OPTIONS = [
  { code: "USD", label: "US Dollar (USD)" },
  { code: "LBP", label: "Lebanese Pound (LBP)" },
  { code: "EUR", label: "Euro (EUR)" },
  { code: "SAR", label: "Saudi Riyal (SAR)" },
  { code: "AED", label: "UAE Dirham (AED)" },
  { code: "KWD", label: "Kuwaiti Dinar (KWD)" },
  { code: "QAR", label: "Qatari Riyal (QAR)" },
  { code: "BHD", label: "Bahraini Dinar (BHD)" },
  { code: "GBP", label: "British Pound (GBP)" },
  { code: "SEK", label: "Swedish Krona (SEK)" },
];
