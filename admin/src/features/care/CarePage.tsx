import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api, errorMessage } from "../../lib/api";
import { ImageUpload } from "../../components/ImageUpload";
import type { Child, ListResponse, Media } from "../../types/api";

type LogKind = "diary" | "meal" | "sleep" | "diaper" | "hydration";

/** Teacher quick-logging: pick a child, then log diary/meal/sleep/diaper. */
export function CarePage() {
  const { t } = useTranslation();
  const [childId, setChildId] = useState("");
  const [kind, setKind] = useState<LogKind>("diary");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Diary fields
  const [diaryType, setDiaryType] = useState("activity");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  // Meal fields
  const [mealType, setMealType] = useState("lunch");
  const [mealStatus, setMealStatus] = useState("ate_well");
  // Sleep fields
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [quality, setQuality] = useState(80);
  const [deepMin, setDeepMin] = useState("");
  const [lightMin, setLightMin] = useState("");
  const [awakeMin, setAwakeMin] = useState("");
  const [tookToSleep, setTookToSleep] = useState("");
  const [moodAfter, setMoodAfter] = useState("happy");
  // Diaper fields
  const [wetness, setWetness] = useState("wet");
  const [stool, setStool] = useState("none");
  const [comfort, setComfort] = useState("happy");
  const [note, setNote] = useState("");
  // Hydration fields
  const [cups, setCups] = useState(4);
  const [hydrationRating, setHydrationRating] = useState("good");
  // Photos (diary + meal)
  const [photo, setPhoto] = useState<Media | null>(null);

  const children = useQuery({
    queryKey: ["children-care"],
    queryFn: async () => {
      const res = await api.get<ListResponse<Child>>("/children", { params: { per_page: 100 } });
      return res.data.data;
    },
  });

  const toRFC3339 = (local: string) => (local ? new Date(local).toISOString() : "");

  const submit = useMutation({
    mutationFn: async () => {
      const id = Number(childId);
      switch (kind) {
        case "diary":
          return api.post(`/children/${id}/diary`, {
            type: diaryType,
            title,
            body,
            is_live: true,
            media_ids: photo ? [photo.id] : undefined,
          });
        case "meal":
          return api.post(`/children/${id}/meals`, {
            meal_type: mealType,
            status: mealStatus,
            note,
            image_id: photo?.id ?? undefined,
          });
        case "sleep":
          return api.post(`/children/${id}/sleep`, {
            start_at: toRFC3339(startAt),
            end_at: toRFC3339(endAt),
            quality_pct: quality,
            deep_min: deepMin ? Number(deepMin) : 0,
            light_min: lightMin ? Number(lightMin) : 0,
            awake_min: awakeMin ? Number(awakeMin) : 0,
            took_to_sleep_min: tookToSleep ? Number(tookToSleep) : 0,
            mood_after: moodAfter,
          });
        case "diaper":
          return api.post(`/children/${id}/diaper`, {
            time: new Date().toISOString(),
            wetness,
            stool,
            comfort,
            note,
          });
        case "hydration":
          return api.put(`/children/${id}/hydration`, {
            date: new Date().toISOString().slice(0, 10),
            cups,
            rating: hydrationRating,
          });
      }
    },
    onSuccess: () => {
      setMessage("Logged ✓");
      setError("");
      setTitle("");
      setBody("");
      setNote("");
      setPhoto(null);
      setTimeout(() => setMessage(""), 2500);
    },
    onError: (err) => {
      setMessage("");
      setError(errorMessage(err));
    },
  });

  const KINDS: { id: LogKind; label: string }[] = [
    { id: "diary", label: "Diary" },
    { id: "meal", label: "Meal" },
    { id: "sleep", label: "Sleep" },
    { id: "diaper", label: "Diaper" },
    { id: "hydration", label: "Hydration" },
  ];

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">{t("nav.care")}</h1>
      <div className="card space-y-4 p-6">
        <div>
          <label className="label">Child</label>
          <select className="input" value={childId} onChange={(e) => setChildId(e.target.value)}>
            <option value="">—</option>
            {(children.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.first_name} {c.last_name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          {KINDS.map((k) => (
            <button
              key={k.id}
              className={k.id === kind ? "btn-primary" : "btn-secondary"}
              onClick={() => setKind(k.id)}
              type="button"
            >
              {k.label}
            </button>
          ))}
        </div>

        {kind === "diary" && (
          <div className="space-y-3">
            <select className="input" value={diaryType} onChange={(e) => setDiaryType(e.target.value)}>
              {["activity", "meal", "sleep", "diaper", "note", "photo"].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <input className="input" placeholder={t("common.title")} value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="input" rows={3} placeholder="Details…" value={body} onChange={(e) => setBody(e.target.value)} />
            <ImageUpload label="Photo" value={photo} onChange={setPhoto} />
          </div>
        )}

        {kind === "meal" && (
          <div className="grid grid-cols-2 gap-3">
            <select className="input" value={mealType} onChange={(e) => setMealType(e.target.value)}>
              {["breakfast", "lunch", "snack", "dinner"].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <select className="input" value={mealStatus} onChange={(e) => setMealStatus(e.target.value)}>
              {["ate_well", "ate_half", "ate_little", "didnt_eat"].map((v) => (
                <option key={v} value={v}>
                  {v.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <input
              className="input col-span-2"
              placeholder="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="col-span-2">
              <ImageUpload label="Photo" value={photo} onChange={setPhoto} />
            </div>
          </div>
        )}

        {kind === "sleep" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start</label>
              <input className="input" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </div>
            <div>
              <label className="label">End</label>
              <input className="input" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Quality: {quality}%</label>
              <input
                type="range"
                min={0}
                max={100}
                className="w-full"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
              />
            </div>
            <div className="col-span-2 grid grid-cols-4 gap-3">
              <div>
                <label className="label">Deep (min)</label>
                <input className="input" type="number" value={deepMin} onChange={(e) => setDeepMin(e.target.value)} />
              </div>
              <div>
                <label className="label">Light (min)</label>
                <input className="input" type="number" value={lightMin} onChange={(e) => setLightMin(e.target.value)} />
              </div>
              <div>
                <label className="label">Awake (min)</label>
                <input className="input" type="number" value={awakeMin} onChange={(e) => setAwakeMin(e.target.value)} />
              </div>
              <div>
                <label className="label">Fell asleep in</label>
                <input className="input" type="number" placeholder="min" value={tookToSleep} onChange={(e) => setTookToSleep(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Mood after</label>
              <select className="input" value={moodAfter} onChange={(e) => setMoodAfter(e.target.value)}>
                {["happy", "calm", "fussy", "tired"].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {kind === "hydration" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cups today: {cups}</label>
              <input
                type="range"
                min={0}
                max={12}
                className="w-full"
                value={cups}
                onChange={(e) => setCups(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label">Rating</label>
              <select className="input" value={hydrationRating} onChange={(e) => setHydrationRating(e.target.value)}>
                {["good", "average", "needs_attention"].map((v) => (
                  <option key={v} value={v}>
                    {v.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {kind === "diaper" && (
          <div className="grid grid-cols-3 gap-3">
            <select className="input" value={wetness} onChange={(e) => setWetness(e.target.value)}>
              {["dry", "wet", "heavy"].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <select className="input" value={stool} onChange={(e) => setStool(e.target.value)}>
              {["none", "hard", "normal", "soft", "loose", "diarrhea"].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <select className="input" value={comfort} onChange={(e) => setComfort(e.target.value)}>
              {["happy", "fussy"].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <input
              className="input col-span-3"
              placeholder="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-emerald-600">{message}</p>}
        <button className="btn-primary" disabled={!childId || submit.isPending} onClick={() => submit.mutate()}>
          {submit.isPending ? t("common.saving") : t("common.save")}
        </button>
      </div>
    </div>
  );
}
