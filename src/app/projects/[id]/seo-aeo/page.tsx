import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { SeoAeoView } from "./seo-aeo-view";

export default async function SeoAeoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, prod_url")
    .eq("id", id)
    .single();

  if (!project) {
    redirect("/projects");
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex  items-center justify-between px-6 py-4">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Projects", href: "/projects" },
              { label: project.name, href: `/projects/${id}` },
              { label: "SEO/AEO Analyzer" },
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
        <SeoAeoView projectId={id} defaultUrl={project.prod_url} />
      </main>
    </div>
  );
}
