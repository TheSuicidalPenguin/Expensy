import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthActions } from "@convex-dev/auth/react";

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  if (msg.includes("RateLimited"))
    return "Too many attempts. Please wait and try again.";
  return "Invalid email or password.";
}

export default function LoginForm() {
  const { signIn } = useAuthActions();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Email address is required."); return; }
    if (!password) { setError("Password is required."); return; }
    setError(null);
    setIsLoading(true);
    try {
      await signIn("password", { email, password, flow: "signIn" });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSignIn} className="space-y-5" noValidate>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
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
          className={inputClass}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <button
            type="button"
            onClick={() => navigate("/reset-password")}
            className="text-xs text-indigo-600 hover:text-indigo-500 transition-colors"
          >
            Forgot password?
          </button>
        </div>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          placeholder="••••••••"
          className={inputClass}
        />
      </div>

      {error && <ErrorBanner message={error} />}

      <button type="submit" disabled={isLoading} className={primaryBtnClass}>
        {isLoading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
      {message}
    </p>
  );
}

const inputClass =
  "block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 transition-colors";

const primaryBtnClass =
  "w-full flex justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
