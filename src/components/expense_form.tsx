import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCategories, useCurrencies } from "../hooks/use_lookup_data";
import type { Id } from "../../convex/_generated/dataModel";

interface Props {
  onClose: () => void;
  onSaved: () => void;
  /** When provided, opens the form in edit mode pre-filled with this draft. */
  expenseId?: Id<"expenses">;
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function ExpenseForm({ onClose, onSaved, expenseId }: Props) {
  const isEditMode = expenseId !== undefined;

  const categories = useCategories();
  const currencies = useCurrencies();
  const existingExpense = useQuery(
    api.expenses.getExpenseById,
    isEditMode ? { expenseId } : "skip"
  );

  const generateUploadUrl = useMutation(api.expenses.generateUploadUrl);
  const createExpense = useMutation(api.expenses.createExpense);
  const updateExpense = useMutation(api.expenses.updateExpense);
  const submitExpense = useMutation(api.expenses.submitExpense);
  const deleteExpenseMutation = useMutation(api.expenses.deleteExpense);

  const [initialized, setInitialized] = useState(!isEditMode);
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<Id<"expenseCategories"> | "">("");
  const [otherCategory, setOtherCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [currencyId, setCurrencyId] = useState<Id<"currencies"> | "">("");
  const [expenseDate, setExpenseDate] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [existingReceiptId, setExistingReceiptId] = useState<Id<"_storage"> | undefined>();
  const [receiptError, setReceiptError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Auto-select USD for new expenses once currencies load
  useEffect(() => {
    if (isEditMode || !currencies) return;
    setCurrencyId((prev) => {
      if (prev) return prev;
      return currencies.find((c) => c.code === "USD")?._id ?? "";
    });
  }, [currencies, isEditMode]);

  // Pre-fill form when existing expense loads
  useEffect(() => {
    if (!isEditMode || initialized || !existingExpense || !categories || !currencies) return;

    setDescription(existingExpense.description ?? "");
    setCategoryId((existingExpense.categoryId as Id<"expenseCategories"> | undefined) ?? "");
    setOtherCategory(existingExpense.otherCategory ?? "");
    setAmount(existingExpense.amount !== undefined ? String(existingExpense.amount) : "");
    setCurrencyId((existingExpense.currencyId as Id<"currencies"> | undefined) ?? "");
    setExpenseDate(
      existingExpense.expenseDate
        ? new Date(existingExpense.expenseDate).toISOString().split("T")[0]
        : ""
    );
    setExistingReceiptId(existingExpense.receipt as Id<"_storage"> | undefined);
    setInitialized(true);
  }, [isEditMode, initialized, existingExpense, categories, currencies]);

  const selectedCategory = categories?.find((c) => c._id === categoryId);
  const isOther = selectedCategory?.name === "Other";

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setReceiptError(null);
    if (!file) { setReceiptFile(null); return; }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setReceiptError("Accepted formats: JPG, PNG, GIF, WEBP.");
      setReceiptFile(null);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setReceiptError("File must be under 5 MB.");
      setReceiptFile(null);
      return;
    }
    setReceiptFile(file);
  }

  async function uploadReceipt(): Promise<Id<"_storage"> | undefined> {
    if (!receiptFile) return undefined;
    const uploadUrl = await generateUploadUrl();
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": receiptFile.type },
      body: receiptFile,
    });
    if (!res.ok) throw new Error("Receipt upload failed.");
    const { storageId } = await res.json();
    return storageId as Id<"_storage">;
  }

  function validateForSubmit(): string[] {
    const errors: string[] = [];
    if (!description.trim()) errors.push("Description is required.");
    if (!categoryId) errors.push("Category is required.");
    if (isOther && !otherCategory.trim()) errors.push("Please specify the category.");
    if (!amount || parseFloat(amount) <= 0) errors.push("Amount must be greater than 0.");
    if (!currencyId) errors.push("Currency is required.");
    if (!expenseDate) errors.push("Expense date is required.");
    if (expenseDate && new Date(expenseDate) > new Date()) errors.push("Expense date cannot be in the future.");
    if (!receiptFile && !existingReceiptId) errors.push("Receipt is required.");
    return errors;
  }

  function buildCreateArgs(storageId?: Id<"_storage">) {
    return {
      description,
      ...(categoryId ? { categoryId } : {}),
      ...(isOther && otherCategory ? { otherCategory } : {}),
      ...(amount ? { amount: parseFloat(amount) } : {}),
      ...(currencyId ? { currencyId } : {}),
      ...(expenseDate ? { expenseDate: new Date(expenseDate).getTime() } : {}),
      ...(storageId ? { receipt: storageId } : {}),
    };
  }

  function buildUpdateArgs(storageId?: Id<"_storage">) {
    return {
      expenseId: expenseId!,
      description,
      ...(categoryId ? { categoryId } : {}),
      ...(isOther && otherCategory ? { otherCategory } : {}),
      ...(amount ? { amount: parseFloat(amount) } : {}),
      ...(currencyId ? { currencyId } : {}),
      ...(expenseDate ? { expenseDate: new Date(expenseDate).getTime() } : {}),
      ...(storageId ? { receipt: storageId } : existingReceiptId ? { receipt: existingReceiptId } : {}),
    };
  }

  async function handleSaveDraft() {
    const draftErrors: string[] = [];
    if (!description.trim()) draftErrors.push("Description is required.");
    if (amount && parseFloat(amount) < 0) draftErrors.push("Amount cannot be negative.");
    if (expenseDate && new Date(expenseDate) > new Date()) draftErrors.push("Expense date cannot be in the future.");
    if (draftErrors.length > 0) {
      setValidationErrors(draftErrors);
      return;
    }
    setValidationErrors([]);
    setIsSaving(true);
    try {
      const storageId = await uploadReceipt();
      if (isEditMode) {
        await updateExpense(buildUpdateArgs(storageId));
      } else {
        await createExpense(buildCreateArgs(storageId));
      }
      onSaved();
    } catch (err: unknown) {
      setValidationErrors([err instanceof Error ? err.message : "Something went wrong."]);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmit() {
    const errors = validateForSubmit();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);
    setIsSubmitting(true);
    try {
      const storageId = await uploadReceipt();
      if (isEditMode) {
        await updateExpense(buildUpdateArgs(storageId));
        await submitExpense({ expenseId: expenseId! });
      } else {
        const newExpenseId = await createExpense(buildCreateArgs(storageId));
        await submitExpense({ expenseId: newExpenseId });
      }
      onSaved();
    } catch (err: unknown) {
      setValidationErrors([err instanceof Error ? err.message : "Something went wrong."]);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!expenseId) return;
    setIsDeleting(true);
    try {
      await deleteExpenseMutation({ expenseId });
      onSaved();
    } catch (err: unknown) {
      setValidationErrors([err instanceof Error ? err.message : "Could not delete expense."]);
    } finally {
      setIsDeleting(false);
    }
  }

  const busy = isSaving || isSubmitting || isDeleting;
  const loading = isEditMode && !initialized;
  const blockedByFileError = receiptError !== null;
  const isDraft = existingExpense?.statusName === "draft";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 px-4"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {isEditMode ? "Edit Expense" : "New Expense"}
          </h2>
          <button
            onClick={onClose}
            disabled={busy}
            className="text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none disabled:opacity-40"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-9 bg-gray-100 rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              {/* Description */}
              <Field label="Description" required>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Team lunch"
                  disabled={busy}
                  className={inputClass}
                />
              </Field>

              {/* Category */}
              <Field label="Category" required>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value as Id<"expenseCategories"> | "")}
                  disabled={busy || !categories}
                  className={inputClass}
                >
                  <option value="">Select a category</option>
                  {categories?.map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </Field>

              {isOther && (
                <Field label="Specify category" required>
                  <input
                    type="text"
                    value={otherCategory}
                    onChange={(e) => setOtherCategory(e.target.value)}
                    placeholder="Describe the expense category"
                    disabled={busy}
                    className={inputClass}
                  />
                </Field>
              )}

              {/* Amount + Currency */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount" required>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    disabled={busy}
                    className={inputClass}
                  />
                </Field>
                <Field label="Currency" required>
                  <select
                    value={currencyId}
                    onChange={(e) => setCurrencyId(e.target.value as Id<"currencies"> | "")}
                    disabled={busy || !currencies}
                    className={inputClass}
                  >
                    <option value="">Select</option>
                    {currencies?.map((c) => (
                      <option key={c._id} value={c._id}>{c.code} — {c.name}</option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* Expense Date */}
              <Field label="Expense Date" required>
                <DatePicker
                  value={expenseDate}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={setExpenseDate}
                  disabled={busy}
                />
              </Field>

              {/* Receipt */}
              <Field label="Receipt" required>
                {existingReceiptId && !receiptFile && (
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs text-gray-400">✓ Receipt already attached</p>
                    {existingExpense?.receiptUrl && (
                      <a
                        href={existingExpense.receiptUrl}
                        download
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-500 transition-colors font-medium"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                      </a>
                    )}
                  </div>
                )}
                <input
                  type="file"
                  accept={ACCEPTED_TYPES.join(",")}
                  onChange={handleFileChange}
                  disabled={busy}
                  className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
                />
                {receiptError && <p className="text-xs text-red-500 mt-1">{receiptError}</p>}
                {receiptFile && !receiptError && (
                  <p className="text-xs text-gray-400 mt-1">{receiptFile.name}</p>
                )}
              </Field>

              {/* Validation errors */}
              {validationErrors.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3">
                  <p className="text-xs font-medium text-red-600 mb-1">
                    Please fix the following before continuing:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {validationErrors.map((e, i) => (
                      <li key={i} className="text-xs text-red-500">{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* History (edit mode only) */}
              {isEditMode && existingExpense?.history && existingExpense.history.length > 0 && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
                    History
                  </p>
                  <StatusHistory history={existingExpense.history} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 relative flex items-center justify-center gap-3">
          {isEditMode && isDraft && (
            <button
              onClick={handleDelete}
              disabled={busy}
              className="absolute left-6 px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </button>
          )}
          <button
            onClick={handleSaveDraft}
            disabled={busy || loading || blockedByFileError}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save as Draft"}
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy || loading || blockedByFileError}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type HistoryEntry = {
  _id: string;
  fromStatusName: string | null;
  toStatusName: string | null;
  actorName: string | null;
  timestamp: number;
  note?: string;
};

function StatusHistory({ history }: { history: HistoryEntry[] }) {
  return (
    <ol className="relative border-l border-gray-200 space-y-3 pl-5">
      {history.map((entry) => (
        <li key={entry._id} className="relative">
          <span className="absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-white bg-gray-300" />
          <p className="text-xs text-gray-700">
            {entry.fromStatusName ? (
              <>
                <span className="capitalize">{entry.fromStatusName}</span>
                {" → "}
                <span className="font-medium capitalize">{entry.toStatusName}</span>
              </>
            ) : (
              <span className="font-medium capitalize">{entry.toStatusName}</span>
            )}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {entry.actorName ?? "Unknown"} ·{" "}
            {new Date(entry.timestamp).toLocaleString(undefined, {
              timeZone: "UTC",
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          {entry.note && (
            <p className="text-xs text-gray-500 mt-1 italic">"{entry.note}"</p>
          )}
        </li>
      ))}
    </ol>
  );
}

function DatePicker({
  value,
  max,
  onChange,
  disabled,
}: {
  value: string;
  max?: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);

  const formatted = value
    ? new Date(value + "T00:00:00").toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <div
      onClick={() => !disabled && ref.current?.showPicker()}
      className={`w-full flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 bg-white transition select-none ${
        disabled ? "opacity-50 cursor-not-allowed bg-gray-50" : "cursor-pointer hover:border-gray-400"
      }`}
    >
      <span className={`text-sm ${formatted ? "text-gray-800" : "text-gray-400"}`}>
        {formatted || "Pick a date"}
      </span>
      <svg className="w-4 h-4 text-gray-400 shrink-0 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <input
        ref={ref}
        type="date"
        value={value}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="absolute opacity-0 pointer-events-none w-0 h-0"
        tabIndex={-1}
      />
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 disabled:bg-gray-50 disabled:text-gray-400 transition";
