import { useTranslation } from "react-i18next";
import { Modal } from "./Modal";
import { Button } from "@heroui/react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, busy, onConfirm, onCancel }: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <p className="text-sm text-slate-600 dark:text-slate-400">{t("common.confirmDelete")}</p>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="flat" color="default" onPress={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button color="danger" onPress={onConfirm} isLoading={busy}>
          {t("common.delete")}
        </Button>
      </div>
    </Modal>
  );
}

