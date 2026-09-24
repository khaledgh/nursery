import type { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  error?: string;
  children: ReactNode;
  required?: boolean;
  hint?: string;
  className?: string;
}

export function FormField({ label, error, children, required, hint, className }: FormFieldProps) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <div className="flex items-center justify-between">
        <label className="label mb-0 flex items-center gap-1">
          <span>{label}</span>
          {required && <span className="text-rose-500 text-xs font-bold" title="Required">*</span>}
        </label>
        {hint && <span className="text-[11px] text-slate-400 font-medium">{hint}</span>}
      </div>
      {children}
      {error && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 mt-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
