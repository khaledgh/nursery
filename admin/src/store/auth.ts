import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser, TokenPair } from "../types/api";

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  locale: string;
  setTokens: (tokens: TokenPair, user: AuthUser) => void;
  setLocale: (locale: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      locale: "en",
      setTokens: (tokens, user) =>
        set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          user,
        }),
      setLocale: (locale) => set({ locale }),
      logout: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    { name: "sunnystars-admin-auth" },
  ),
);
