import { useState, Component, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import ExpenseForm from "../components/expense_form";

class StatsErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

/**
 * DashboardPage
 *
 * Protected page — only rendered for authenticated users (App.tsx enforces this).
 * Shows a greeting, per-status stat cards, a pending-review banner for managers,
 * a quick-add action, and navigation cards for available routes.
 */
export default function DashboardPage() {
  const me = useQuery(api.users.getMe);
  const roleData = useQuery(api.roles.getMyRole);

  const [showNewForm, setShowNewForm] = useState(false);

  const permissions = roleData?.permissions ?? [];
  const canViewOwn = permissions.includes("VIEW_OWN_EXPENSES");
  const canReview = permissions.includes("VIEW_EXPENSES");
  const canAdd = permissions.includes("ADD_EXPENSE");

  const greeting = getGreeting();
  const displayName = me?.name ?? me?.email ?? "";

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {greeting}{displayName ? `, ${displayName}` : ""}
            </h1>
            {roleData?.role && (
              <span className="mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize bg-indigo-100 text-indigo-700">
                {roleData.role}
              </span>
            )}
          </div>
        </div>

        {/* Stat cards + pending review banner — isolated so errors don't blank the page */}
        <StatsErrorBoundary>
          <DashboardStats />
        </StatsErrorBoundary>

        {/* Quick action */}
        {canAdd && (
          <button
            onClick={() => setShowNewForm(true)}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold rounded-2xl px-6 py-4 transition-colors shadow-sm"
          >
            <span className="text-lg leading-none">+</span>
            Add Expense
          </button>
        )}

      </div>

      {/* Add Expense modal */}
      {showNewForm && (
        <ExpenseForm
          onClose={() => setShowNewForm(false)}
          onSaved={() => setShowNewForm(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DashboardStats — separate component so the error boundary can isolate it
// ---------------------------------------------------------------------------

function DashboardStats() {
  const stats = useQuery(api.expenses.getDashboardStats);

  return (
    <>
      {stats === undefined ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-white rounded-2xl border border-gray-200" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Draft" count={stats.myDraft} color="gray" />
          <StatCard label="Submitted" count={stats.mySubmitted} color="blue" />
          <StatCard label="Approved" count={stats.myApproved} color="green" />
          <StatCard label="Rejected" count={stats.myRejected} color="red" />
        </div>
      )}

      {stats !== undefined && stats.pendingReview !== null && stats.pendingReview > 0 && (
        <Link
          to="/review"
          className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 hover:bg-amber-100 transition-colors"
        >
          <p className="text-sm font-medium text-amber-800">
            {stats.pendingReview}{" "}
            {stats.pendingReview === 1 ? "expense" : "expenses"} pending your review
          </p>
          <span className="text-sm font-semibold text-amber-700 whitespace-nowrap ml-4">
            Review &rarr;
          </span>
        </Link>
      )}
    </>
  );
}

type StatColor = "gray" | "blue" | "green" | "red";

const statColorMap: Record<
  StatColor,
  { bg: string; text: string; count: string }
> = {
  gray: {
    bg: "bg-gray-50 border-gray-200",
    text: "text-gray-500",
    count: "text-gray-800",
  },
  blue: {
    bg: "bg-blue-50 border-blue-200",
    text: "text-blue-500",
    count: "text-blue-800",
  },
  green: {
    bg: "bg-green-50 border-green-200",
    text: "text-green-500",
    count: "text-green-800",
  },
  red: {
    bg: "bg-red-50 border-red-200",
    text: "text-red-500",
    count: "text-red-800",
  },
};

function StatCard({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: StatColor;
}) {
  const navigate = useNavigate();
  const c = statColorMap[color];
  return (
    <button
      onClick={() => navigate("/my-expenses")}
      className={`rounded-2xl border px-4 py-4 flex flex-col gap-1 text-left w-full hover:opacity-80 transition-opacity ${c.bg}`}
    >
      <span className={`text-xs font-semibold uppercase tracking-wide ${c.text}`}>
        {label}
      </span>
      <span className={`text-3xl font-bold ${c.count}`}>{count}</span>
    </button>
  );
}

function NavCard({
  to,
  title,
  description,
}: {
  to: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5 hover:border-indigo-300 hover:shadow-md transition-all group"
    >
      <div>
        <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
          {title}
        </p>
        <p className="text-sm text-gray-400 mt-0.5">{description}</p>
      </div>
      <span className="text-gray-400 group-hover:text-indigo-500 transition-colors text-lg ml-4">
        &rarr;
      </span>
    </Link>
  );
}
