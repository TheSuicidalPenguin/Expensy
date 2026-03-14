import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";

/**
 * DashboardPage
 *
 * Protected page — only rendered for authenticated users (App.tsx enforces this).
 *
 * Immediately calls the `users:getMe` protected query via `useQuery` to confirm
 * that the session token is forwarded correctly and the backend resolves it to a
 * valid user record. This serves as the end-to-end auth token validation proof.
 *
 * States:
 *   Loading  – query is in flight (undefined); skeleton rows shown.
 *   Success  – backend returned the user document; fields rendered in a table.
 *
 * Note: because this page is always inside <Authenticated>, `getMe` will only
 * run once the ConvexAuthProvider has confirmed the session. The query should
 * never throw "Unauthorized" here under normal circumstances.
 */
export default function DashboardPage() {
  const { signOut } = useAuthActions();
  const me = useQuery(api.users.getMe);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          <button
            onClick={() => void signOut()}
            className="text-sm font-medium text-red-500 hover:text-red-600 transition-colors"
          >
            Sign out
          </button>
        </div>

        {/* Protected API result */}
        {me === undefined ? (
          /* ── Loading ──────────────────────────────────────────────── */
          <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-gray-100 rounded w-1/3" />
            <div className="h-4 bg-gray-100 rounded w-2/3" />
            <div className="h-4 bg-gray-100 rounded w-1/2" />
          </div>
        ) : (
          /* ── Success — backend accepted token ─────────────────────── */
          <div className="space-y-5">
            {/* Badge */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                ✓ Token valid
              </span>
              <span className="text-xs text-gray-400">
                Protected API responded successfully
              </span>
            </div>

            {/* User fields */}
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <Row label="User ID" value={me._id} mono />
              {me.name !== null && <Row label="Name" value={me.name} />}
              {me.email !== null && <Row label="Email" value={me.email} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Small helper for displaying a labeled field row. */
function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm gap-4">
      <span className="text-gray-500 font-medium shrink-0">{label}</span>
      <span
        className={`text-gray-800 truncate ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
