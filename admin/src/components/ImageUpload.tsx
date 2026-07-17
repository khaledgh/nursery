import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { errorMessage } from "../lib/api";
import { uploadMedia } from "../lib/media";
import type { Media } from "../types/api";

interface ImageUploadProps {
  value: Media | null;
  onChange: (media: Media | null) => void;
  label?: string;
}

/** Thumbnail + file picker that uploads immediately and hands back the Media row. */
export function ImageUpload({ value, onChange, label }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      onChange(await uploadMedia(file));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {label && <span className="label">{label}</span>}
      <div className="flex items-center gap-3">
        {value ? (
          <div className="relative">
            <img src={value.url} alt="" className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute -right-2 -top-2 rounded-full bg-slate-700 p-0.5 text-white hover:bg-slate-900"
              aria-label="Remove image"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:border-brand-400 hover:text-brand-500"
          >
            <ImagePlus size={20} />
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void pick(e.target.files?.[0])}
        />
        {busy && <span className="text-xs text-slate-500">Uploading…</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}
