import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

export type Role = "admin" | "teacher" | "parent";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  locale: string;
  avatar?: { url: string } | null;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  locale: string;
  setAuth: (tokens: TokenPair, user: AuthUser) => void;
  setLocale: (locale: string) => void;
  logout: () => void;
}

// Tokens live in the device keychain/keystore, never AsyncStorage.
const secureStorage: StateStorage = {
  getItem: (name) => SecureStore.getItem(name),
  setItem: (name, value) => {
    SecureStore.setItem(name, value);
  },
  removeItem: (name) => {
    void SecureStore.deleteItemAsync(name);
  },
};

/**
 * Where a signed-in user belongs. Teachers get the staff experience; admins
 * fall through to the parent tabs, which is where the read-only views live.
 * Kept in one place so login, the root redirect, and both layout guards can
 * never disagree about it.
 */
export const homeRouteForRole = (role: Role | undefined): "/(teacher)" | "/(tabs)" =>
  role === "teacher" ? "/(teacher)" : "/(tabs)";

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      locale: "en",
      setAuth: (tokens, user) =>
        set({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token, user }),
      setLocale: (locale) => set({ locale }),
      logout: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: "sunnystars-auth",
      storage: createJSONStorage(() => secureStorage),
    },
  ),
);
