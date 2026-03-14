import ResetPasswordForm from "../components/reset_password_form";

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-indigo-600">Expensy</h1>
          <p className="mt-2 text-sm text-gray-500">Reset your password</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 px-8 py-8">
          <ResetPasswordForm />
        </div>
      </div>
    </div>
  );
}
