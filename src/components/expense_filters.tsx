import { useRef } from "react";
import { useCategories, useExpenseStatuses } from "../hooks/use_lookup_data";
import type { Id } from "../../convex/_generated/dataModel";

export interface FilterState {
  description: string;
  categoryId: Id<"expenseCategories"> | "";
  statusName: string;
  submitterName: string;
  expenseDateFrom: string;
  expenseDateTo: string;
  submissionDateFrom: string;
  submissionDateTo: string;
}

export const EMPTY_FILTERS: FilterState = {
  description: "",
  categoryId: "",
  statusName: "",
  submitterName: "",
  expenseDateFrom: "",
  expenseDateTo: "",
  submissionDateFrom: "",
  submissionDateTo: "",
};


interface Props {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  showSubmissionDate?: boolean;
  showSubmitterFilter?: boolean;
  showStatusFilter?: boolean;
}

export default function ExpenseFilters({ filters, onChange, showSubmissionDate = true, showSubmitterFilter = false, showStatusFilter = true }: Props) {
  const categories = useCategories();
  const statuses = useExpenseStatuses();

  function set<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    onChange({ ...filters, [key]: value });
  }

  const isActive = Object.values(filters).some((v) => v !== "");

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 mb-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
          <input
            type="text"
            value={filters.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Search…"
            className={inputClass}
          />
        </div>

        {/* Submitter name (review page only) */}
        {showSubmitterFilter && (
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">User</label>
            <input
              type="text"
              value={filters.submitterName}
              onChange={(e) => set("submitterName", e.target.value)}
              placeholder="Search by name…"
              className={inputClass}
            />
          </div>
        )}

        {/* Category */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Category</label>
          <select
            value={filters.categoryId}
            onChange={(e) => set("categoryId", e.target.value as Id<"expenseCategories"> | "")}
            className={inputClass}
          >
            <option value="">All categories</option>
            {categories?.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Status */}
        {showStatusFilter && (
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Status</label>
            <select
              value={filters.statusName}
              onChange={(e) => set("statusName", e.target.value)}
              className={inputClass}
            >
              <option value="">All statuses</option>
              {statuses?.map((s) => (
                <option key={s._id} value={s.name} className="capitalize">{s.name.charAt(0).toUpperCase() + s.name.slice(1)}</option>
              ))}
            </select>
          </div>
        )}

        {/* Expense date range */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Expense Date</label>
          <div className="flex items-center gap-2">
            <DateInput value={filters.expenseDateFrom} onChange={(v) => set("expenseDateFrom", v)} />
            <span className="text-gray-300 text-xs shrink-0">to</span>
            <DateInput value={filters.expenseDateTo} onChange={(v) => set("expenseDateTo", v)} />
          </div>
        </div>

        {/* Submission date range */}
        {showSubmissionDate && (
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Submission Date</label>
            <div className="flex items-center gap-2">
              <DateInput value={filters.submissionDateFrom} onChange={(v) => set("submissionDateFrom", v)} />
              <span className="text-gray-300 text-xs shrink-0">to</span>
              <DateInput value={filters.submissionDateTo} onChange={(v) => set("submissionDateTo", v)} />
            </div>
          </div>
        )}
      </div>

      {isActive && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <button
            onClick={() => onChange(EMPTY_FILTERS)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}

/** Convert a FilterState (string dates) to the args shape the hooks expect. */
export function toHookFilters(f: FilterState) {
  return {
    description: f.description || undefined,
    categoryId: f.categoryId || undefined,
    statusName: f.statusName || undefined,
    submitterName: f.submitterName || undefined,
    expenseDateFrom: f.expenseDateFrom ? new Date(f.expenseDateFrom).getTime() : undefined,
    expenseDateTo: f.expenseDateTo ? new Date(f.expenseDateTo + "T23:59:59").getTime() : undefined,
    submissionDateFrom: f.submissionDateFrom ? new Date(f.submissionDateFrom).getTime() : undefined,
    submissionDateTo: f.submissionDateTo ? new Date(f.submissionDateTo + "T23:59:59").getTime() : undefined,
  };
}

/**
 * Click-only date picker.
 * Shows a styled read-only field; clicking it opens the native calendar via showPicker().
 * No keyboard editing possible.
 */
function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
      onClick={() => ref.current?.showPicker()}
      className="relative w-full flex items-center justify-between rounded-lg border border-gray-200 px-3 py-1.5 bg-white cursor-pointer hover:border-gray-400 transition select-none"
    >
      <span className={`text-sm ${formatted ? "text-gray-700" : "text-gray-400"}`}>
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
        onChange={(e) => onChange(e.target.value)}
        className="absolute opacity-0 pointer-events-none w-0 h-0"
        tabIndex={-1}
      />
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition bg-white";
