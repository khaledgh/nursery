import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessagesSquare, Send, Wifi, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { api } from "../../lib/api";
import { RealtimeClient } from "../../lib/realtime";
import { useAuthStore } from "../../store/auth";
import type { ChatMessage, Conversation } from "../../types/api";

/**
 * The web chat inbox.
 *
 * Chat existed only on mobile, so admins and teachers had no way to answer a
 * parent from the dashboard at all.
 */
export function MessagesPage() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [live, setLive] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: async () =>
      (await api.get<{ data: Conversation[] }>("/chat/conversations")).data.data,
    // Backstop only: the socket carries new messages, so this can be slow.
    refetchInterval: live ? 60_000 : 10_000,
  });

  const messages = useQuery({
    queryKey: ["messages", activeId],
    queryFn: async () =>
      (await api.get<{ data: ChatMessage[] }>(`/chat/conversations/${activeId}/messages`)).data.data,
    enabled: Boolean(activeId),
    refetchInterval: live ? false : 4_000,
  });

  // One socket for the page; events invalidate the affected queries.
  useEffect(() => {
    const client = new RealtimeClient(
      (e) => {
        if (e.type === "message.created") {
          void qc.invalidateQueries({ queryKey: ["messages"] });
          void qc.invalidateQueries({ queryKey: ["conversations"] });
        }
      },
      setLive,
    );
    void client.connect();
    return () => client.close();
  }, [qc]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data]);

  // Opening a thread clears its unread badge.
  useEffect(() => {
    if (!activeId) return;
    void api
      .put(`/chat/conversations/${activeId}/read`)
      .then(() => qc.invalidateQueries({ queryKey: ["conversations"] }))
      .catch(() => {
        /* badge will clear on the next poll */
      });
  }, [activeId, qc]);

  const send = useMutation({
    mutationFn: async (body: string) =>
      api.post(`/chat/conversations/${activeId}/messages`, { body }),
    onSuccess: () => {
      setDraft("");
      void qc.invalidateQueries({ queryKey: ["messages", activeId] });
      void qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const active = conversations.data?.find((c) => c.id === activeId);
  const other = (c: Conversation) =>
    c.parent_user?.id === me?.id ? c.recipient_user : c.parent_user;

  return (
    <>
      <PageHeader
        title="Messages"
        subtitle="Conversations with parents."
        actions={
          <span
            className={`badge flex items-center gap-1.5 ${
              live ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
            }`}
            title={live ? "Live updates connected" : "Falling back to polling"}
          >
            {live ? <Wifi size={12} /> : <WifiOff size={12} />}
            {live ? "Live" : "Polling"}
          </span>
        }
      />

      <div className="card grid h-[calc(100vh-230px)] grid-cols-1 overflow-hidden p-0 md:grid-cols-[300px_1fr]">
        <aside className="overflow-y-auto border-e border-slate-100">
          {conversations.data?.length === 0 && (
            <p className="p-6 text-center text-xs font-semibold text-slate-400">
              No conversations yet.
            </p>
          )}
          {conversations.data?.map((c) => {
            const who = other(c);
            return (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                type="button"
                className={`flex w-full items-center gap-3 border-b border-slate-50 px-4 py-3 text-start transition-colors ${
                  c.id === activeId ? "bg-brand-50" : "hover:bg-slate-50"
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-extrabold text-brand-700">
                  {(who?.name ?? "?").slice(0, 2).toUpperCase()}
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-800">
                    {who?.name ?? "Unknown"}
                  </span>
                  <span className="block truncate text-xs font-semibold text-slate-400">
                    {c.last_message_preview || "No messages yet"}
                  </span>
                </span>
                {c.unread_count > 0 && (
                  <span className="shrink-0 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-extrabold text-white">
                    {c.unread_count}
                  </span>
                )}
              </button>
            );
          })}
        </aside>

        <section className="flex min-w-0 flex-col">
          {!activeId ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-300">
              <MessagesSquare size={40} />
              <p className="text-sm font-semibold">Pick a conversation.</p>
            </div>
          ) : (
            <>
              <header className="border-b border-slate-100 px-6 py-4">
                <p className="text-sm font-extrabold text-slate-800">
                  {active ? (other(active)?.name ?? "Conversation") : "Conversation"}
                </p>
                {active?.child && (
                  <p className="text-xs font-semibold text-slate-400">
                    About {active.child.first_name} {active.child.last_name}
                  </p>
                )}
              </header>

              <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
                {messages.data?.map((m) => {
                  const mine = m.sender_user_id === me?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                          mine ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words text-sm font-semibold">{m.body}</p>
                        <p className={`mt-1 text-[10px] font-bold ${mine ? "text-white/60" : "text-slate-400"}`}>
                          {new Date(m.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (draft.trim()) send.mutate(draft.trim());
                }}
                className="flex items-center gap-2 border-t border-slate-100 px-6 py-4"
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Write a reply…"
                  className="input flex-1"
                />
                <button
                  type="submit"
                  className="btn btn-primary shrink-0"
                  disabled={!draft.trim() || send.isPending}
                >
                  <Send size={16} />
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </>
  );
}
