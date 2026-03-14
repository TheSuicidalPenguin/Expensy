import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

interface Props {
  expenseId: Id<"expenses">;
  onClose: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const STATUS_DOT: Record<string, string> = {
  draft: "bg-gray-400",
  submitted: "bg-blue-400",
  approved: "bg-green-500",
  rejected: "bg-red-400",
};

/** Visual config for each possible target status. */
const TRANSITION_CONFIG: Record<string, { label: string; btnClass: string; needsNote?: boolean }> = {
  approved: {
    label: "Approve",
    btnClass: "text-white bg-green-600 hover:bg-green-700",
  },
  rejected: {
    label: "Reject",
    btnClass: "text-white bg-red-600 hover:bg-red-700",
    needsNote: true,
  },
  submitted: {
    label: "Resubmit",
    btnClass: "text-white bg-blue-600 hover:bg-blue-700",
  },
};

export default function ExpenseDetailModal({ expenseId, onClose }: Props) {
  const expense = useQuery(api.expenses.getExpenseById, { expenseId });
  const transitions = useQuery(api.expenses.getAvailableTransitions, { expenseId });

  const approve = useMutation(api.expenses.approveExpense);
  const rejectExp = useMutation(api.expenses.rejectExpense);
  const submit = useMutation(api.expenses.submitExpense);

  const [pendingTransition, setPendingTransition] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [isActing, setIsActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleTransition(toStatusName: string) {
    const config = TRANSITION_CONFIG[toStatusName];
    if (!config) return;

    if (config.needsNote) {
      setPendingTransition(toStatusName);
      return;
    }

    setActionError(null);
    setIsActing(true);
    try {
      if (toStatusName === "approved") await approve({ expenseId });
      else if (toStatusName === "submitted") await submit({ expenseId });
      onClose();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsActing(false);
    }
  }

  async function handleConfirmWithNote() {
    if (!rejectionNote.trim()) {
      setActionError("A rejection note is required.");
      return;
    }
    setActionError(null);
    setIsActing(true);
    try {
      await rejectExp({ expenseId, note: rejectionNote.trim() });
      onClose();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsActing(false);
    }
  }

  const availableTransitions = transitions ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 px-4"
      onClick={(e) => e.target === e.currentTarget && !isActing && onClose()}
    >
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Expense Details</h2>
          <button
            onClick={onClose}
            disabled={isActing}
            className="text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none disabled:opacity-40"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto">
          {expense === undefined ? (
            <div className="space-y-3 animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-8 bg-gray-100 rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              {/* Status */}
              <div className="flex items-center gap-2 flex-wrap">
                {expense.statusName && (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[expense.statusName] ?? "bg-gray-100 text-gray-600"}`}>
                    {expense.statusName}
                  </span>
                )}
                {expense.rejectionNote && (
                  <span className="text-xs text-gray-400 italic">"{expense.rejectionNote}"</span>
                )}
              </div>

              {/* Fields */}
              <div className="space-y-3">
                <DetailRow label="Description" value={expense.description} />
                <DetailRow label="Category" value={expense.categoryName ?? "—"} />
                {expense.otherCategory && (
                  <DetailRow label="Specify category" value={expense.otherCategory} />
                )}
                <DetailRow
                  label="Amount"
                  value={expense.amount !== undefined && expense.currencyCode
                    ? `${expense.currencyCode} ${expense.amount.toFixed(2)}`
                    : "—"}
                />
                <DetailRow
                  label="Expense Date"
                  value={expense.expenseDate
                    ? new Date(expense.expenseDate).toLocaleDateString(undefined, { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })
                    : "—"}
                />
                {expense.submissionDate && (
                  <DetailRow
                    label="Submitted on"
                    value={new Date(expense.submissionDate).toLocaleDateString(undefined, { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })}
                  />
                )}
              </div>

              {/* Receipt */}
              {expense.receiptUrl && (
                <div className="flex items-center justify-between text-sm gap-4">
                  <span className="text-gray-400 font-medium shrink-0">Receipt</span>
                  <a
                    href={expense.receiptUrl}
                    download="receipt"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 transition-colors max-w-[200px]"
                  >
                    {/* File icon */}
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm text-gray-700 truncate">Receipt</span>
                    {/* Download arrow */}
                    <svg className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </a>
                </div>
              )}

              {/* Status history */}
              {expense.history && expense.history.length > 0 && (
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">History</p>
                  <ol className="relative border-l border-gray-200 space-y-3 pl-5">
                    {expense.history.map((entry) => (
                      <li key={entry._id} className="relative">
                        <span className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-white ${STATUS_DOT[entry.toStatusName ?? ""] ?? "bg-gray-300"}`} />
                        <p className="text-xs text-gray-700">
                          {entry.fromStatusName
                            ? <><span className="capitalize">{entry.fromStatusName}</span>{" → "}<span className="font-medium capitalize">{entry.toStatusName}</span></>
                            : <span className="font-medium capitalize">{entry.toStatusName}</span>}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {entry.actorName ?? "Unknown"} · {new Date(entry.timestamp).toLocaleString(undefined, { timeZone: "UTC", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {entry.note && <p className="text-xs text-gray-500 mt-1 italic">"{entry.note}"</p>}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Note input for transitions that require one */}
              {pendingTransition && TRANSITION_CONFIG[pendingTransition]?.needsNote && (
                <div className="pt-4 border-t border-gray-100">
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    Rejection note <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={rejectionNote}
                    onChange={(e) => setRejectionNote(e.target.value)}
                    placeholder="Explain why this expense is being rejected…"
                    rows={3}
                    disabled={isActing}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 disabled:bg-gray-50 resize-none transition"
                  />
                </div>
              )}

              {actionError && (
                <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{actionError}</p>
              )}
            </>
          )}
        </div>

        {/* Footer — only rendered when there are actions */}
        {availableTransitions.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-center gap-2">
            {pendingTransition ? (
              <>
                <button
                  onClick={() => { setPendingTransition(null); setRejectionNote(""); setActionError(null); }}
                  disabled={isActing}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirmWithNote}
                  disabled={isActing}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${TRANSITION_CONFIG[pendingTransition]?.btnClass ?? ""}`}
                >
                  {isActing ? "Saving…" : `Confirm ${TRANSITION_CONFIG[pendingTransition]?.label}`}
                </button>
              </>
            ) : (
              availableTransitions.map((t) => {
                const config = TRANSITION_CONFIG[t.toStatusName];
                if (!config) return null;
                return (
                  <button
                    key={t.toStatusId}
                    onClick={() => handleTransition(t.toStatusName)}
                    disabled={isActing}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${config.btnClass}`}
                  >
                    {config.label}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between text-sm gap-4">
      <span className="text-gray-400 font-medium shrink-0">{label}</span>
      <span className="text-gray-800 text-right">{value}</span>
    </div>
  );
}
