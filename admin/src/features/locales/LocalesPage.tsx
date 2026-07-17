import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "../../components/Modal";
import { api, errorMessage } from "../../lib/api";
import type { ItemResponse, Locale, UITranslation } from "../../types/api";

/** Languages + Layer A (live UI strings) management. */
export function LocalesPage() {
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const [addingLocale, setAddingLocale] = useState(false);
  const [draft, setDraft] = useState({ code: "", name: "", native_name: "", direction: "ltr", is_active: true, is_default: false });

  const [uiLocale, setUiLocale] = useState("en");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const locales = useQuery({
    queryKey: ["locales-admin"],
    queryFn: async () => {
      const res = await api.get<ItemResponse<Locale[]>>("/locales");
      return res.data.data;
    },
  });

  const uiStrings = useQuery({
    queryKey: ["ui-translations", uiLocale],
    queryFn: async () => {
      const res = await api.get<ItemResponse<UITranslation[]>>("/admin/translations/ui", { params: { locale: uiLocale } });
      return res.data.data;
    },
  });

  const saveLocale = useMutation({
    mutationFn: async (loc: typeof draft) => api.put("/admin/locales", { ...loc, sort_order: 0 }),
    onSuccess: () => {
      setAddingLocale(false);
      setDraft({ code: "", name: "", native_name: "", direction: "ltr", is_active: true, is_default: false });
      void locales.refetch();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const toggleLocale = useMutation({
    mutationFn: async (loc: Locale) => api.put("/admin/locales", { ...loc, is_active: !loc.is_active }),
    onSuccess: () => void locales.refetch(),
    onError: (err) => setError(errorMessage(err)),
  });

  const deleteLocale = useMutation({
    mutationFn: async (code: string) => api.delete(`/admin/locales/${code}`),
    onSuccess: () => void locales.refetch(),
    onError: (err) => setError(errorMessage(err)),
  });

  const upsertUI = useMutation({
    mutationFn: async () => api.put("/admin/translations/ui", { locale: uiLocale, key: newKey, value: newValue }),
    onSuccess: () => {
      setNewKey("");
      setNewValue("");
      void uiStrings.refetch();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const deleteUI = useMutation({
    mutationFn: async (id: number) => api.delete(`/admin/translations/ui/${id}`),
    onSuccess: () => void uiStrings.refetch(),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("nav.locales")}</h1>
        <button className="btn-primary" onClick={() => setAddingLocale(true)}>
          <Plus size={16} /> {t("common.create")}
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {["Code", t("common.name"), "Native", "Direction", t("common.status"), "Default", t("common.actions")].map((h) => (
                <th key={h} className="px-4 py-3 text-start font-medium text-slate-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(locales.data ?? []).map((l) => (
              <tr key={l.code} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-mono">{l.code}</td>
                <td className="px-4 py-3">{l.name}</td>
                <td className="px-4 py-3" dir={l.direction}>
                  {l.native_name}
                </td>
                <td className="px-4 py-3 uppercase">{l.direction}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleLocale.mutate(l)}
                    className={`badge ${l.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                  >
                    {l.is_active ? t("common.active") : t("common.inactive")}
                  </button>
                </td>
                <td className="px-4 py-3">{l.is_default ? "★" : ""}</td>
                <td className="px-4 py-3">
                  {!l.is_default && (
                    <button className="text-slate-400 hover:text-red-600" onClick={() => deleteLocale.mutate(l.code)} aria-label="Delete">
                      <Trash2 size={15} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-3">
          <span className="font-medium">Live UI strings</span>
          <select className="input !w-28" value={uiLocale} onChange={(e) => setUiLocale(e.target.value)}>
            {(locales.data ?? []).map((l) => (
              <option key={l.code} value={l.code}>
                {l.code}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-400">Served at GET /i18n/{uiLocale} — no app release needed</span>
        </div>
        <div className="space-y-2 p-5">
          {(uiStrings.data ?? []).map((row) => (
            <div key={row.id} className="flex items-center gap-3 text-sm">
              <span className="w-64 truncate font-mono text-xs text-slate-500">
                {row.namespace}.{row.key}
              </span>
              <span className="flex-1">{row.value}</span>
              <button className="text-slate-400 hover:text-red-600" onClick={() => deleteUI.mutate(row.id)} aria-label="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <input className="input w-64" placeholder="key (e.g. home.welcome)" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
            <input className="input flex-1" placeholder="value" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
            <button className="btn-primary" disabled={!newKey || !newValue || upsertUI.isPending} onClick={() => upsertUI.mutate()}>
              {t("common.save")}
            </button>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Modal open={addingLocale} title={t("common.create")} onClose={() => setAddingLocale(false)}>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Code</label>
              <input className="input" placeholder="fr" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
            </div>
            <div>
              <label className="label">{t("common.name")}</label>
              <input className="input" placeholder="French" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Native</label>
              <input
                className="input"
                placeholder="Français"
                value={draft.native_name}
                onChange={(e) => setDraft({ ...draft, native_name: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.direction === "rtl"}
                onChange={(e) => setDraft({ ...draft, direction: e.target.checked ? "rtl" : "ltr" })}
              />
              RTL
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} />
              {t("common.active")}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={draft.is_default} onChange={(e) => setDraft({ ...draft, is_default: e.target.checked })} />
              Default
            </label>
          </div>
          <div className="flex justify-end gap-3">
            <button className="btn-secondary" onClick={() => setAddingLocale(false)}>
              {t("common.cancel")}
            </button>
            <button
              className="btn-primary"
              disabled={!draft.code || !draft.name || !draft.native_name || saveLocale.isPending}
              onClick={() => saveLocale.mutate(draft)}
            >
              {t("common.save")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
