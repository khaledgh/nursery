import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, errorMessage } from "../../lib/api";
import type { ItemResponse } from "../../types/api";

type Settings = Record<string, unknown>;

export function SettingsPage() {
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [storageDriver, setStorageDriver] = useState("local");
  const [nurseryName, setNurseryName] = useState("");
  const [defaultLocale, setDefaultLocale] = useState("en");

  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await api.get<ItemResponse<Settings>>("/admin/settings");
      return res.data.data;
    },
  });

  useEffect(() => {
    if (settings.data) {
      if (typeof settings.data.storage_driver === "string") setStorageDriver(settings.data.storage_driver);
      if (typeof settings.data.nursery_name === "string") setNurseryName(settings.data.nursery_name);
      if (typeof settings.data.default_locale === "string") setDefaultLocale(settings.data.default_locale);
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: async () =>
      api.put("/admin/settings", {
        storage_driver: storageDriver,
        nursery_name: nurseryName,
        default_locale: defaultLocale,
      }),
    onSuccess: () => {
      setSaved(true);
      setError("");
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">{t("nav.settings")}</h1>
      <div className="card space-y-5 p-6">
        <div>
          <label className="label">Nursery name</label>
          <input className="input" value={nurseryName} onChange={(e) => setNurseryName(e.target.value)} />
        </div>
        <div>
          <label className="label">Media storage</label>
          <div className="flex gap-3">
            {(["local", "s3"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setStorageDriver(d)}
                className={`flex-1 rounded-lg border-2 p-4 text-start text-sm ${
                  storageDriver === d ? "border-brand-600 bg-brand-50" : "border-slate-200"
                }`}
              >
                <div className="font-medium">{d === "local" ? "Local disk" : "Amazon S3"}</div>
                <div className="text-xs text-slate-500">
                  {d === "local" ? "Files on the API server volume" : "Bucket configured via server .env"}
                </div>
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            S3 credentials live in the server environment, never in this panel.
          </p>
        </div>
        <div>
          <label className="label">Default language</label>
          <input className="input w-32" value={defaultLocale} onChange={(e) => setDefaultLocale(e.target.value)} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-emerald-600">Saved ✓</p>}
        <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? t("common.saving") : t("common.save")}
        </button>
      </div>
    </div>
  );
}
