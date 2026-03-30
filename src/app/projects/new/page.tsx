import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createProject } from "../actions";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: customers } = await supabase
    .from("customers")
    .select("id, name")
    .order("name");

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex  items-center px-6 py-4">
          <Link
            href="/projects"
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 cursor-pointer"
          >
            &larr; Back to Projects
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-6 py-10">
        <h2 className="mb-8 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          New Project
        </h2>

        {error && (
          <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
            {error}
          </p>
        )}

        <form action={createProject} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="name"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Project Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
              placeholder="My Awesome App"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="customer_id"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Company
              <span className="ml-1 text-zinc-400 dark:text-zinc-500">
                (optional)
              </span>
            </label>
            <select
              id="customer_id"
              name="customer_id"
              className="cursor-pointer rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-500"
            >
              <option value="">No company</option>
              {(customers ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="staging_url"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Staging URL
              <span className="ml-1 text-zinc-400 dark:text-zinc-500">
                (optional)
              </span>
            </label>
            <input
              id="staging_url"
              name="staging_url"
              type="url"
              className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
              placeholder="https://staging.example.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="prod_url"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Production URL
              <span className="ml-1 text-zinc-400 dark:text-zinc-500">
                (optional)
              </span>
            </label>
            <input
              id="prod_url"
              name="prod_url"
              type="url"
              className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
              placeholder="https://example.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="project_budget_hours"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Project Budget (Hours)
              <span className="ml-1 text-zinc-400 dark:text-zinc-500">
                (optional)
              </span>
            </label>
            <input
              id="project_budget_hours"
              name="project_budget_hours"
              type="number"
              min="0"
              step="0.25"
              className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
              placeholder="120"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="figma_url"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Figma URL
              <span className="ml-1 text-zinc-400 dark:text-zinc-500">
                (optional)
              </span>
            </label>
            <input
              id="figma_url"
              name="figma_url"
              type="url"
              className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
              placeholder="https://figma.com/file/..."
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="webflow_url"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Webflow URL
              <span className="ml-1 text-zinc-400 dark:text-zinc-500">
                (optional)
              </span>
            </label>
            <input
              id="webflow_url"
              name="webflow_url"
              type="url"
              className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
              placeholder="https://webflow.com/..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="cursor-pointer rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Create Project
            </button>
            <Link
              href="/projects"
              className="cursor-pointer rounded-full border border-zinc-200 px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
