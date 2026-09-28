import { site } from "../data/site";

export interface DemoRequestPayload {
  full_name: string;
  nursery_name: string;
  email: string;
  phone: string;
  city?: string;
  country?: string;
  children_range?: string;
  preferred_contact_time?: string;
  message?: string;
  locale: string;
  website?: string;
}

export type SubmitResult =
  | { ok: true }
  | { ok: false; kind: "validation"; fields: Record<string, string> }
  | { ok: false; kind: "rate_limited" | "generic" };

export async function submitDemoRequest(payload: DemoRequestPayload): Promise<SubmitResult> {
  try {
    const res = await fetch(`${site.apiUrl}/demo-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept-Language": payload.locale },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };
    if (res.status === 429) return { ok: false, kind: "rate_limited" };
    if (res.status === 422 || res.status === 400) {
      const body = await res.json().catch(() => null);
      const fields = body?.error?.fields;
      if (fields && typeof fields === "object") return { ok: false, kind: "validation", fields };
    }
    return { ok: false, kind: "generic" };
  } catch {
    return { ok: false, kind: "generic" };
  }
}
