import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { FortnoxClient } from "./fortnox-client";

interface FortnoxPageProps {
  searchParams: Promise<{ connected?: string; error?: string }>;
}

export default async function FortnoxPage({ searchParams }: FortnoxPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: tokenRow }] = await Promise.all([
    supabase.from("profiles").select("scopes").eq("id", user.id).single(),
    supabase.from("fortnox_tokens").select("id").eq("user_id", user.id).single(),
  ]);

  const scopes: string[] = Array.isArray(profile?.scopes) ? profile.scopes : [];
  if (!scopes.includes("fortnox")) redirect("/");

  const isConnected = !!tokenRow;
  const errorParam = params.error ?? null;
  const justConnected = params.connected === "true";

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Fortnox" },
            ]}
          />
          <div className="flex items-center gap-3">
            <Link
              href="/profile"
              className="cursor-pointer rounded-full border border-zinc-200 px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Profile
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
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <FortnoxClient
          isConnected={isConnected}
          error={errorParam}
          justConnected={justConnected}
        />
      </main>
    </div>
  );
}
