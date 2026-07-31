import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import Constants from "expo-constants";
import { File, UploadType } from "expo-file-system";
import { useAuthStore, type AuthUser, type TokenPair } from "../store/auth";
import { parseApiError } from "./apiError";
import type { ItemResponse, Media } from "./types";

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

interface PresignUploadResponse {
  media_id: number;
  upload_url: string;
}

/**
 * Uploads a local file straight to R2, bypassing this API for the bytes:
 * reserve a key (POST /media/presign-upload) -> PUT the file directly to the
 * returned URL -> tell the API the upload landed (POST /media/:id/confirm).
 * Returns the same Media shape the old single-request multipart upload did,
 * so callers only need to swap the call site, not their state handling.
 *
 * Size is read from the file itself rather than trusted from the caller
 * (e.g. expo-image-picker's fileSize is optional and platform-dependent) —
 * the presigned PUT is only valid for the size declared when it was signed.
 */
export async function uploadMedia(uri: string, mime: string): Promise<Media> {
  const file = new File(uri);
  const size = file.size ?? 0;

  const presign = await api.post<ItemResponse<PresignUploadResponse>>("/media/presign-upload", { mime, size });
  const { media_id, upload_url } = presign.data.data;

  const result = await file.upload(upload_url, {
    httpMethod: "PUT",
    uploadType: UploadType.BINARY_CONTENT, // raw bytes, no multipart framing
    mimeType: mime,
    headers: { "Content-Type": mime },
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`upload to storage failed with status ${result.status}`);
  }

  const confirmed = await api.post<ItemResponse<Media>>(`/media/${media_id}/confirm`);
  return confirmed.data.data;
}
