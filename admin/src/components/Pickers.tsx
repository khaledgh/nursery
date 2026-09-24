import { Autocomplete, AutocompleteItem } from "@heroui/react";
import { useState } from "react";
import { useClassrooms, useChildren, useParents } from "../hooks/usePickers";

interface PickerProps {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
  isDisabled?: boolean;
}

export function ClassroomPicker({
  value,
  onChange,
  placeholder = "Search & select classroom...",
  size = "sm",
  className,
  label,
  isDisabled,
}: PickerProps) {
  const [search, setSearch] = useState("");
  const rooms = useClassrooms(search);
  const items = rooms.data ?? [];

  return (
    <Autocomplete
      size={size}
      variant="bordered"
      radius="lg"
      label={label}
      placeholder={placeholder}
      selectedKey={value ? String(value) : null}
      onSelectionChange={(key) => onChange(key ? String(key) : "")}
      onInputChange={(val) => setSearch(val)}
      isLoading={rooms.isLoading}
      isDisabled={isDisabled}
      aria-label={placeholder}
      className={className ?? "min-w-48"}
      inputProps={{
        classNames: {
          inputWrapper: "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-sm rounded-xl",
        },
      }}
      popoverProps={{
        classNames: {
          content: "bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xl rounded-2xl p-1",
        },
      }}
    >
      {items.map((r) => (
        <AutocompleteItem key={String(r.id)} textValue={r.name}>
          <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">{r.name}</span>
        </AutocompleteItem>
      ))}
    </Autocomplete>
  );
}

export function ChildPicker({
  value,
  onChange,
  placeholder = "Search & select child...",
  size = "sm",
  className,
  label,
  isDisabled,
}: PickerProps) {
  const [search, setSearch] = useState("");
  const kids = useChildren(search);
  const items = kids.data ?? [];

  return (
    <Autocomplete
      size={size}
      variant="bordered"
      radius="lg"
      label={label}
      placeholder={placeholder}
      selectedKey={value ? String(value) : null}
      onSelectionChange={(key) => onChange(key ? String(key) : "")}
      onInputChange={(val) => setSearch(val)}
      isLoading={kids.isLoading}
      isDisabled={isDisabled}
      aria-label={placeholder}
      className={className ?? "min-w-56"}
      inputProps={{
        classNames: {
          inputWrapper: "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-sm rounded-xl",
        },
      }}
      popoverProps={{
        classNames: {
          content: "bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xl rounded-2xl p-1",
        },
      }}
    >
      {items.map((c) => (
        <AutocompleteItem key={String(c.id)} textValue={`${c.first_name} ${c.last_name}`}>
          <div className="flex flex-col py-0.5">
            <span className="font-bold text-xs text-slate-800 dark:text-slate-100">
              {c.first_name} {c.last_name}
            </span>
            {c.classroom && (
              <span className="text-[10px] text-slate-400 mt-0.5">
                Classroom: {c.classroom.name}
              </span>
            )}
          </div>
        </AutocompleteItem>
      ))}
    </Autocomplete>
  );
}

export function ParentPicker({
  value,
  onChange,
  placeholder = "Search & select guardian...",
  size = "sm",
  className,
  label,
  isDisabled,
}: PickerProps) {
  const [search, setSearch] = useState("");
  const parents = useParents(search);
  const items = parents.data ?? [];

  return (
    <Autocomplete
      size={size}
      variant="bordered"
      radius="lg"
      label={label}
      placeholder={placeholder}
      selectedKey={value ? String(value) : null}
      onSelectionChange={(key) => onChange(key ? String(key) : "")}
      onInputChange={(val) => setSearch(val)}
      isLoading={parents.isLoading}
      isDisabled={isDisabled}
      aria-label={placeholder}
      className={className ?? "min-w-56"}
      inputProps={{
        classNames: {
          inputWrapper: "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-sm rounded-xl",
        },
      }}
      popoverProps={{
        classNames: {
          content: "bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xl rounded-2xl p-1",
        },
      }}
    >
      {items.map((p) => (
        <AutocompleteItem key={String(p.id)} textValue={`${p.name} (${p.email})`}>
          <div className="flex flex-col py-0.5">
            <span className="font-bold text-xs text-slate-800 dark:text-slate-100">{p.name}</span>
            <span className="text-[10px] text-slate-400">{p.email}</span>
          </div>
        </AutocompleteItem>
      ))}
    </Autocomplete>
  );
}

