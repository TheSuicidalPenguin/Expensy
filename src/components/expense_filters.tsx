import { useCategories } from "../hooks/use_lookup_data";
import type { Id } from "../../convex/_generated/dataModel";

export interface FilterState {
  description: string;
  categoryId: Id<"expenseCategories"> | "";
  submitterName: string;
  expenseDateFrom: string;
  expenseDateTo: string;
  submissionDateFrom: string;
  submissionDateTo: string;
}

export const EMPTY_FILTERS: FilterState = {
  description: "",
  categoryId: "",
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
}

export default function ExpenseFilters({ filters, onChange, showSubmissionDate = true, showSubmitterFilter = false }: Props) {
  const categories = useCategories();

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

        {/* Expense date range */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Expense Date</label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={filters.expenseDateFrom}
              onChange={(e) => set("expenseDateFrom", e.target.value)}
              className={inputClass}
            />
            <span className="text-gray-300 text-xs shrink-0">to</span>
            <input
              type="date"
              value={filters.expenseDateTo}
              onChange={(e) => set("expenseDateTo", e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Submission date range */}
        {showSubmissionDate && (
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Submission Date</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filters.submissionDateFrom}
                onChange={(e) => set("submissionDateFrom", e.target.value)}
                className={inputClass}
              />
              <span className="text-gray-300 text-xs shrink-0">to</span>
              <input
                type="date"
                value={filters.submissionDateTo}
                onChange={(e) => set("submissionDateTo", e.target.value)}
                className={inputClass}
              />
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
    submitterName: f.submitterName || undefined,
    expenseDateFrom: f.expenseDateFrom ? new Date(f.expenseDateFrom).getTime() : undefined,
    expenseDateTo: f.expenseDateTo ? new Date(f.expenseDateTo + "T23:59:59").getTime() : undefined,
    submissionDateFrom: f.submissionDateFrom ? new Date(f.submissionDateFrom).getTime() : undefined,
    submissionDateTo: f.submissionDateTo ? new Date(f.submissionDateTo + "T23:59:59").getTime() : undefined,
  };
}

const inputClass =
  "w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition bg-white";
