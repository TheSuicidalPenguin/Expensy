import LoginForm from "../components/login_form";

/**
 * LoginPage
 *
 * Full-page layout for the unauthenticated sign-in screen. Centers the
 * LoginForm card on a neutral background. This page is only reachable when
 * the user is not authenticated — App.tsx redirects authenticated sessions
 * to /dashboard automatically.
 */
export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-indigo-600">
            Expensy
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Sign in to your account to continue
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 px-8 py-8">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
