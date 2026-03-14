import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthActions } from "@convex-dev/auth/react";

type Step = "request" | "verify";

// ---------------------------------------------------------------------------
// Password rules — single source of truth used by both UI and submit guard
// ---------------------------------------------------------------------------

const PASSWORD_RULES = [
  { id: "length",    label: "At least 8 characters",            test: (p: string) => p.length >= 8 },
  { id: "upper",     label: "At least one uppercase letter",     test: (p: string) => /[A-Z]/.test(p) },
  { id: "number",    label: "At least one number",               test: (p: string) => /[0-9]/.test(p) },
  { id: "special",   label: "At least one special character",    test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

function isPasswordValid(password: string) {
  return PASSWORD_RULES.every((r) => r.test(password));
}

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  if (msg.includes("OTPNotFound") || msg.includes("InvalidOTP") || msg.includes("InvalidCode"))
    return "Invalid or expired code. Please try again.";
  if (msg.includes("RateLimited"))
    return "Too many attempts. Please wait and try again.";
  if (msg.includes("AccountNotFound") || msg.includes("NotFound"))
    return "No account found with that email.";
  return "Something went wrong. Please try again.";
}

export default function ResetPasswordForm() {
  const { signIn, signOut } = useAuthActions();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Derived state — computed on every render, no need for extra useState
  const passwordMismatch = confirmTouched && confirmPassword !== "" && confirmPassword !== newPassword;

  async function handleRequestReset(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Email address is required.");
      return;
    }
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

  async function handleResendCode() {
    setError(null);
    setResendMessage(null);
    setIsLoading(true);
    try {
      await signIn("password", { email, flow: "reset" });
      setResendMessage("A new code has been sent to your email.");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyReset(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!code.trim()) {
      setError("Please enter the reset code sent to your email.");
      return;
    }
    if (!isPasswordValid(newPassword)) {
      setError("Please meet all password requirements.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      await signIn("password", { email, code, newPassword, flow: "reset-verification" });
      // Sign out immediately — the reset flow auto-logs in; we want the user to sign in manually.
      await signOut();
      navigate("/login");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setIsLoading(false);
    }
  }

  if (step === "verify") {
    return (
      <form onSubmit={handleVerifyReset} className="space-y-5" noValidate>
        <p className="text-sm text-gray-600">
          A reset code was sent to <span className="font-medium">{email}</span>.
        </p>

        {/* Reset code */}
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
            Reset code
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={isLoading}
            placeholder="Enter code from email"
            className={inputClass}
          />
        </div>

        {/* New password + complexity popup */}
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
            onChange={(e) => { setNewPassword(e.target.value); setPasswordTouched(true); }}
            disabled={isLoading}
            placeholder="••••••••"
            className={inputClass}
          />
          {/* Requirements checklist — visible once the user starts typing */}
          {passwordTouched && (
            <ul className="mt-2 space-y-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
              {PASSWORD_RULES.map((rule) => {
                const passed = rule.test(newPassword);
                return (
                  <li key={rule.id} className={`flex items-center gap-2 text-xs ${passed ? "text-green-600" : "text-gray-500"}`}>
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${passed ? "bg-green-100 text-green-600" : "bg-gray-200 text-gray-400"}`}>
                      {passed ? "✓" : "✕"}
                    </span>
                    {rule.label}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Confirm password */}
        <div>
          <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
            Confirm new password
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setConfirmTouched(true); }}
            disabled={isLoading}
            placeholder="••••••••"
            className={`${inputClass} ${passwordMismatch ? "border-red-400 focus:ring-red-300 focus:border-red-400" : ""}`}
          />
          {passwordMismatch && (
            <p className="mt-1 text-xs text-red-500">Passwords do not match.</p>
          )}
        </div>

        {resendMessage && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            {resendMessage}
          </p>
        )}
        {error && <ErrorBanner message={error} />}

        <button type="submit" disabled={isLoading} className={primaryBtnClass}>
          {isLoading ? "Resetting…" : "Reset password"}
        </button>

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={handleResendCode}
            disabled={isLoading}
            className="text-sm text-indigo-600 hover:text-indigo-500 transition-colors disabled:opacity-50"
          >
            Resend code
          </button>
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Back to sign in
          </button>
        </div>
      </form>
    );
  }

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

      <button
        type="button"
        onClick={() => navigate("/login")}
        className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        ← Back to sign in
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
