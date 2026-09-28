import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Select, SelectItem, Textarea } from "@heroui/react";
import { Mail, MessageCircle, Phone, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { DataTable, type Column } from "../../components/DataTable";
import { Modal } from "../../components/Modal";
import { PageHeader } from "../../components/PageHeader";
import { usePagedList } from "../../hooks/usePagedList";
import { api, errorMessage } from "../../lib/api";
import { DEMO_REQUEST_STATUS_TINT } from "../../lib/tints";
import type { DemoRequest, DemoRequestStatus } from "../../types/api";

const STATUSES: DemoRequestStatus[] = ["new", "contacted", "scheduled", "converted", "rejected"];

const selectClassNames = {
  trigger: "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-sm rounded-xl",
  popoverContent: "bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xl rounded-2xl p-1",
};

function whatsappUrl(phone: string) {
  return `https://wa.me/${phone.replace(/[^\d]/g, "")}`;
}

export function DemoRequestsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const list = usePagedList<DemoRequest>("superadmin-demo-requests", "/superadmin/demo-requests", {
    status: statusFilter || undefined,
  });

  const [selected, setSelected] = useState<DemoRequest | null>(null);
  const [draftStatus, setDraftStatus] = useState<DemoRequestStatus>("new");
  const [draftNotes, setDraftNotes] = useState("");
  const [toDelete, setToDelete] = useState<DemoRequest | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (selected) {
      setDraftStatus(selected.status);
      setDraftNotes(selected.admin_notes ?? "");
      setError("");
    }
  }, [selected]);

  const refresh = () => {
    void list.refetch();
    void qc.invalidateQueries({ queryKey: ["platform-stats"] });
  };

  const update = useMutation({
    mutationFn: async (vars: { id: number; status: DemoRequestStatus; admin_notes: string }) =>
      api.put(`/superadmin/demo-requests/${vars.id}`, { status: vars.status, admin_notes: vars.admin_notes }),
    onSuccess: () => {
      setSelected(null);
      refresh();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`/superadmin/demo-requests/${id}`),
    onSuccess: () => {
      setToDelete(null);
      setSelected(null);
      refresh();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const statusBadge = (s: DemoRequestStatus) => (
    <span className={`badge ${DEMO_REQUEST_STATUS_TINT[s]}`}>{t(`demo_requests.status.${s}`)}</span>
  );

  const columns: Column<DemoRequest>[] = [
    {
      header: t("demo_requests.received"),
      render: (r) => (
        <span className="whitespace-nowrap text-xs text-slate-500">{new Date(r.created_at).toLocaleString()}</span>
      ),
    },
    {
      header: t("demo_requests.nursery"),
      render: (r) => (
        <button type="button" className="text-start" onClick={() => setSelected(r)}>
          <div className="font-semibold text-slate-900 dark:text-slate-100 hover:text-[#2CAFA8]">{r.nursery_name}</div>
          <div className="text-xs text-slate-500">{r.full_name}</div>
        </button>
      ),
    },
    {
      header: t("demo_requests.contact"),
      render: (r) => (
        <div className="text-xs">
          <a href={`mailto:${r.email}`} className="block text-[#2CAFA8] hover:underline">
            {r.email}
          </a>
          <a href={`tel:${r.phone}`} className="block text-slate-600 dark:text-slate-400 hover:underline" dir="ltr">
            {r.phone}
          </a>
        </div>
      ),
    },
    {
      header: t("demo_requests.children"),
      render: (r) => (r.children_range ? t(`demo_requests.range.${r.children_range}`) : "—"),
    },
    {
      header: t("demo_requests.location"),
      render: (r) => [r.city, r.country].filter(Boolean).join(", ") || "—",
    },
    { header: t("demo_requests.language"), render: (r) => <span className="uppercase text-xs">{r.locale}</span> },
    { header: t("common.status"), render: (r) => statusBadge(r.status) },
    {
      header: t("common.actions"),
      render: (r) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="flat" onPress={() => setSelected(r)}>
            {t("common.edit")}
          </Button>
          <Button size="sm" variant="light" color="danger" isIconOnly aria-label={t("common.delete")} onPress={() => setToDelete(r)}>
            <Trash2 size={15} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title={t("demo_requests.title")} subtitle={t("demo_requests.subtitle")} />

      <DataTable
        columns={columns}
        rows={list.rows}
        meta={list.meta}
        loading={list.loading}
        search={list.search}
        onSearch={list.setSearch}
        onPage={list.setPage}
        rowKey={(r) => r.id}
        toolbar={
          <Select
            size="sm"
            variant="bordered"
            radius="lg"
            placeholder={t("demo_requests.allStatuses")}
            selectedKeys={statusFilter ? [statusFilter] : []}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              list.setPage(1);
            }}
            aria-label={t("common.status")}
            className="w-44"
            classNames={selectClassNames}
          >
            {[
              <SelectItem key="" textValue={t("demo_requests.allStatuses")}>
                {t("demo_requests.allStatuses")}
              </SelectItem>,
              ...STATUSES.map((s) => (
                <SelectItem key={s} textValue={t(`demo_requests.status.${s}`)}>
                  {t(`demo_requests.status.${s}`)}
                </SelectItem>
              )),
            ]}
          </Select>
        }
      />

      <Modal open={!!selected} title={t("demo_requests.details")} onClose={() => setSelected(null)} wide>
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{selected.nursery_name}</div>
                <div className="text-slate-500">{selected.full_name}</div>
              </div>
              {statusBadge(selected.status)}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button as="a" href={`mailto:${selected.email}`} size="sm" variant="flat" startContent={<Mail size={15} />}>
                {t("demo_requests.email")}
              </Button>
              <Button as="a" href={`tel:${selected.phone}`} size="sm" variant="flat" startContent={<Phone size={15} />}>
                {t("demo_requests.call")}
              </Button>
              <Button
                as="a"
                href={whatsappUrl(selected.phone)}
                target="_blank"
                rel="noreferrer"
                size="sm"
                variant="flat"
                color="success"
                startContent={<MessageCircle size={15} />}
              >
                {t("demo_requests.whatsapp")}
              </Button>
            </div>

            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                [t("demo_requests.email"), selected.email],
                [t("demo_requests.phone"), selected.phone],
                [t("demo_requests.location"), [selected.city, selected.country].filter(Boolean).join(", ") || "—"],
                [
                  t("demo_requests.children"),
                  selected.children_range ? t(`demo_requests.range.${selected.children_range}`) : "—",
                ],
                [
                  t("demo_requests.preferredTime"),
                  selected.preferred_contact_time
                    ? t(`demo_requests.time.${selected.preferred_contact_time}`, selected.preferred_contact_time)
                    : "—",
                ],
                [t("demo_requests.received"), new Date(selected.created_at).toLocaleString()],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-semibold text-slate-500">{label}</dt>
                  <dd className="text-slate-900 dark:text-slate-100 break-words">{value}</dd>
                </div>
              ))}
            </dl>

            {selected.message && (
              <div className="pb-2">
                <div className="text-xs font-semibold text-slate-500">{t("demo_requests.message")}</div>
                <p className="mt-1 whitespace-pre-wrap rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-slate-800 dark:text-slate-200">
                  {selected.message}
                </p>
              </div>
            )}

            <Select
              label={t("common.status")}
              labelPlacement="outside"
              variant="bordered"
              selectedKeys={[draftStatus]}
              onChange={(e) => e.target.value && setDraftStatus(e.target.value as DemoRequestStatus)}
              classNames={selectClassNames}
            >
              {STATUSES.map((s) => (
                <SelectItem key={s} textValue={t(`demo_requests.status.${s}`)}>
                  {t(`demo_requests.status.${s}`)}
                </SelectItem>
              ))}
            </Select>

            <Textarea
              label={t("demo_requests.notes")}
              labelPlacement="outside"
              variant="bordered"
              placeholder={t("demo_requests.notesPlaceholder")}
              value={draftNotes}
              onValueChange={setDraftNotes}
              minRows={3}
            />

            {error && <p className="text-sm text-rose-600">{error}</p>}

            <div className="flex justify-between gap-3 pt-2">
              <Button color="danger" variant="light" startContent={<Trash2 size={15} />} onPress={() => setToDelete(selected)}>
                {t("common.delete")}
              </Button>
              <div className="flex gap-2">
                <Button variant="flat" onPress={() => setSelected(null)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  className="bg-[#2CAFA8] text-white"
                  isLoading={update.isPending}
                  onPress={() => update.mutate({ id: selected.id, status: draftStatus, admin_notes: draftNotes })}
                >
                  {t("common.save")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title={toDelete ? `${t("common.delete")}: ${toDelete.nursery_name}` : ""}
        busy={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
