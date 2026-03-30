import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex  items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="cursor-pointer text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            &larr; Back to Home
          </Link>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="cursor-pointer rounded-full border border-zinc-200 px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Sign Out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-6 py-10">
        <h2 className="mb-8 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Profile
        </h2>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <ProfileForm
            firstName={profile?.first_name ?? ""}
            lastName={profile?.last_name ?? ""}
            email={user.email ?? ""}
          />
        </div>
      </main>
    </div>
  );
}
