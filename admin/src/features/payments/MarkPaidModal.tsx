import { useMutation } from "@tanstack/react-query";
import { Button } from "@heroui/react";
import { useEffect, useState } from "react";
import { Modal } from "../../components/Modal";
import { useCurrency } from "../../hooks/useCurrency";
import { api, errorMessage } from "../../lib/api";
import type { Invoice } from "../../types/api";

const METHODS = [
  { key: "cash", label: "Cash" },
  { key: "bank_transfer", label: "Bank transfer" },
  { key: "card", label: "Card (terminal)" },
  { key: "cheque", label: "Cheque" },
  { key: "other", label: "Other" },
];

const today = () => new Date().toISOString().slice(0, 10);

/** Records a payment received by the nursery office and settles the invoice. */
export function MarkPaidModal({
  invoice,
  onClose,
  onPaid,
}: {
  invoice: Invoice | null;
  onClose: () => void;
  onPaid: () => void;
}) {
  const { formatMoney } = useCurrency();
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [paidAt, setPaidAt] = useState(today());
  const [error, setError] = useState("");

  useEffect(() => {
    if (invoice) {
      setMethod("cash");
      setReference("");
      setNote("");
      setPaidAt(today());
      setError("");
    }
  }, [invoice]);

  const markPaid = useMutation({
    mutationFn: async () =>
      api.post(`/admin/invoices/${invoice!.id}/mark-paid`, {
        method,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
        paid_at: paidAt,
      }),
    onSuccess: () => {
      onPaid();
      onClose();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <Modal open={!!invoice} title="Mark invoice as paid" onClose={onClose}>
      {invoice && (
        <div className="space-y-4 text-sm">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
            <div className="font-mono text-xs text-slate-500">{invoice.invoice_no}</div>
            <div className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
              {formatMoney(invoice.total_minor, invoice.currency)}
            </div>
          </div>
          <div>
            <label className="label">Payment method</label>
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHODS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date received</label>
              <input type="date" className="input" value={paidAt} max={today()} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
            <div>
              <label className="label">Reference (optional)</label>
              <input className="input" value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} placeholder="Receipt / transfer no." />
            </div>
          </div>
          <div>
            <label className="label">Note (optional)</label>
            <textarea className="input" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <p className="text-xs text-slate-400">The parent is notified that the invoice is paid.</p>
          {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="flat" onPress={onClose}>
              Cancel
            </Button>
            <Button color="success" className="text-white font-bold" isLoading={markPaid.isPending} onPress={() => markPaid.mutate()}>
              Mark as paid
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
