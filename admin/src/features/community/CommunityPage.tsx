import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Heart, MessageCircle, Trash2 } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import type { CommunityPost, ListResponse } from "../../types/api";

type Target = { kind: "post" | "comment"; id: number; label: string };

/** Read-only feed with moderation (delete post / comment). */
export function CommunityPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [deleting, setDeleting] = useState<Target | null>(null);
  const [error, setError] = useState("");

  const posts = useQuery({
    queryKey: ["community-admin"],
    queryFn: async () =>
      (await api.get<ListResponse<CommunityPost>>("/community/posts", { params: { per_page: 50 } })).data.data,
  });

  const remove = useMutation({
    mutationFn: async (target: Target) =>
      target.kind === "post"
        ? api.delete(`/community/posts/${target.id}`)
        : api.delete(`/community/comments/${target.id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["community-admin"] });
      setDeleting(null);
      setError("");
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const timeAgo = (iso: string) => new Date(iso).toLocaleString();

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">{t("nav.community")}</h1>
      <p className="text-sm text-slate-500">Parent community feed — remove anything inappropriate.</p>

      {posts.isLoading && <p className="text-sm text-slate-500">{t("common.loading")}</p>}
      {!posts.isLoading && !posts.data?.length && (
        <div className="card p-10 text-center text-sm text-slate-500">{t("common.noData")}</div>
      )}

      {(posts.data ?? []).map((post) => (
        <div key={post.id} className="card space-y-3 p-5">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-medium">{post.author?.name ?? "Unknown"}</span>
              <span className="badge ms-2 bg-brand-100 text-brand-700">{post.author?.role}</span>
              {post.type === "activity" && <span className="badge ms-1 bg-emerald-100 text-emerald-700">meetup</span>}
              <div className="text-xs text-slate-400">{timeAgo(post.created_at)}</div>
            </div>
            <button
              className="text-slate-400 hover:text-red-600"
              onClick={() => setDeleting({ kind: "post", id: post.id, label: "post" })}
              aria-label="Delete post"
            >
              <Trash2 size={16} />
            </button>
          </div>

          <p className="whitespace-pre-wrap text-sm">{post.body}</p>

          {!!post.media?.length && (
            <div className="flex gap-2 overflow-x-auto">
              {post.media.map(
                (m, i) =>
                  m.media && (
                    <img key={i} src={m.media.url} alt="" className="h-24 w-24 rounded-lg object-cover" />
                  ),
              )}
            </div>
          )}

          {post.meetup && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              📅 <span className="font-medium">{post.meetup.title}</span> · {post.meetup.location} ·{" "}
              {new Date(post.meetup.starts_at).toLocaleString()}
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Heart size={14} /> {post.likes?.length ?? 0}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle size={14} /> {post.comments?.length ?? 0}
            </span>
          </div>

          {!!post.comments?.length && (
            <ul className="space-y-2 border-t border-slate-100 pt-3">
              {post.comments.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <span className="font-medium">{c.author?.name ?? "Unknown"}: </span>
                    {c.body}
                  </div>
                  <button
                    className="text-slate-300 hover:text-red-600"
                    onClick={() => setDeleting({ kind: "comment", id: c.id, label: "comment" })}
                    aria-label="Delete comment"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <ConfirmDialog
        open={!!deleting}
        title={`Delete this ${deleting?.label}?`}
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
