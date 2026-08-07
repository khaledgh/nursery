import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Copy, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { FormField } from "../../components/FormField";
import { PageHeader } from "../../components/PageHeader";
import { SeatMeter } from "../../components/SeatMeter";
import { api } from "../../lib/api";
import { applyServerErrors } from "../../lib/formErrors";
import type { Classroom, FamilyResponse, ListResponse, User } from "../../types/api";

const schema = z.object({
  parent_user_id: z.string().optional(),
  parent_name: z.string().optional(),
  parent_email: z.string().optional(),
  parent_phone: z.string().optional(),
  first_name: z.string().min(1, "required"),
  last_name: z.string().min(1, "required"),
  dob: z.string().length(10, "use YYYY-MM-DD"),
  gender: z.string().optional(),
  blood_type: z.string().optional(),
  classroom_id: z.string().optional(),
  relationship: z.string().optional(),
  is_primary: z.boolean(),
  can_pickup: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

/**
 * Enrol a family in one submit.
 *
 * This replaces a sequence that took roughly twenty clicks across three modals
 * on two pages, and which silently required the parent to be created first.
 */
export function NewFamilyPage() {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [banner, setBanner] = useState("");
  const [done, setDone] = useState<FamilyResponse | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { is_primary: true, can_pickup: true, relationship: "parent" },
  });

  const classrooms = useQuery({
    queryKey: ["classrooms", "picker"],
    queryFn: async () =>
      (await api.get<ListResponse<Classroom>>("/classrooms?per_page=100")).data.data,
  });
  const parents = useQuery({
    queryKey: ["parents", "picker"],
    queryFn: async () =>
      (await api.get<ListResponse<User>>("/admin/users?role=parent&per_page=100")).data.data,
    enabled: mode === "existing",
  });

  const create = useMutation({
    mutationFn: async (v: FormValues) => {
      const body: Record<string, unknown> = {
        child: {
          first_name: v.first_name,
          last_name: v.last_name,
          dob: v.dob,
          gender: v.gender || "",
          blood_type: v.blood_type || "",
          classroom_id: v.classroom_id ? Number(v.classroom_id) : null,
        },
        link: {
          relationship: v.relationship || "parent",
          is_primary: v.is_primary,
          can_pickup: v.can_pickup,
        },
      };
      if (mode === "existing") {
        body.parent_user_id = Number(v.parent_user_id);
      } else {
        body.parent = { name: v.parent_name, email: v.parent_email, phone: v.parent_phone || "" };
      }
      return (await api.post<{ data: FamilyResponse }>("/admin/families", body)).data.data;
    },
    onSuccess: (res) => setDone(res),
    onError: (err) =>
      setBanner(
        applyServerErrors(form, err, {
          // The API namespaces nested fields; map them back onto flat inputs.
          map: {
            "parent.email": "parent_email",
            "child.first_name": "first_name",
            "child.dob": "dob",
          },
        }),
      ),
  });

  if (done) return <FamilyCreated result={done} onAddAnother={() => { setDone(null); form.reset(); }} />;

  const err = form.formState.errors;

  return (
    <>
      <PageHeader
        title="Enrol a family"
        subtitle="Creates the parent, the child, and the link between them in one step."
        breadcrumbs={[{ label: "People", to: "/children" }, { label: "New family" }]}
        backTo="/children"
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <form
          onSubmit={form.handleSubmit((v) => create.mutate(v))}
          className="card space-y-6 p-6"
        >
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-brand-600" />
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-700">Parent</h2>
            </div>

            <div className="flex gap-2">
              {(["new", "existing"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
                    mode === m ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {m === "new" ? "New parent" : "Existing parent (sibling)"}
                </button>
              ))}
            </div>

            {mode === "new" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Full name" error={err.parent_name?.message}>
                  <input className="input" {...form.register("parent_name")} />
                </FormField>
                <FormField label="Email" error={err.parent_email?.message}>
                  <input className="input" type="email" {...form.register("parent_email")} />
                </FormField>
                <FormField label="Phone" error={err.parent_phone?.message}>
                  <input className="input" {...form.register("parent_phone")} />
                </FormField>
              </div>
            ) : (
              <FormField label="Choose a parent" error={err.parent_user_id?.message}>
                <select className="input" {...form.register("parent_user_id")}>
                  <option value="">Select…</option>
                  {parents.data?.map((p: User) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.email}
                    </option>
                  ))}
                </select>
              </FormField>
            )}
          </section>

          <section className="space-y-4 border-t border-slate-100 pt-6">
            <div className="flex items-center gap-2">
              <UserPlus size={16} className="text-brand-600" />
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-700">Child</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="First name" error={err.first_name?.message}>
                <input className="input" {...form.register("first_name")} />
              </FormField>
              <FormField label="Last name" error={err.last_name?.message}>
                <input className="input" {...form.register("last_name")} />
              </FormField>
              <FormField label="Date of birth" error={err.dob?.message}>
                <input className="input" type="date" {...form.register("dob")} />
              </FormField>
              <FormField label="Classroom" error={err.classroom_id?.message}>
                <select className="input" {...form.register("classroom_id")}>
                  <option value="">Unassigned</option>
                  {classrooms.data?.map((r: Classroom) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Gender" error={err.gender?.message}>
                <input className="input" {...form.register("gender")} />
              </FormField>
              <FormField label="Blood type" error={err.blood_type?.message}>
                <input className="input" {...form.register("blood_type")} />
              </FormField>
            </div>
          </section>

          <section className="space-y-4 border-t border-slate-100 pt-6">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-700">Relationship</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Relationship" error={err.relationship?.message}>
                <input className="input" placeholder="parent / guardian" {...form.register("relationship")} />
              </FormField>
              <div className="flex items-end gap-6 pb-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                  <input type="checkbox" {...form.register("is_primary")} /> Primary contact
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                  <input type="checkbox" {...form.register("can_pickup")} /> Can collect
                </label>
              </div>
            </div>
          </section>

          {banner && <p className="text-sm font-semibold text-rose-600">{banner}</p>}

          <div className="flex items-center gap-3 border-t border-slate-100 pt-6">
            <button type="submit" className="btn btn-primary" disabled={create.isPending}>
              {create.isPending ? "Enrolling…" : "Enrol family"}
            </button>
            <Link to="/children" className="btn btn-secondary">Cancel</Link>
          </div>
        </form>

        <aside className="space-y-4">
          <SeatMeter />
          <div className="card p-5 text-xs font-semibold leading-relaxed text-slate-500">
            Enrolling a child takes one student place. If the plan is full, remove a
            student first or ask your provider to raise the limit.
          </div>
        </aside>
      </div>
    </>
  );
}

