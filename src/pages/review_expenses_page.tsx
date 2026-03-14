import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import ExpenseDetailModal from "../components/expense_detail_modal";
import ExpenseFilters, { EMPTY_FILTERS, toHookFilters, type FilterState } from "../components/expense_filters";
import type { Id } from "../../convex/_generated/dataModel";

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-700",
};

const STATUS_LABEL: Record<string, string> = {
  submitted: "Under Review",
};

export default function ReviewExpensesPage() {
  const roleData = useQuery(api.roles.getMyRole);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [viewingExpenseId, setViewingExpenseId] = useState<Id<"expenses"> | null>(null);

  const canReview = roleData?.permissions.includes("VIEW_EXPENSES") ?? false;
  const hookFilters = toHookFilters(filters);
  const expenses = useQuery(
    api.expenses.getExpensesForReview,
    canReview ? hookFilters : "skip"
  );

  // Still loading
  if (roleData === undefined) return null;

  // No permission — redirect to dashboard
  if (!canReview) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Expenses for Review</h1>
          </div>
        </div>

        <ExpenseFilters filters={filters} onChange={setFilters} showSubmitterFilter showStatusFilter={false} />

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {expenses === undefined ? (
            <div className="p-6 space-y-3 animate-pulse">
              {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
            </div>
          ) : expenses.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-gray-400">No pending expenses.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className={th}>Submitted by</th>
                  <th className={th}>Description</th>
                  <th className={th}>Category</th>
                  <th className={th}>Amount</th>
                  <th className={th}>Expense Date</th>
                  <th className={th}>Submitted on</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {expenses.map((expense) => (
                  <tr
                    key={expense._id}
                    onClick={() => setViewingExpenseId(expense._id)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className={td + " font-medium text-gray-700"}>{expense.submitterName ?? "Unknown"}</td>
                    <td className={td + " text-gray-800"}>{expense.description}</td>
                    <td className={td + " text-gray-500"}>{expense.categoryName ?? "—"}</td>
                    <td className={td + " text-gray-700"}>
                      {expense.amount !== undefined && expense.currencyCode
                        ? `${expense.currencyCode} ${expense.amount.toFixed(2)}`
                        : "—"}
                    </td>
                    <td className={td + " text-gray-500"}>
                      {expense.expenseDate ? new Date(expense.expenseDate).toLocaleDateString(undefined, { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </td>
                    <td className={td + " text-gray-500"}>
                      {expense.submissionDate ? new Date(expense.submissionDate).toLocaleDateString(undefined, { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </td>
                    <td className={td}>
                      {expense.statusName && (
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[expense.statusName] ?? "bg-gray-100 text-gray-600"}`}>
                          {STATUS_LABEL[expense.statusName] ?? expense.statusName}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {viewingExpenseId && (
        <ExpenseDetailModal expenseId={viewingExpenseId} onClose={() => setViewingExpenseId(null)} />
      )}
    </div>
  );
}

const th = "px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide";
const td = "px-5 py-3.5";
