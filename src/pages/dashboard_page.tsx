import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";

/**
 * DashboardPage
 *
 * Protected page — only rendered for authenticated users (App.tsx enforces this).
 * Shows navigation cards for the user's available actions based on their role.
 */
export default function DashboardPage() {
  const { signOut } = useAuthActions();
  const me = useQuery(api.users.getMe);
  const roleData = useQuery(api.roles.getMyRole);

  const permissions = roleData?.permissions ?? [];
  const canViewOwn = permissions.includes("VIEW_OWN_EXPENSES");
  const canReview = permissions.includes("VIEW_EXPENSES");

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
            {me && (
              <p className="text-sm text-gray-400 mt-0.5">
                {me.name ?? me.email}
                {roleData?.role && (
                  <span className="ml-2 capitalize inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    {roleData.role}
                  </span>
                )}
              </p>
            )}
          </div>
          <button
            onClick={() => void signOut()}
            className="text-sm font-medium text-red-500 hover:text-red-600 transition-colors"
          >
            Sign out
          </button>
        </div>

        {/* Loading skeleton */}
        {roleData === undefined ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-20 bg-white rounded-2xl border border-gray-200" />
            <div className="h-20 bg-white rounded-2xl border border-gray-200" />
          </div>
        ) : (
          <div className="space-y-3">
            {canViewOwn && (
              <NavCard
                to="/my-expenses"
                title="My Expenses"
                description="View and manage your submitted and draft expenses"
              />
            )}
            {canReview && (
              <NavCard
                to="/review"
                title="Review Expenses"
                description="Approve or reject expenses submitted by employees"
              />
            )}
          </div>
        )}
      </div>
    </div>
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
      className="block bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5 hover:border-gray-300 hover:shadow transition-all"
    >
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <p className="text-sm text-gray-400 mt-0.5">{description}</p>
    </Link>
  );
}
