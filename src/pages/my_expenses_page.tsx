import { useState } from "react";
import { useMyExpenses } from "../hooks/use_expenses";
import ExpenseForm from "../components/expense_form";
import ExpenseDetailModal from "../components/expense_detail_modal";
import ExpenseFilters, { EMPTY_FILTERS, toHookFilters, type FilterState } from "../components/expense_filters";
import type { Id } from "../../convex/_generated/dataModel";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function MyExpensesPage() {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const expenses = useMyExpenses(toHookFilters(filters));

  const [showNewForm, setShowNewForm] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<Id<"expenses"> | null>(null);
  const [viewingExpenseId, setViewingExpenseId] = useState<Id<"expenses"> | null>(null);

  function handleRowClick(expenseId: Id<"expenses">, statusName: string | null) {
    if (statusName === "draft" || statusName === "rejected") {
      setEditingExpenseId(expenseId);
    } else {
      setViewingExpenseId(expenseId);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">My Expenses</h1>
          </div>
          <button
            onClick={() => setShowNewForm(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 transition-colors"
          >
            + Add Expense
          </button>
        </div>

        <ExpenseFilters filters={filters} onChange={setFilters} />

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {expenses === undefined ? (
            <div className="p-6 space-y-3 animate-pulse">
              {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
            </div>
          ) : expenses.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-gray-400">No expenses found.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className={th}>Description</th>
                  <th className={th}>Category</th>
                  <th className={th}>Amount</th>
                  <th className={th}>Expense Date</th>
                  <th className={th}>Submitted</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {expenses.map((expense) => (
                  <tr
                    key={expense._id}
                    onClick={() => handleRowClick(expense._id, expense.statusName)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className={td + " font-medium text-gray-800"}>{expense.description}</td>
                    <td className={td + " text-gray-500"}>{expense.categoryName ?? "—"}</td>
                    <td className={td + " text-gray-700"}>
                      {expense.amount !== undefined && expense.currencyCode
                        ? formatAmount(expense.amount, expense.currencyCode)
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
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[expense.statusName] ?? "bg-gray-100 text-gray-600"}`}>
                          {expense.statusName}
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

      {showNewForm && (
        <ExpenseForm onClose={() => setShowNewForm(false)} onSaved={() => setShowNewForm(false)} />
      )}
      {editingExpenseId && (
        <ExpenseForm
          expenseId={editingExpenseId}
          onClose={() => setEditingExpenseId(null)}
          onSaved={() => setEditingExpenseId(null)}
        />
      )}
      {viewingExpenseId && (
        <ExpenseDetailModal expenseId={viewingExpenseId} onClose={() => setViewingExpenseId(null)} />
      )}
    </div>
  );
}

function formatAmount(amount: number, currencyCode: string) {
  if (currencyCode === "USD") {
    return `${currencyCode} ${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
  }
  return `${currencyCode} ${amount.toFixed(2)}`;
}

const th = "px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide";
const td = "px-5 py-3.5";
