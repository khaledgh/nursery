import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Paperclip, Plus, Trash2 } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import { uploadMedia } from "../../lib/media";
import type { ItemResponse, Media } from "../../types/api";

type FieldType = "text" | "date" | "number" | "select" | "checkbox" | "textarea";

interface Field {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
}

interface Section {
  segment: string;
  label: string;
  fields: Field[];
  withFile?: boolean; // medical documents attach a media file
}

const SECTIONS: Section[] = [
  {
    segment: "allergies",
    label: "Allergies",
    fields: [
      { key: "name", label: "Allergen", type: "text" },
      { key: "severity", label: "Severity", type: "select", options: ["mild", "moderate", "severe"] },
    ],
  },
  {
    segment: "illnesses",
    label: "Illness log",
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "status", label: "Status", type: "select", options: ["active", "recovered", "resolved"] },
      { key: "temperature", label: "Temp °C", type: "number" },
      { key: "date", label: "Date", type: "date" },
      { key: "note", label: "Note", type: "text" },
    ],
  },
  {
    segment: "medications",
    label: "Medications",
    fields: [
      { key: "name", label: "Name", type: "text" },
      { key: "dosage", label: "Dosage", type: "text" },
      { key: "schedule", label: "Schedule", type: "text" },
      { key: "start_date", label: "Start", type: "date" },
      { key: "end_date", label: "End", type: "date" },
      { key: "active", label: "Active", type: "checkbox" },
    ],
  },
  {
    segment: "immunizations",
    label: "Immunizations",
    fields: [
      { key: "vaccine", label: "Vaccine", type: "text" },
      { key: "given_date", label: "Given", type: "date" },
      { key: "next_due_date", label: "Next due", type: "date" },
      { key: "status", label: "Status", type: "text" },
    ],
  },
  {
    segment: "checkups",
    label: "Checkups",
    fields: [
      { key: "type", label: "Type", type: "text" },
      { key: "date", label: "Date", type: "date" },
      { key: "outcome", label: "Outcome", type: "text" },
      { key: "doctor", label: "Doctor", type: "text" },
    ],
  },
  {
    segment: "growth",
    label: "Growth",
    fields: [
      { key: "date", label: "Date", type: "date" },
      { key: "height_cm", label: "Height cm", type: "number" },
      { key: "weight_kg", label: "Weight kg", type: "number" },
      { key: "head_circ_cm", label: "Head cm", type: "number" },
    ],
  },
  {
    segment: "vitals",
    label: "Daily vitals",
    fields: [
      { key: "date", label: "Date", type: "date" },
      { key: "temperature", label: "Temp °C", type: "number" },
      { key: "mood", label: "Mood", type: "text" },
      { key: "energy", label: "Energy", type: "text" },
      { key: "appetite", label: "Appetite", type: "text" },
      { key: "sleep_summary", label: "Sleep", type: "text" },
    ],
  },
  {
    segment: "emergency-contacts",
    label: "Emergency contacts",
    fields: [
      { key: "name", label: "Name", type: "text" },
      { key: "relation", label: "Relation", type: "text" },
      { key: "phone", label: "Phone", type: "text" },
      { key: "priority", label: "Priority", type: "number" },
    ],
  },
  {
    segment: "insurance",
    label: "Insurance",
    fields: [
      { key: "provider", label: "Provider", type: "text" },
      { key: "policy_no", label: "Policy #", type: "text" },
      { key: "status", label: "Status", type: "text" },
      { key: "valid_until", label: "Valid until", type: "date" },
    ],
  },
  {
    segment: "documents",
    label: "Documents",
    withFile: true,
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "kind", label: "Kind", type: "text" },
    ],
  },
  {
    segment: "notes",
    label: "Notes",
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "body", label: "Body", type: "textarea" },
    ],
  },
];

type Row = Record<string, unknown> & { id: number; media?: Media | null };

