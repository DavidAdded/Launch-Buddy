"use client";

import { useState, useTransition } from "react";
import { updateProject } from "../actions";

type Project = {
  id: string;
  name: string;
  staging_url: string | null;
  prod_url: string | null;
  figma_url: string | null;
  webflow_url: string | null;
  is_public: boolean;
  user_id: string;
  created_at: string;
};

export function ProjectSettings({
  project,
  isOwner,
}: {
  project: Project;
  isOwner: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(project.name);
  const [stagingUrl, setStagingUrl] = useState(project.staging_url ?? "");
  const [prodUrl, setProdUrl] = useState(project.prod_url ?? "");
  const [figmaUrl, setFigmaUrl] = useState(project.figma_url ?? "");
  const [webflowUrl, setWebflowUrl] = useState(project.webflow_url ?? "");
  const [isPublic, setIsPublic] = useState(project.is_public);

  function handleCancel() {
    setName(project.name);
    setStagingUrl(project.staging_url ?? "");
    setProdUrl(project.prod_url ?? "");
    setFigmaUrl(project.figma_url ?? "");
    setWebflowUrl(project.webflow_url ?? "");
    setIsPublic(project.is_public);
    setError(null);
    setEditing(false);
  }

  function handleSave() {
    const formData = new FormData();
    formData.set("name", name);
    formData.set("staging_url", stagingUrl);
    formData.set("prod_url", prodUrl);
    formData.set("figma_url", figmaUrl);
    formData.set("webflow_url", webflowUrl);
    formData.set("is_public", isPublic ? "true" : "false");

    startTransition(async () => {
      const result = await updateProject(project.id, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        setEditing(false);
      }
    });
  }

  function handleTogglePublic() {
    const newValue = !isPublic;
    setIsPublic(newValue);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("staging_url", stagingUrl);
    formData.set("prod_url", prodUrl);
    formData.set("figma_url", figmaUrl);
    formData.set("webflow_url", webflowUrl);
    formData.set("is_public", newValue ? "true" : "false");

    startTransition(async () => {
      const result = await updateProject(project.id, formData);
      if (result.error) {
        setIsPublic(!newValue);
        setError(result.error);
      }
    });
  }

  if (!editing) {
    return (
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              {project.name}
            </h2>
            <div className="mt-2 flex flex-col gap-1">
              {project.staging_url && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Staging:{" "}
                  <a
                    href={project.staging_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cursor-pointer underline transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    {project.staging_url}
                  </a>
                </p>
              )}
              {project.prod_url && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Production:{" "}
                  <a
                    href={project.prod_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cursor-pointer underline transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    {project.prod_url}
                  </a>
                </p>
              )}
              {project.figma_url && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Figma:{" "}
                  <a
                    href={project.figma_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cursor-pointer underline transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    {project.figma_url}
                  </a>
                </p>
              )}
              {project.webflow_url && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Webflow:{" "}
                  <a
                    href={project.webflow_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cursor-pointer underline transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    {project.webflow_url}
                  </a>
                </p>
              )}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Created {new Date(project.created_at).toLocaleDateString()}
              </p>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  isPublic
                    ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {isPublic ? "Public" : "Private"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOwner && (
              <button
                type="button"
                onClick={handleTogglePublic}
                disabled={isPending}
                className="cursor-pointer rounded-full border border-zinc-200 px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {isPublic ? "Make Private" : "Make Public"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="cursor-pointer rounded-full border border-zinc-200 px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Edit
            </button>
          </div>
        </div>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="edit-name"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Project Name
          </label>
          <input
            id="edit-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="edit-staging"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Staging URL
            </label>
            <input
              id="edit-staging"
              type="url"
              value={stagingUrl}
              onChange={(e) => setStagingUrl(e.target.value)}
              placeholder="https://staging.example.com"
              className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="edit-prod"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Production URL
            </label>
            <input
              id="edit-prod"
              type="url"
              value={prodUrl}
              onChange={(e) => setProdUrl(e.target.value)}
              placeholder="https://example.com"
              className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="edit-figma"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Figma URL
            </label>
            <input
              id="edit-figma"
              type="url"
              value={figmaUrl}
              onChange={(e) => setFigmaUrl(e.target.value)}
              placeholder="https://figma.com/file/..."
              className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="edit-webflow"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Webflow URL
            </label>
            <input
              id="edit-webflow"
              type="url"
              value={webflowUrl}
              onChange={(e) => setWebflowUrl(e.target.value)}
              placeholder="https://webflow.com/..."
              className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
            />
          </div>
        </div>

        {isOwner && (
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-zinc-300 accent-zinc-900 dark:border-zinc-600 dark:accent-zinc-100"
            />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              Public — all logged-in users can view and edit this project
            </span>
          </label>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !name.trim()}
            className="cursor-pointer rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {isPending ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className="cursor-pointer rounded-full border border-zinc-200 px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
