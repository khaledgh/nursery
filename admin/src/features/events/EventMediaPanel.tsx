import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImagePlus } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import { uploadMedia } from "../../lib/media";
import { useChildren } from "../../components/Pickers";
import type { EventMedia, ItemResponse } from "../../types/api";

/** Photo album manager for one event (drives the parent app's event details). */
export function EventMediaPanel({ eventId }: { eventId: number }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const kids = useChildren();
  const fileRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [childId, setChildId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const media = useQuery({
    queryKey: ["event-media", eventId],
    queryFn: async () => (await api.get<ItemResponse<EventMedia[]>>(`/events/${eventId}/media`)).data.data ?? [],
  });

  const add = useMutation({
    mutationFn: async (file: File) => {
      const uploaded = await uploadMedia(file);
      return api.post(`/events/${eventId}/media`, {
        media_id: uploaded.id,
        caption,
        child_id: childId ? Number(childId) : null,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["event-media", eventId] });
      setCaption("");
      setError("");
    },
    onError: (err) => setError(errorMessage(err)),
    onSettled: () => setBusy(false),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {(media.data ?? []).map((m) => (
          <figure key={m.id}>
            {m.media && <img src={m.media.url} alt={m.caption} className="h-24 w-full rounded-lg object-cover" />}
            {(m.caption || m.child_id) && (
              <figcaption className="mt-0.5 truncate text-[11px] text-slate-500">
                {m.caption}
                {m.child_id ? ` · child #${m.child_id}` : ""}
              </figcaption>
            )}
          </figure>
        ))}
        {!media.data?.length && !media.isLoading && (
          <p className="col-span-full text-sm text-slate-500">{t("common.noData")}</p>
        )}
      </div>

      <div className="rounded-xl bg-slate-50 p-4">
        <div className="mb-2 text-xs font-semibold uppercase text-slate-500">Add photo</div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1">
            <label className="label !text-xs">Caption</label>
            <input className="input" value={caption} onChange={(e) => setCaption(e.target.value)} />
          </div>
          <div className="w-44">
            <label className="label !text-xs">Tag a child (optional)</label>
            <select className="input" value={childId} onChange={(e) => setChildId(e.target.value)}>
              <option value="">—</option>
              {(kids.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}
                </option>
              ))}
            </select>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setBusy(true);
                add.mutate(f);
              }
              e.target.value = "";
            }}
          />
          <button className="btn-primary" disabled={busy} onClick={() => fileRef.current?.click()}>
            <ImagePlus size={16} /> {busy ? "Uploading…" : "Upload"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
