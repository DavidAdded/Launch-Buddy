import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteProject, deleteFile, initializeChecklist } from "../actions";
import { FileUpload } from "./file-upload";
import { Checklist } from "./checklist";
import { ProjectSettings } from "./project-settings";

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

  let assignees: { id: string; displayName: string }[] = [];
  if (project.is_public) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .order("first_name");

    assignees = (profiles ?? [])
      .map((p) => ({
        id: p.id,
        displayName: [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unnamed",
      }));
  }

  const { data: files } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  const filesWithUrls = await Promise.all(
    (files ?? []).map(async (file) => {
      const { data } = await supabase.storage
        .from("project-files")
        .createSignedUrl(file.file_path, 3600);
      return { ...file, url: data?.signedUrl ?? null };
    })
  );

  const deleteProjectWithId = deleteProject.bind(null, id);

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
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link
            href="/projects"
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 cursor-pointer"
          >
            &larr; Back to Projects
          </Link>
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

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
              Files
            </h3>
          </div>

          <FileUpload projectId={id} userId={user.id} />

          {filesWithUrls.length === 0 ? (
            <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No files uploaded yet.
            </p>
          ) : (
            <div className="mt-6 divide-y divide-zinc-100 dark:divide-zinc-800">
              {filesWithUrls.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between py-3"
                >
                  <div className="min-w-0 flex-1">
                    {file.url ? (
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cursor-pointer truncate text-sm font-medium text-zinc-900 underline transition-colors hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-300"
                      >
                        {file.file_name}
                      </a>
                    ) : (
                      <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {file.file_name}
                      </span>
                    )}
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">
                      {file.content_type} &middot;{" "}
                      {formatFileSize(file.file_size)}
                    </p>
                  </div>
                  <form
                    action={async () => {
                      "use server";
                      await deleteFile(file.id, file.file_path, id);
                    }}
                  >
                    <button
                      type="submit"
                      className="cursor-pointer ml-4 text-sm text-red-500 transition-colors hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8">
          <Checklist items={checklistItems ?? []} projectId={id} isPublic={project.is_public} assignees={assignees} />
        </div>
      </main>
    </div>
  );
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
