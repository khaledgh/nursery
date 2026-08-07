import { api } from "./api";

export interface RealtimeEvent {
  type: "message.created" | "message.read" | "typing" | "conversation.updated";
  data: unknown;
}

/**
 * WebSocket client for chat.
 *
 * Auth uses a short-lived single-use ticket rather than the access token: a
 * browser cannot set headers on a WebSocket handshake, and a token in the query
 * string would land in server logs and proxy history.
 *
 * Reconnects with backoff. Callers keep their polling in place, so a socket
 * that never connects degrades to the previous behaviour instead of leaving the
 * UI stale.
 */
export class RealtimeClient {
  private ws: WebSocket | null = null;
  private closed = false;
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  // Written out rather than using constructor parameter properties, which the
  // project's `erasableSyntaxOnly` setting disallows.
  private onEvent: (e: RealtimeEvent) => void;
  private onStatus?: (connected: boolean) => void;

  constructor(onEvent: (e: RealtimeEvent) => void, onStatus?: (connected: boolean) => void) {
    this.onEvent = onEvent;
    this.onStatus = onStatus;
  }

  async connect(): Promise<void> {
    if (this.closed) return;
    try {
      const { data } = await api.post<{ data: { ticket: string } }>("/chat/ws-ticket");
      const base = (api.defaults.baseURL ?? "").replace(/^http/, "ws");
      const ws = new WebSocket(`${base}/ws/chat?ticket=${encodeURIComponent(data.data.ticket)}`);
      this.ws = ws;

      ws.onopen = () => {
        this.attempt = 0;
        this.onStatus?.(true);
      };
      ws.onmessage = (ev) => {
        try {
          this.onEvent(JSON.parse(ev.data as string) as RealtimeEvent);
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        this.onStatus?.(false);
        this.scheduleReconnect();
      };
      ws.onerror = () => ws.close();
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.closed) return;
    // Exponential backoff, capped, so a server outage doesn't turn every open
    // tab into a retry storm.
    const delay = Math.min(30_000, 1000 * 2 ** this.attempt++);
    this.timer = setTimeout(() => void this.connect(), delay);
  }

  close() {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    this.ws?.close();
    this.ws = null;
  }
}
