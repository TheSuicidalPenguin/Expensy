import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export type ExpenseFilters = {
  description?: string;
  categoryId?: Id<"expenseCategories">;
  submitterName?: string;
  expenseDateFrom?: number;
  expenseDateTo?: number;
  submissionDateFrom?: number;
  submissionDateTo?: number;
};

/**
 * Returns the current user's own expenses.
 * Requires VIEW_OWN_EXPENSES permission.
 */
export function useMyExpenses(filters: ExpenseFilters = {}) {
  return useQuery(api.expenses.getMyExpenses, {
    description: filters.description,
    categoryId: filters.categoryId,
    expenseDateFrom: filters.expenseDateFrom,
    expenseDateTo: filters.expenseDateTo,
    submissionDateFrom: filters.submissionDateFrom,
    submissionDateTo: filters.submissionDateTo,
  });
}

/**
 * Returns submitted expenses from other users, for manager review.
 * Requires VIEW_EXPENSES permission.
 */
export function useExpensesForReview(filters: ExpenseFilters = {}) {
  return useQuery(api.expenses.getExpensesForReview, {
    description: filters.description,
    categoryId: filters.categoryId,
    submitterName: filters.submitterName,
    expenseDateFrom: filters.expenseDateFrom,
    expenseDateTo: filters.expenseDateTo,
    submissionDateFrom: filters.submissionDateFrom,
    submissionDateTo: filters.submissionDateTo,
  });
}
