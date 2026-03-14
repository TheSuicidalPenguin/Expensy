import { useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";

type Step = "login" | "reset" | "verify";

/**
 * Maps raw Convex Auth error messages to short, user-friendly strings.
 */
function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  if (msg.includes("InvalidAccountId") || msg.includes("InvalidSecret") || msg.includes("InvalidPassword"))
    return "Invalid email or password.";
  if (msg.includes("OTPNotFound") || msg.includes("InvalidOTP") || msg.includes("InvalidCode"))
    return "Invalid or expired code. Please try again.";
  if (msg.includes("RateLimited"))
    return "Too many attempts. Please wait and try again.";
  if (msg.includes("AccountAlreadyExists"))
    return "An account with this email already exists.";
  if (msg.includes("AccountNotFound") || msg.includes("NotFound"))
    return "No account found with that email.";
  return "Something went wrong. Please try again.";
}

export default function LoginForm() {
  const { signIn } = useAuthActions();

  const [step, setStep] = useState<Step>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function goToLogin() {
    setStep("login");
    setCode("");
    setNewPassword("");
    setError(null);
  }

  // ── Step 1: Sign in ───────────────────────────────────────────────────────
  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
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

  // ── Step 2: Request reset code ────────────────────────────────────────────
  async function handleRequestReset(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await signIn("password", { email, flow: "reset" });
      setStep("verify");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setIsLoading(false);
    }
  }

  // ── Step 3: Verify code + set new password ────────────────────────────────
  async function handleVerifyReset(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await signIn("password", { email, code, newPassword, flow: "reset-verification" });
      goToLogin();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setIsLoading(false);
    }
  }

  // ── Reset form ─────────────────────────────────────────────────────────────
  if (step === "reset") {
    return (
      <form onSubmit={handleRequestReset} className="space-y-5" noValidate>
        <p className="text-sm text-gray-600">
          Enter your email and we'll send you a one-time reset code.
        </p>
        <div>
          <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-1">
            Email address
          </label>
          <input
            id="reset-email"
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
        {error && <ErrorBanner message={error} />}
        <button type="submit" disabled={isLoading} className={primaryBtnClass}>
          {isLoading ? "Sending…" : "Send reset code"}
        </button>
        <button type="button" onClick={goToLogin} className={linkBtnClass}>
          ← Back to sign in
        </button>
      </form>
    );
  }

  // ── Verify code ────────────────────────────────────────────────────────────
  if (step === "verify") {
    return (
      <form onSubmit={handleVerifyReset} className="space-y-5" noValidate>
        <p className="text-sm text-gray-600">
          A code was sent to <span className="font-medium">{email}</span>. Enter it below with your new password.
        </p>
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
            Reset code
          </label>
          <input
            id="code"
            type="text"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={isLoading}
            placeholder="Enter code from email"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">
            New password
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={isLoading}
            placeholder="••••••••"
            className={inputClass}
          />
        </div>
        {error && <ErrorBanner message={error} />}
        <button type="submit" disabled={isLoading} className={primaryBtnClass}>
          {isLoading ? "Resetting…" : "Reset password"}
        </button>
        <button
          type="button"
          onClick={() => { setStep("reset"); setError(null); }}
          className={linkBtnClass}
        >
          ← Resend code
        </button>
      </form>
    );
  }

  // ── Login ──────────────────────────────────────────────────────────────────
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
            onClick={() => { setStep("reset"); setError(null); }}
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

const linkBtnClass =
  "w-full text-sm text-gray-500 hover:text-gray-700 transition-colors";
