import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../store/auth";
import type { ApiErrorBody, LoginResponse } from "../types/api";
import { parseApiError } from "./apiError";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8080/api/v1",
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  const { locale } = useAuthStore.getState();
  if (locale) {
    config.headers["Accept-Language"] = locale;
  }
  return config;
});

// Single-flight refresh: concurrent 401s wait on the same refresh call
// instead of each rotating the token (rotation makes the 2nd refresh fail).
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setTokens, logout } = useAuthStore.getState();
  if (!refreshToken) return null;
  try {
    const res = await axios.post<{ data: LoginResponse }>(
      `${api.defaults.baseURL}/auth/refresh`,
      { refresh_token: refreshToken },
    );
    const { tokens, user } = res.data.data;
    setTokens(tokens, user);
    return tokens.access_token;
  } catch {
    logout();
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };
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
 * Prefer `applyServerErrors` in forms — it puts messages on the inputs that
 * failed. This remains for banners and non-form mutations.
 */
export function errorMessage(err: unknown): string {
  return parseApiError(err).message;
}
