import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import LoginPage from "./pages/login_page";
import ResetPasswordPage from "./pages/reset_password_page";
import DashboardPage from "./pages/dashboard_page";
import MyExpensesPage from "./pages/my_expenses_page";
import ReviewExpensesPage from "./pages/review_expenses_page";

/**
 * Root application router.
 *
 * Routes:
 *   /login      → LoginPage        (unauthenticated)
 *   /dashboard  → DashboardPage    (authenticated)
 *   *           → redirect /login
 *
 * Auth state is driven by <Authenticated>, <Unauthenticated>, and <AuthLoading>
 * from convex/react. These components subscribe to the ConvexAuthProvider session
 * and re-render automatically when auth state changes (sign-in / sign-out).
 *
 * Each route renders all three auth-gated wrappers to guarantee that exactly
 * the right content is shown regardless of which state the session is in.
 */
const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <span className="text-sm text-gray-400">Loading…</span>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── /login ───────────────────────────────────────────────────── */}
        <Route
          path="/login"
          element={
            <>
              <AuthLoading>
                <LoadingScreen />
              </AuthLoading>
              <Unauthenticated>
                <LoginPage />
              </Unauthenticated>
              <Authenticated>
                <Navigate to="/dashboard" replace />
              </Authenticated>
            </>
          }
        />

        {/* ── /dashboard ───────────────────────────────────────────────── */}
        <Route
          path="/dashboard"
          element={
            <>
              <AuthLoading>
                <LoadingScreen />
              </AuthLoading>
              <Authenticated>
                <DashboardPage />
              </Authenticated>
              <Unauthenticated>
                <Navigate to="/login" replace />
              </Unauthenticated>
            </>
          }
        />

        {/* ── /my-expenses ─────────────────────────────────────────────── */}
        <Route
          path="/my-expenses"
          element={
            <>
              <AuthLoading><LoadingScreen /></AuthLoading>
              <Authenticated><MyExpensesPage /></Authenticated>
              <Unauthenticated><Navigate to="/login" replace /></Unauthenticated>
            </>
          }
        />

        {/* ── /review ──────────────────────────────────────────────────── */}
        <Route
          path="/review"
          element={
            <>
              <AuthLoading><LoadingScreen /></AuthLoading>
              <Authenticated><ReviewExpensesPage /></Authenticated>
              <Unauthenticated><Navigate to="/login" replace /></Unauthenticated>
            </>
          }
        />

        {/* ── /reset-password ──────────────────────────────────────────── */}
        <Route
          path="/reset-password"
          element={
            <>
              <AuthLoading><LoadingScreen /></AuthLoading>
              <Unauthenticated><ResetPasswordPage /></Unauthenticated>
              <Authenticated><Navigate to="/dashboard" replace /></Authenticated>
            </>
          }
        />

        {/* ── catch-all ────────────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
