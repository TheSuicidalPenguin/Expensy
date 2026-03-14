import { useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";

/**
 * LoginForm
 *
 * Renders a controlled email + password form and signs the user in via
 * Convex Auth's Password provider. On success the session token is stored
 * automatically by ConvexAuthProvider and the user is navigated to /dashboard.
 *
 * Error cases:
 *   - Invalid credentials  → Convex Auth throws; message shown inline.
 *   - Empty fields         → native HTML `required` validation prevents submit.
 *   - Network failure      → generic fallback message shown inline.
 *
 * Loading state: inputs and button are disabled while the sign-in request
 * is in flight to prevent duplicate submissions.
 */
export default function LoginForm() {
  const { signIn } = useAuthActions();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await signIn("password", { email, password, flow: "signIn" });
      // No imperative navigate here — ConvexAuthProvider updates its session
      // state after signIn resolves, which triggers the <Authenticated> wrapper
      // in App.tsx to render <Navigate to="/dashboard" /> reactively.
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Sign in failed. Please check your credentials and try again.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Email */}
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Email address
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          placeholder="you@company.com"
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 transition-colors"
        />
      </div>

      {/* Password */}
      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          placeholder="••••••••"
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 transition-colors"
        />
      </div>

      {/* Inline error */}
      {error !== null && (
        <p
          role="alert"
          className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
        >
          {error}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
