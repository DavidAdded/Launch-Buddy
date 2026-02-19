import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getIsAdmin } from "@/lib/admin";
import { Breadcrumbs } from "@/components/breadcrumbs";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: projects }, { data: profile }, isAdmin] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("scopes")
      .eq("id", user.id)
      .single(),
    getIsAdmin(),
  ]);

  const scopes: string[] = Array.isArray(profile?.scopes) ? profile.scopes : [];
  if (!scopes.includes("projects")) redirect("/");

  const myProjects = (projects ?? []).filter((p) => p.user_id === user.id);
  const sharedProjects = (projects ?? []).filter((p) => p.user_id !== user.id);

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Projects" },
            ]}
          />
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {user.email}
            </span>
            {isAdmin && (
              <Link
                href="/admin"
                className="cursor-pointer rounded-full border border-zinc-200 px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Admin
              </Link>
            )}
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
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            My Projects
          </h2>
          <Link
            href="/projects/new"
            className="cursor-pointer rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            New Project
          </Link>
        </div>

        {myProjects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
            <p className="text-zinc-500 dark:text-zinc-400">
              No projects yet. Create your first project to get started.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myProjects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="cursor-pointer group rounded-2xl border border-zinc-200 bg-white p-6 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
              >
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-zinc-900 group-hover:text-zinc-600 dark:text-zinc-50 dark:group-hover:text-zinc-300">
                    {project.name}
                  </h3>
                  {project.is_public && (
                    <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-400">
                      Public
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-col gap-1">
                  {project.staging_url && (
                    <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                      Staging: {project.staging_url}
                    </p>
                  )}
                  {project.prod_url && (
                    <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                      Prod: {project.prod_url}
                    </p>
                  )}
                </div>
                <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500">
                  {new Date(project.created_at).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        )}

        {sharedProjects.length > 0 && (
          <>
            <h2 className="mb-6 mt-12 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Shared with You
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sharedProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="cursor-pointer group rounded-2xl border border-zinc-200 bg-white p-6 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                >
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-zinc-900 group-hover:text-zinc-600 dark:text-zinc-50 dark:group-hover:text-zinc-300">
                      {project.name}
                    </h3>
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                      Shared
                    </span>
                  </div>
                  <div className="mt-3 flex flex-col gap-1">
                    {project.staging_url && (
                      <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                        Staging: {project.staging_url}
                      </p>
                    )}
                    {project.prod_url && (
                      <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                        Prod: {project.prod_url}
                      </p>
                    )}
                  </div>
                  <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500">
                    {new Date(project.created_at).toLocaleDateString()}
                  </p>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
