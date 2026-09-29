import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Select, SelectItem, Switch } from "@heroui/react";
import { Building2, Check, Coins, Droplets, Save, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImageUpload } from "../../components/ImageUpload";
import { PageHeader } from "../../components/PageHeader";
import { CURRENCY_OPTIONS } from "../../hooks/useCurrency";
import { api, errorMessage } from "../../lib/api";
import type { ItemResponse, Media } from "../../types/api";

type Position = "bottom_right" | "bottom_left" | "top_right" | "top_left" | "center";

interface NurseryProfile {
  id: number;
  name: string;
  currency: string;
  logo_media_id: number | null;
  logo?: Media | null;
  watermark_enabled: boolean;
  watermark_media_id: number | null;
  watermark?: Media | null;
  watermark_position: Position;
  watermark_opacity: number;
}

const POSITIONS: { key: Position; label: string }[] = [
  { key: "bottom_right", label: "Bottom right" },
  { key: "bottom_left", label: "Bottom left" },
  { key: "top_right", label: "Top right" },
  { key: "top_left", label: "Top left" },
  { key: "center", label: "Center" },
];

const PREVIEW_POSITION: Record<Position, string> = {
  bottom_right: "bottom-[3%] right-[3%]",
  bottom_left: "bottom-[3%] left-[3%]",
  top_right: "top-[3%] right-[3%]",
  top_left: "top-[3%] left-[3%]",
  center: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
};

/** Nursery admin settings: identity, billing currency and photo watermark. */
export function NurserySettingsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [logo, setLogo] = useState<Media | null>(null);
  const [wmEnabled, setWmEnabled] = useState(false);
  const [wmImage, setWmImage] = useState<Media | null>(null);
  const [wmPosition, setWmPosition] = useState<Position>("bottom_right");
  const [wmOpacity, setWmOpacity] = useState(60);

  const profile = useQuery({
    queryKey: ["nursery-profile"],
    queryFn: async () => (await api.get<ItemResponse<NurseryProfile>>("/admin/nursery-profile")).data.data,
  });

  useEffect(() => {
    const p = profile.data;
    if (!p) return;
    setName(p.name);
    setCurrency(p.currency || "USD");
    setLogo(p.logo ?? null);
    setWmEnabled(p.watermark_enabled);
    setWmImage(p.watermark ?? null);
    setWmPosition(p.watermark_position);
    setWmOpacity(p.watermark_opacity || 60);
  }, [profile.data]);

  const save = useMutation({
    mutationFn: async () =>
      api.put("/admin/nursery-profile", {
        name: name.trim(),
        currency,
        logo_media_id: logo?.id ?? 0,
        watermark_enabled: wmEnabled,
        watermark_media_id: wmImage?.id ?? 0,
        watermark_position: wmPosition,
        watermark_opacity: wmOpacity,
      }),
    onSuccess: () => {
      setError("");
      setSaved(true);
      void qc.invalidateQueries({ queryKey: ["nursery-profile"] });
      void qc.invalidateQueries({ queryKey: ["me-context"] });
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  // The watermark falls back to the nursery logo when no dedicated image is set.
  const previewMark = wmImage ?? logo;

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={t("nav.settings")}
        subtitle="Your nursery's name, logo, billing currency and photo watermark"
        actions={
          <Button
            color="primary"
            radius="lg"
            startContent={saved ? <Check size={16} /> : <Save size={16} />}
            isLoading={save.isPending}
            isDisabled={!name.trim()}
            onPress={() => save.mutate()}
            className="font-bold shadow-md shadow-primary/25"
          >
            {saved ? "Saved ✓" : t("common.save")}
          </Button>
        }
      />

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm font-semibold flex items-center gap-2">
          <ShieldAlert size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="card p-6 space-y-5 border border-slate-200/80 dark:border-slate-800">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Building2 size={18} className="text-primary" /> Nursery profile
        </h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">Nursery name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <ImageUpload label="Logo" value={logo} onChange={setLogo} folder="branding" />
        </div>
      </section>

      <section className="card p-6 space-y-4 border border-slate-200/80 dark:border-slate-800">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Coins size={18} className="text-amber-500" /> Billing currency
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Used for new parent invoices, fees and reports in your nursery.</p>
        </div>
        <Select
          aria-label="Currency"
          variant="bordered"
          className="max-w-xs"
          selectedKeys={[currency]}
          onChange={(e) => e.target.value && setCurrency(e.target.value)}
        >
          {CURRENCY_OPTIONS.map((c) => (
            <SelectItem key={c.code} textValue={c.label}>
              {c.label}
            </SelectItem>
          ))}
        </Select>
      </section>

      <section className="card p-6 space-y-5 border border-slate-200/80 dark:border-slate-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Droplets size={18} className="text-sky-500" /> Photo watermark
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Stamps your logo onto children's photos (diary, gallery, events, community) when they are uploaded.
              Applies to new photos only.
            </p>
          </div>
          <Switch isSelected={wmEnabled} onValueChange={setWmEnabled} color="primary" aria-label="Enable watermark" />
        </div>

        <div className={`grid gap-6 sm:grid-cols-2 ${wmEnabled ? "" : "opacity-50 pointer-events-none"}`}>
          <div className="space-y-4">
            <ImageUpload label="Watermark image (PNG with transparency works best)" value={wmImage} onChange={setWmImage} folder="branding" />
            {!wmImage && logo && <p className="text-xs text-slate-400">No image chosen — your logo will be used.</p>}
            <Select
              label="Position"
              labelPlacement="outside"
              variant="bordered"
              selectedKeys={[wmPosition]}
              onChange={(e) => e.target.value && setWmPosition(e.target.value as Position)}
            >
              {POSITIONS.map((p) => (
                <SelectItem key={p.key} textValue={p.label}>
                  {p.label}
                </SelectItem>
              ))}
            </Select>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex justify-between mb-1.5">
                <span>Opacity</span>
                <span className="font-mono">{wmOpacity}%</span>
              </label>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={wmOpacity}
                onChange={(e) => setWmOpacity(Number(e.target.value))}
                className="w-full accent-[#2CAFA8]"
              />
            </div>
          </div>

          <div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">Preview</span>
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br from-amber-200 via-rose-200 to-sky-300">
              <span className="absolute inset-0 grid place-items-center text-5xl" aria-hidden="true">
                🧒🎨
              </span>
              {previewMark ? (
                <img
                  src={previewMark.url}
                  alt="Watermark preview"
                  className={`absolute w-[18%] ${PREVIEW_POSITION[wmPosition]}`}
                  style={{ opacity: wmOpacity / 100 }}
                />
              ) : (
                <span className="absolute bottom-3 right-3 rounded-lg bg-white/80 px-2 py-1 text-[11px] font-bold text-slate-600">
                  Upload a logo or watermark image
                </span>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
