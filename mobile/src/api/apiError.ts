import axios from "axios";

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string>;
  };
}

export interface ParsedApiError {
  /** Machine code: "validation_failed" | "conflict" | "network" | ... */
  code: string;
  /** Human summary, safe for a banner. */
  message: string;
  /** Server field names (as sent in the request) mapped to their message. */
  fields: Record<string, string>;
  /** HTTP status, or 0 when the request never reached the server. */
  status: number;
}

/**
 * Normalises anything thrown by a request into one shape.
 *
 * The API answers failures with {"error":{code,message,fields}}; `fields` is
 * what lets a screen mark the input that actually failed, so it must survive
 * intact rather than collapsing to a single sentence.
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
  if (err instanceof Error && err.message) {
    return { code: "client", message: err.message, fields: {}, status: 0 };
  }
  return { code: "unknown", message: "Something went wrong", fields: {}, status: 0 };
}
