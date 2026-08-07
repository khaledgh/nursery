import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, Mail, Phone, ShieldCheck } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { EmptyState, Tabs } from "../../components/Tabs";
import { api } from "../../lib/api";
import { PRESENCE_TINT, tint } from "../../lib/tints";
import type { Child, ItemResponse } from "../../types/api";
import { HealthPanel } from "./HealthPanel";
import { ChildHubTabs } from "./QuickHubModal";

const TABS = [
  { to: "", label: "Profile" },
  { to: "care", label: "Care" },
  { to: "report", label: "Daily report" },
  { to: "milestones", label: "Milestones" },
  { to: "health", label: "Health" },
];

function age(dob: string): string {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return "—";
  const months =
    (new Date().getFullYear() - d.getFullYear()) * 12 + (new Date().getMonth() - d.getMonth());
  return months < 24 ? `${months} months` : `${Math.floor(months / 12)} years`;
}

/**
 * A child's whole record on one addressable page.
 *
 * This information used to be split across three separate modals on a table
 * row — care/report/milestones in a 985-line hub, health in another, guardians
 * in a third — none of which had a URL, so nothing could be linked, bookmarked,
 * or reached with the back button.
 */
export function ChildDetailPage() {
  const { id } = useParams<{ id: string }>();
  // The tab lives in the query string so every tab is a real, shareable URL
  // without needing five nested route entries.
  const [params] = useSearchParams();
  const tab = params.get("tab") ?? "";

  const { data: child, isLoading } = useQuery({
    queryKey: ["child", id],
    queryFn: async () => (await api.get<ItemResponse<Child>>(`/children/${id}`)).data.data,
    enabled: Boolean(id),
  });

  if (isLoading) return <p className="text-sm font-semibold text-slate-500">Loading…</p>;
  if (!child) return <p className="text-sm font-semibold text-rose-600">Child not found.</p>;

  const childId = Number(id);

  return (
    <>
      <PageHeader
        title={`${child.first_name} ${child.last_name}`}
        subtitle={child.classroom?.name ?? "No classroom"}
        breadcrumbs={[{ label: "People", to: "/children" }, { label: "Child" }]}
        backTo="/children"
        actions={
          <span className={`badge ${tint(PRESENCE_TINT, child.present_status)}`}>
            {child.present_status.replace("_", " ")}
          </span>
        }
      />

      <Tabs
        base={`/children/${id}`}
        tabs={TABS.map((t) => ({ ...t, to: t.to }))}
        query
        active={tab}
      />

      {tab === "" && <ProfileTab child={child} />}
      {tab === "health" && <HealthPanel childId={childId} />}
      {(tab === "care" || tab === "report" || tab === "milestones") && (
        <ChildHubTabs child={child} tab={tab} />
      )}
    </>
  );
}

function ProfileTab({ child }: { child: Child }) {
  const guardians = child.guardians ?? [];
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="card p-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-slate-700">
          <ShieldCheck size={16} className="text-brand-600" />
          Guardians ({guardians.length})
        </h2>
        {guardians.length === 0 ? (
          <EmptyState
            title="No guardians linked"
            hint="Link a parent from the children list, or enrol a sibling from the family page."
          />
        ) : (
          <ul className="space-y-3">
            {guardians.map((g) => (
              <li key={g.id}>
                <Link
                  to={`/parents/${g.parent_user_id}`}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">
                      {g.parent?.name ?? `Parent #${g.parent_user_id}`}
                    </p>
                    <p className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
                      {g.parent?.email && (
                        <span className="flex items-center gap-1">
                          <Mail size={11} /> {g.parent.email}
                        </span>
                      )}
                      {g.parent?.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={11} /> {g.parent.phone}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {g.is_primary && <span className="badge bg-brand-100 text-brand-700">primary</span>}
                    {g.can_pickup && <span className="badge bg-sky-100 text-sky-700">pickup</span>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="card space-y-4 p-5">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Details</h3>
        <Detail label="Date of birth" value={`${child.dob} · ${age(child.dob)}`} />
        <Detail label="Gender" value={child.gender || "—"} />
        <Detail label="Blood type" value={child.blood_type || "—"} />
        <Detail label="Classroom" value={child.classroom?.name ?? "Unassigned"} />
        {child.checked_in_at && (
          <p className="flex items-center gap-2 border-t border-slate-100 pt-3 text-xs font-semibold text-slate-500">
            <CalendarCheck size={13} className="text-emerald-500" />
            Checked in {new Date(child.checked_in_at).toLocaleString()}
          </p>
        )}
      </aside>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}
