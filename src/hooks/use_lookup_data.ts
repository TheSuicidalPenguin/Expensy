import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * Returns all available currencies.
 * Returns `undefined` while loading.
 */
export function useCurrencies() {
  return useQuery(api.expenses.getCurrencies);
}

/**
 * Returns all available expense categories.
 * Returns `undefined` while loading.
 */
export function useCategories() {
  return useQuery(api.expenses.getCategories);
}

/**
 * Returns all available expense statuses.
 * Returns `undefined` while loading.
 */
export function useExpenseStatuses() {
  return useQuery(api.expenses.getExpenseStatuses);
}