/**
 * Success step. The parent's login id only exists after the row is written, so
 * this is the admin's one chance to hand it over — hence copy and print.
 */
function FamilyCreated({ result, onAddAnother }: { result: FamilyResponse; onAddAnother: () => void }) {
  const [copied, setCopied] = useState(false);
  const loginId = result.parent.login_id ?? "";

  const copy = async () => {
    await navigator.clipboard.writeText(loginId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <PageHeader title="Family enrolled" subtitle={`${result.child.first_name} ${result.child.last_name} is now on the roster.`} />
      <div className="card max-w-xl space-y-5 p-6">
        <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3">
          <Check size={18} className="text-emerald-600" />
          <p className="text-sm font-bold text-emerald-800">Parent and child created and linked.</p>
        </div>

        {loginId && (
          <div>
            <p className="label">Parent login ID</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-xl bg-slate-50 px-4 py-3 font-mono text-lg font-bold tracking-wide text-slate-800">
                {loginId}
              </code>
              <button onClick={() => void copy()} className="btn btn-secondary" type="button">
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              {result.parent.name} signs in to the app with this ID. Give it to them
              before leaving this page — it is also shown on their profile.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-5">
          <Link to={`/parents/${result.parent.id}`} className="btn btn-primary">
            Open family profile
          </Link>
          <button onClick={onAddAnother} className="btn btn-secondary" type="button">
            Enrol another
          </button>
          <button onClick={() => window.print()} className="btn btn-secondary" type="button">
            Print slip
          </button>
        </div>
      </div>
    </>
  );
}
