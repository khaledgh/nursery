import axios from "axios";
import type { ApiErrorBody } from "../types/api";

export interface ParsedApiError {
  /** Machine code: "validation_failed" | "conflict" | "network" | ... */
  code: string;
  /** Human summary, safe for a banner. Never empty. */
  message: string;
  /** Server field names (as sent in the request) mapped to their message. */
  fields: Record<string, string>;
  /** HTTP status, or 0 when the request never reached the server. */
  status: number;
}

/**
 * Normalises anything thrown by a mutation into one shape.
 *
 * The API answers failures with {"error":{code,message,fields}}; `fields` is
 * what lets a form mark the input that actually failed, so it must survive
 * intact rather than being flattened into a sentence.
 */
export function parseApiError(err: unknown): ParsedApiError {
  if (axios.isAxiosError<ApiErrorBody>(err)) {
    const body = err.response?.data?.error;
    if (body) {
      return {
        code: body.code || "error",
        message: body.message || "Something went wrong",
        fields: body.fields ?? {},
        status: err.response?.status ?? 0,
      };
    }
    if (err.code === "ERR_NETWORK" || err.code === "ECONNABORTED") {
      return { code: "network", message: "Cannot reach the server", fields: {}, status: 0 };
    }
  }
  // Locally thrown guards still need to reach the UI. An empty message is the
  // caller saying it has already shown the problem (e.g. via form.setError),
  // so it stays empty rather than becoming a redundant banner.
  if (err instanceof Error) {
    return { code: "client", message: err.message, fields: {}, status: 0 };
  }
  return { code: "unknown", message: "Something went wrong", fields: {}, status: 0 };
}