/** Generic editor over the 11 /children/:id/health/<segment> CRUD resources. */
export function HealthPanel({ childId }: { childId: number }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [section, setSection] = useState(SECTIONS[0]);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  const base = `/children/${childId}/health/${section.segment}`;
  const rows = useQuery({
    queryKey: ["health", childId, section.segment],
    queryFn: async () => (await api.get<ItemResponse<Row[]>>(base)).data.data ?? [],
  });

  const create = useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const payload = { ...input };
      for (const f of section.fields) {
        if (f.type === "number" && payload[f.key] !== undefined && payload[f.key] !== "") {
          payload[f.key] = Number(payload[f.key]);
        }
      }
      if (section.withFile) {
        if (!file) throw new Error("Pick a file first");
        const media = await uploadMedia(file);
        payload.media_id = media.id;
      }
      return api.post(base, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["health", childId, section.segment] });
      setDraft({});
      setFile(null);
      setError("");
    },
    onError: (err) => setError(err instanceof Error && !("response" in err) ? err.message : errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`${base}/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["health", childId, section.segment] }),
    onError: (err) => setError(errorMessage(err)),
  });

  const switchSection = (s: Section) => {
    setSection(s);
    setDraft({});
    setFile(null);
    setError("");
  };

  const renderValue = (row: Row, f: Field) => {
    const v = row[f.key];
    if (f.type === "checkbox") return v ? "yes" : "no";
    if (v === null || v === undefined || v === "") return "—";
    return String(v);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {SECTIONS.map((s) => (
          <button
            key={s.segment}
            type="button"
            onClick={() => switchSection(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              s.segment === section.segment ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
            {section.fields.map((f) => (
              <th key={f.key} className="py-2 pe-2">
                {f.label}
              </th>
            ))}
            {section.withFile && <th className="py-2">File</th>}
            <th className="w-10 py-2" />
          </tr>
        </thead>
        <tbody>
          {(rows.data ?? []).map((row) => (
            <tr key={row.id} className="border-b border-slate-100 last:border-0">
              {section.fields.map((f) => (
                <td key={f.key} className="py-2 pe-2">
                  {renderValue(row, f)}
                </td>
              ))}
              {section.withFile && (
                <td className="py-2">
                  {row.media ? (
                    <a className="text-brand-600 underline" href={row.media.url} target="_blank" rel="noreferrer">
                      open
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              )}
              <td className="py-2 text-right">
                <button
                  className="text-slate-400 hover:text-red-600"
                  onClick={() => remove.mutate(row.id)}
                  aria-label="Delete"
                >
                  <Trash2 size={15} />
                </button>
              </td>
            </tr>
          ))}
          {!rows.data?.length && (
            <tr>
              <td colSpan={section.fields.length + 2} className="py-4 text-center text-slate-400">
                {rows.isLoading ? t("common.loading") : t("common.noData")}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="rounded-xl bg-slate-50 p-4">
        <div className="mb-2 text-xs font-semibold uppercase text-slate-500">Add new</div>
        <div className="flex flex-wrap items-end gap-2">
          {section.fields.map((f) => (
            <div key={f.key} className={f.type === "textarea" ? "w-full" : "min-w-32 flex-1"}>
              <label className="label !mb-0.5 !text-xs">{f.label}</label>
              {f.type === "select" ? (
                <select
                  className="input"
                  value={(draft[f.key] as string) ?? f.options![0]}
                  onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                >
                  {f.options!.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : f.type === "checkbox" ? (
                <input
                  type="checkbox"
                  className="mt-2 block"
                  checked={Boolean(draft[f.key] ?? true)}
                  onChange={(e) => setDraft({ ...draft, [f.key]: e.target.checked })}
                />
              ) : f.type === "textarea" ? (
                <textarea
                  className="input"
                  rows={2}
                  value={(draft[f.key] as string) ?? ""}
                  onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                />
              ) : (
                <input
                  className="input"
                  type={f.type}
                  step={f.type === "number" ? "0.1" : undefined}
                  value={(draft[f.key] as string) ?? ""}
                  onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                />
              )}
            </div>
          ))}
          {section.withFile && (
            <div>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
                <Paperclip size={14} /> {file ? file.name : "Attach"}
              </button>
            </div>
          )}
          <button
            className="btn-primary"
            disabled={create.isPending}
            onClick={() => {
              // Selects default to their first option even before the user touches them.
              const withDefaults = { ...draft };
              for (const f of section.fields) {
                if (f.type === "select" && withDefaults[f.key] === undefined) withDefaults[f.key] = f.options![0];
                if (f.type === "checkbox" && withDefaults[f.key] === undefined) withDefaults[f.key] = true;
              }
              create.mutate(withDefaults);
            }}
          >
            <Plus size={14} /> {t("common.create")}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
