import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteProject } from "../actions";
import { ProjectSettings } from "./project-settings";
import { Breadcrumbs } from "@/components/breadcrumbs";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (!project) {
    redirect("/projects");
  }

  const isOwner = project.user_id === user.id;

  const { count: fileCount } = await supabase
    .from("project_files")
    .select("*", { count: "exact", head: true })
    .eq("project_id", id);

  const { data: checklistItems } = await supabase
    .from("checklist_items")
    .select("id, checked, irrelevant")
    .eq("project_id", id);

  const totalChecklist = checklistItems?.length ?? 0;
  const doneChecklist =
    checklistItems?.filter((i) => i.checked || i.irrelevant).length ?? 0;

  const { count: footprintCount } = await supabase
    .from("footprint_requests")
    .select("*", { count: "exact", head: true })
    .eq("project_id", id);

  const deleteProjectWithId = deleteProject.bind(null, id);

  const cards: {
    title: string;
    description: string;
    href: string | null;
    stat: string | null;
    icon: string;
    comingSoon?: boolean;
  }[] = [
    {
      title: "Files",
      description:
        "Upload and manage project files, documents, and assets.",
      href: `/projects/${id}/files`,
      stat: `${fileCount ?? 0} file${(fileCount ?? 0) === 1 ? "" : "s"}`,
      icon: "folder",
    },
    {
      title: "Launch Checklist",
      description:
        "Track launch readiness across content, SEO, performance, and more.",
      href: `/projects/${id}/launch-checklist`,
      stat:
        totalChecklist > 0
          ? `${doneChecklist}/${totalChecklist} complete`
          : "Not started",
      icon: "checklist",
    },
    {
      title: "Digital Footprint",
      description:
        "Monitor your project's online presence, analytics, and social accounts.",
      href: `/projects/${id}/digital-footprint`,
      stat:
        (footprintCount ?? 0) > 0
          ? `${footprintCount} ${footprintCount === 1 ? "analysis" : "analyses"}`
          : "No analyses yet",
      icon: "globe",
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Breadcrumbs
            items={[
              { label: "Projects", href: "/projects" },
              { label: project.name },
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
        {error && (
          <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="mb-10 flex items-start justify-between">
          <div className="flex-1">
            <ProjectSettings project={project} isOwner={isOwner} />
          </div>
          {isOwner && (
            <form action={deleteProjectWithId} className="ml-4 shrink-0">
              <button
                type="submit"
                className="cursor-pointer rounded-full border border-red-200 px-4 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
              >
                Delete Project
              </button>
            </form>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const inner = (
              <div
                className={`group relative flex flex-col rounded-2xl border p-6 transition-all ${
                  card.comingSoon
                    ? "border-dashed border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                    : "border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                } ${!card.comingSoon ? "cursor-pointer" : ""}`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
                    <CardIcon type={card.icon} />
                  </div>
                  {card.comingSoon && (
                    <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      Coming soon
                    </span>
                  )}
                </div>

                <h3 className="mb-1 font-semibold text-zinc-900 dark:text-zinc-50">
                  {card.title}
                </h3>
                <p className="mb-4 flex-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {card.description}
                </p>

                {card.stat && (
                  <div className="mt-auto border-t border-zinc-100 pt-4 dark:border-zinc-800">
                    <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                      {card.stat}
                    </span>
                  </div>
                )}

                {!card.comingSoon && (
                  <div className="absolute right-5 top-6 text-zinc-300 transition-colors group-hover:text-zinc-500 dark:text-zinc-600 dark:group-hover:text-zinc-400">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </div>
                )}
              </div>
            );

            if (card.href) {
              return (
                <Link
                  key={card.title}
                  href={card.href}
                  className="no-underline"
                >
                  {inner}
                </Link>
              );
            }

            return <div key={card.title}>{inner}</div>;
          })}
        </div>
      </main>
    </div>
  );
}

function CardIcon({ type }: { type: string }) {
  switch (type) {
    case "folder":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-zinc-500 dark:text-zinc-400"
        >
          <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
        </svg>
      );
    case "checklist":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-zinc-500 dark:text-zinc-400"
        >
          <path d="M11 18H3" />
          <path d="m15 18 2 2 4-4" />
          <path d="M16 12H3" />
          <path d="M16 6H3" />
        </svg>
      );
    case "globe":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-zinc-500 dark:text-zinc-400"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
          <path d="M2 12h20" />
        </svg>
      );
    default:
      return null;
  }
}
