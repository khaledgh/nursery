import { useEffect } from "react";
import { AppState } from "react-native";
import { create } from "zustand";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";
import { queryClient } from "./queryClient";

interface RealtimeEvent {
  type: "message.created" | "message.read" | "typing" | "conversation.updated";
  data?: { conversation_id?: number } | null;
}

/** True while the chat socket is open; chat queries only poll when it is not. */
export const useRealtimeStatus = create<{ connected: boolean }>(() => ({ connected: false }));

const setConnected = (connected: boolean) => useRealtimeStatus.setState({ connected });

/**
 * Chat WebSocket. Auth is a single-use ticket (tokens never go in the URL).
 * Reconnects with capped backoff; callers keep a slow poll as a fallback.
 */
class RealtimeClient {
  private ws: WebSocket | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private active = false;

  start() {
    if (this.active) return;
    this.active = true;
    void this.connect();
  }

  stop() {
    this.active = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.ws?.close();
    this.ws = null;
    setConnected(false);
  }

  private async connect() {
    if (!this.active) return;
    try {
      const { data } = await api.post<{ data: { ticket: string } }>("/chat/ws-ticket");
      if (!this.active) return;
      const base = (api.defaults.baseURL ?? "").replace(/^http/, "ws");
      const ws = new WebSocket(`${base}/ws/chat?ticket=${encodeURIComponent(data.data.ticket)}`);
      this.ws = ws;
      ws.onopen = () => {
        this.attempt = 0;
        setConnected(true);
        // Catch up on anything missed while disconnected.
        void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      };
      ws.onmessage = (ev) => {
        try {
          handle(JSON.parse(String(ev.data)) as RealtimeEvent);
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        setConnected(false);
        this.scheduleReconnect();
      };
      ws.onerror = () => ws.close();
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (!this.active) return;
    const delay = Math.min(60_000, 2000 * 2 ** this.attempt++);
    this.timer = setTimeout(() => void this.connect(), delay);
  }
}

function handle(e: RealtimeEvent) {
  const conversationId = e.data?.conversation_id;
  switch (e.type) {
    case "message.created":
    case "message.read":
      if (conversationId) void queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      break;
    case "conversation.updated":
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      break;
  }
}

const client = new RealtimeClient();

/**
 * Keeps the chat socket open only while the app is in the foreground and a
 * user is signed in — a background socket would drain the battery for
 * nothing, since pushes cover that case.
 */
export function useRealtimeChat() {
  const signedIn = useAuthStore((s) => Boolean(s.accessToken));

  useEffect(() => {
    if (!signedIn) {
      client.stop();
      return;
    }
    if (AppState.currentState === "active") client.start();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") client.start();
      else client.stop();
    });
    return () => {
      sub.remove();
      client.stop();
    };
  }, [signedIn]);
}
