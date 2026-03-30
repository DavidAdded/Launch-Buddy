import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { initializeChecklist } from "../../actions";
import { Checklist } from "../checklist";
import { Breadcrumbs } from "@/components/breadcrumbs";

export default async function LaunchChecklistPage({
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
    .select("id, name, is_public, user_id")
    .eq("id", id)
    .single();

  if (!project) {
    redirect("/projects");
  }

  let assignees: { id: string; displayName: string }[] = [];
  if (project.is_public) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .order("first_name");

    assignees = (profiles ?? []).map((p) => ({
      id: p.id,
      displayName:
        [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unnamed",
    }));
  }

  let { data: checklistItems } = await supabase
    .from("checklist_items")
    .select("id, group_name, label, checked, irrelevant, assignee, position")
    .eq("project_id", id)
    .order("group_name")
    .order("position");

  if (!checklistItems || checklistItems.length === 0) {
    await initializeChecklist(id);
    const { data: seeded } = await supabase
      .from("checklist_items")
      .select("id, group_name, label, checked, irrelevant, assignee, position")
      .eq("project_id", id)
      .order("group_name")
      .order("position");
    checklistItems = seeded;
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
              { label: "Launch Checklist" },
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
        <Checklist
          items={checklistItems ?? []}
          projectId={id}
          isPublic={project.is_public}
          assignees={assignees}
        />
      </main>
    </div>
  );
}
