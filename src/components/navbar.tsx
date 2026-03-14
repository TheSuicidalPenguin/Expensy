import { NavLink, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";

export default function Navbar() {
  const { signOut } = useAuthActions();
  const me = useQuery(api.users.getMe);
  const roleData = useQuery(api.roles.getMyRole);
  const canReview = roleData?.permissions.includes("VIEW_EXPENSES") ?? false;

  return (
    <nav className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-6">
        {/* Brand */}
        <Link to="/dashboard" className="text-lg font-bold text-indigo-600 shrink-0 mr-4">
          Expensy
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1 flex-1">
          <NavItem to="/my-expenses">My Expenses</NavItem>
          {canReview && <NavItem to="/review">Review Expenses</NavItem>}
        </div>

        {/* User info + sign out */}
        <div className="flex items-center gap-4 shrink-0">
          {me && (
            <span className="text-sm text-gray-500 hidden sm:inline truncate max-w-[180px]">
              {me.name ?? me.email}
            </span>
          )}
          <button
            onClick={() => void signOut()}
            className="text-sm font-medium text-red-500 hover:text-red-600 transition-colors whitespace-nowrap"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
          isActive
            ? "bg-indigo-50 text-indigo-700"
            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
        }`
      }
    >
      {children}
    </NavLink>
  );
}
