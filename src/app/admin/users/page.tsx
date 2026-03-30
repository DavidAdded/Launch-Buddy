import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getIsAdmin } from "@/lib/admin";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { InviteUserForm } from "./invite-form";
import { DeleteUserButton } from "./delete-button";
import { ScopeToggles } from "./scope-toggles";
import { FortnoxIdField } from "./fortnox-id-field";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const isAdmin = await getIsAdmin();
  if (!isAdmin) redirect("/");

  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "id, first_name, last_name, email, is_admin, scopes, fortnox_id, updated_at",
    )
    .order("is_admin", { ascending: false })
    .order("email", { ascending: true });

  const admins = (profiles ?? []).filter((p) => p.is_admin);
  const users = (profiles ?? []).filter((p) => !p.is_admin);

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex  items-center justify-between px-6 py-4">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Admin", href: "/admin" },
              { label: "Users" },
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

      <main className="mx-auto  px-6 py-10">
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Invite User
          </h2>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <InviteUserForm />
          </div>
        </section>

        {admins.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Admins
            </h2>
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              {admins.map((profile, i) => (
                <div
                  key={profile.id}
                  className={`flex items-center justify-between px-6 py-4 ${
                    i < admins.length - 1
                      ? "border-b border-zinc-100 dark:border-zinc-800"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
                      {getInitials(
                        profile.first_name,
                        profile.last_name,
                        profile.email,
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">
                        {formatName(
                          profile.first_name,
                          profile.last_name,
                          profile.email,
                        )}
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {profile.email ?? "No email"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/admin/users/${profile.id}/profile`}
                      className="cursor-pointer rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Edit Profile
                    </Link>
                    <FortnoxIdField
                      userId={profile.id}
                      fortnoxId={profile.fortnox_id ?? ""}
                    />
                    <ScopeToggles
                      userId={profile.id}
                      scopes={
                        Array.isArray(profile.scopes) ? profile.scopes : []
                      }
                    />
                    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                      Admin
                    </span>
                    <DeleteUserButton
                      userId={profile.id}
                      isSelf={profile.id === user.id}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Users
          </h2>
          {users.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
              <p className="text-zinc-500 dark:text-zinc-400">
                No other users registered yet.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              {users.map((profile, i) => (
                <div
                  key={profile.id}
                  className={`flex items-center justify-between px-6 py-4 ${
                    i < users.length - 1
                      ? "border-b border-zinc-100 dark:border-zinc-800"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-sm font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {getInitials(
                        profile.first_name,
                        profile.last_name,
                        profile.email,
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">
                        {formatName(
                          profile.first_name,
                          profile.last_name,
                          profile.email,
                        )}
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {profile.email ?? "No email"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/admin/users/${profile.id}/profile`}
                      className="cursor-pointer rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Edit Profile
                    </Link>
                    <FortnoxIdField
                      userId={profile.id}
                      fortnoxId={profile.fortnox_id ?? ""}
                    />
                    <ScopeToggles
                      userId={profile.id}
                      scopes={
                        Array.isArray(profile.scopes) ? profile.scopes : []
                      }
                    />
                    <DeleteUserButton
                      userId={profile.id}
                      isSelf={profile.id === user.id}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function getInitials(
  firstName: string | null,
  lastName: string | null,
  email: string | null,
): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) return firstName[0].toUpperCase();
  if (email) return email[0].toUpperCase();
  return "?";
}

function formatName(
  firstName: string | null,
  lastName: string | null,
  email: string | null,
): string {
  const parts = [firstName, lastName].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return email ?? "Unknown user";
}
