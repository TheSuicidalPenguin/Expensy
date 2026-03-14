import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { Email } from "@convex-dev/auth/providers/Email";

/**
 * OTP-based password reset email sender.
 * In production, replace the console.log with a real email provider (e.g. Resend).
 * The reset code is logged to Convex function logs (visible in the Convex dashboard).
 */
const PasswordResetOTP = Email({
  sendVerificationRequest: async ({ identifier: email, token }) => {
    console.log(`[Password Reset] Code for ${email}: ${token}`);
  },
});

/**
 * Convex Auth configuration.
 *
 * Exports the core auth helpers used throughout the backend:
 *   - `auth`          – bound to ctx; use `auth.getUserId(ctx)` in queries/mutations
 *   - `signIn`        – HTTP handler for the sign-in endpoint
 *   - `signOut`       – HTTP handler for the sign-out endpoint
 *   - `store`         – HTTP handler for session storage (cookies / tokens)
 *   - `isAuthenticated` – boolean helper for HTTP routes
 *
 * Only the Password provider is enabled. No OAuth providers are configured.
 * Users are pre-created by an admin; there is no self-signup flow.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password({ reset: PasswordResetOTP })],
});
