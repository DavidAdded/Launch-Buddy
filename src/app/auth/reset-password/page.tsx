import { ResetPasswordForm } from "./reset-form";

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-sm flex-col gap-8 rounded-2xl bg-white p-10 shadow-sm dark:bg-zinc-900">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Reset Password
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Enter your new password below.
          </p>
        </div>
        <ResetPasswordForm />
      </main>
    </div>
  );
}
