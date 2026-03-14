import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { Email } from "@convex-dev/auth/providers/Email";

/**
 * OTP-based password reset email sender using Resend.
 */
const PasswordResetOTP = Email({
  sendVerificationRequest: async ({ identifier: email, token }) => {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;

    if (!apiKey || !from) {
      throw new Error(
        "Missing RESEND_API_KEY or RESEND_FROM for password reset emails."
      );
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM,
        to: email,
        subject: "Expensy - Password Reset Request",
        text: `Your password reset code is: ${token}`,
        html: `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Password Reset</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial, sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:24px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.08);">
            <tr>
              <td style="padding:24px 28px;background:#0f172a;color:#ffffff;">
                <div style="font-size:18px;font-weight:700;letter-spacing:0.2px;">Expensy</div>
                <div style="font-size:14px;opacity:0.8;margin-top:4px;">Password reset</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;">Use this code to reset your password</h1>
                <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#334155;">
                  Enter this one-time code in the app. It expires shortly for your security.
                </p>
                <div style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-align:center;font-size:24px;letter-spacing:4px;font-weight:700;color:#0f172a;">
                  ${token}
                </div>
                <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#64748b;">
                  If you did not request this reset, you can ignore this email.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background:#f8fafc;color:#94a3b8;font-size:12px;">
                Expensy • Secure expense approvals
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Resend failed: ${response.status} ${detail}`);
    }
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
function validatePasswordRequirements(password: string) {
  if (password.length < 8)
    throw new Error("Password must be at least 8 characters.");
  if (!/[A-Z]/.test(password))
    throw new Error("Password must contain at least one uppercase letter.");
  if (!/[0-9]/.test(password))
    throw new Error("Password must contain at least one number.");
  if (!/[^A-Za-z0-9]/.test(password))
    throw new Error("Password must contain at least one special character.");
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password({ reset: PasswordResetOTP, validatePasswordRequirements })],
});
