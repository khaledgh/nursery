import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, errorMessage } from "../../lib/api";
import { ChildPicker } from "../../components/Pickers";
import { ImageUpload } from "../../components/ImageUpload";
import { toISODate } from "../../components/WeekPicker";
import type { DailyReport, ListResponse, Media, ReportMood, ReportRating } from "../../types/api";

const DIMENSIONS: { key: ReportRating["dimension"]; label: string }[] = [
  { key: "social", label: "Engagement with classmates" },
  { key: "participation", label: "Participation in activities" },
  { key: "listening", label: "Listening to the teacher" },
  { key: "focus", label: "Focus & concentration" },
  { key: "hygiene", label: "Hygiene / self-care" },
  { key: "eating", label: "Meal / eating habits" },
];

const RATING_OPTIONS: ReportRating["rating"][] = ["thriving", "doing_well", "improving", "needs_support"];

const MOODS: { key: ReportMood["key"]; label: string }[] = [
  { key: "social", label: "Social" },
  { key: "creative", label: "Creative" },
  { key: "happy", label: "Happy" },
  { key: "calm", label: "Calm" },
];

const MOOD_OPTIONS: ReportMood["rating"][] = ["great", "good", "okay"];

/** Teacher's end-of-day report editor (drives the parent app's Report screen). */
export function ReportsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [childId, setChildId] = useState("");
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [summary, setSummary] = useState("");
  const [highlight, setHighlight] = useState("");
  const [highlightMedia, setHighlightMedia] = useState<Media | null>(null);
  const [tips, setTips] = useState("");
  const [moods, setMoods] = useState<Record<string, ReportMood["rating"] | "">>({});
  const [ratings, setRatings] = useState<Record<string, { rating: ReportRating["rating"] | ""; note: string }>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const existing = useQuery({
    queryKey: ["report", childId, date],
    enabled: !!childId && !!date,
    queryFn: async () => {
      const res = await api.get<ListResponse<DailyReport>>(`/children/${childId}/reports`, {
        params: { from: date, to: date, per_page: 1 },
      });
      return res.data.data[0] ?? null;
    },
  });

  useEffect(() => {
    const r = existing.data;
    setSummary(r?.summary ?? "");
    setHighlight(r?.highlight_text ?? "");
    setHighlightMedia(r?.highlight_media ?? null);
    setTips((r?.home_tips ?? []).join("\n"));
    setMoods(Object.fromEntries((r?.moods ?? []).map((m) => [m.key, m.rating])));
    setRatings(
      Object.fromEntries((r?.ratings ?? []).map((x) => [x.dimension, { rating: x.rating, note: x.note }])),
    );
    setMessage("");
    setError("");
  }, [existing.data]);

  const save = useMutation({
    mutationFn: async () =>
      api.put(`/children/${childId}/reports`, {
        date,
        summary,
        highlight_text: highlight,
        highlight_media_id: highlightMedia?.id ?? null,
        home_tips: tips.split("\n").map((s) => s.trim()).filter(Boolean),
        moods: MOODS.filter((m) => moods[m.key]).map((m) => ({ key: m.key, rating: moods[m.key] })),
        ratings: DIMENSIONS.filter((d) => ratings[d.key]?.rating).map((d) => ({
          dimension: d.key,
          rating: ratings[d.key].rating,
          note: ratings[d.key].note ?? "",
        })),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["report", childId, date] });
      setMessage("Report saved ✓");
      setError("");
      setTimeout(() => setMessage(""), 2500);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">{t("nav.reports")}</h1>

      <div className="card grid grid-cols-2 gap-3 p-5">
        <div>
          <label className="label">Child</label>
          <ChildPicker value={childId} onChange={setChildId} />
        </div>
        <div>
          <label className="label">{t("common.date")}</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {childId && (
        <>
          <div className="card space-y-3 p-5">
            <h2 className="font-semibold">Day summary</h2>
            <textarea
              className="input"
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="She was happy, engaged and tried her best in all activities."
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {MOODS.map((m) => (
                <div key={m.key}>
                  <label className="label">{m.label}</label>
                  <select
                    className="input"
                    value={moods[m.key] ?? ""}
                    onChange={(e) => setMoods({ ...moods, [m.key]: e.target.value as ReportMood["rating"] })}
                  >
                    <option value="">—</option>
                    {MOOD_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="card space-y-3 p-5">
            <h2 className="font-semibold">Daily development</h2>
            {DIMENSIONS.map((d) => (
              <div key={d.key} className="grid grid-cols-12 items-center gap-2">
                <span className="col-span-4 text-sm">{d.label}</span>
                <select
                  className="input col-span-3"
                  value={ratings[d.key]?.rating ?? ""}
                  onChange={(e) =>
                    setRatings({
                      ...ratings,
                      [d.key]: { rating: e.target.value as ReportRating["rating"], note: ratings[d.key]?.note ?? "" },
                    })
                  }
                >
                  <option value="">—</option>
                  {RATING_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <input
                  className="input col-span-5"
                  placeholder="Note (shown to parents)"
                  value={ratings[d.key]?.note ?? ""}
                  onChange={(e) =>
                    setRatings({
                      ...ratings,
                      [d.key]: { rating: ratings[d.key]?.rating ?? "", note: e.target.value },
                    })
                  }
                />
              </div>
            ))}
          </div>

          <div className="card space-y-3 p-5">
            <h2 className="font-semibold">Today's highlight</h2>
            <textarea
              className="input"
              rows={2}
              value={highlight}
              onChange={(e) => setHighlight(e.target.value)}
              placeholder="Helped a friend pick up crayons and shared toys without being asked."
            />
            <ImageUpload label="Highlight photo" value={highlightMedia} onChange={setHighlightMedia} />
          </div>

          <div className="card space-y-3 p-5">
            <h2 className="font-semibold">How parents can support at home</h2>
            <textarea
              className="input"
              rows={3}
              value={tips}
              onChange={(e) => setTips(e.target.value)}
              placeholder={"One tip per line\nEncourage hand washing before meals.\nPraise her when she shares."}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-emerald-600">{message}</p>}
          <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? t("common.saving") : t("common.save")}
          </button>
        </>
      )}
    </div>
  );
}
