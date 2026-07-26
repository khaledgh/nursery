import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import Constants from "expo-constants";
import { useAuthStore, type AuthUser, type TokenPair } from "../store/auth";
import { parseApiError } from "./apiError";

// On a device "localhost" is the device itself, so in development derive the
// API host from the Metro dev server (same machine as the API). An explicit
// extra.apiUrl (production builds) always wins.
function resolveBaseURL(): string {
  const configured = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  if (configured) return configured;
  const devHost = Constants.expoConfig?.hostUri?.split(":")[0];
  if (devHost) return `http://${devHost}:8080/api/v1`;
  return "http://localhost:8080/api/v1";
}

const baseURL: string = resolveBaseURL();

export const api = axios.create({ baseURL, timeout: 20000 });

api.interceptors.request.use((config) => {
  const { accessToken, locale } = useAuthStore.getState();
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  if (locale) config.headers["Accept-Language"] = locale;
  return config;
});

// Single-flight refresh: rotation invalidates the old token, so concurrent
// 401s must share one refresh request.
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setAuth, logout } = useAuthStore.getState();
  if (!refreshToken) return null;
  try {
    const res = await axios.post<{ data: { user: AuthUser; tokens: TokenPair } }>(
      `${baseURL}/auth/refresh`,
      { refresh_token: refreshToken },
    );
    const { tokens, user } = res.data.data;
    setAuth(tokens, user);
    return tokens.access_token;
  } catch {
    logout();
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original._retried && !original.url?.includes("/auth/")) {
      original._retried = true;
      refreshing ??= refreshAccessToken().finally(() => {
        refreshing = null;
      });
      const token = await refreshing;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

export { parseApiError } from "./apiError";
export type { ParsedApiError } from "./apiError";

/**
 * Extracts a human-readable message from an API error.
 *
 * Prefer useFieldErrors in forms — it puts messages on the inputs that failed.
 * This remains for banners and non-form requests.
 */
export function errorMessage(err: unknown): string {
  return parseApiError(err).message;
}
