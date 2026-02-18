"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { insertFileRecord } from "../actions";

export function FileUpload({
  projectId,
  userId,
}: {
  projectId: string;
  userId: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const supabase = createClient();
    const filePath = `${userId}/${projectId}/${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("project-files")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const result = await insertFileRecord({
      projectId,
      fileName: file.name,
      filePath,
      fileSize: file.size,
      contentType: file.type || "application/octet-stream",
    });

    if (result.error) {
      setError(result.error);
    }

    setUploading(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <div>
      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}
      <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-zinc-300 px-4 py-6 transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleUpload}
          disabled={uploading}
        />
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {uploading ? "Uploading..." : "Click to upload a file"}
        </span>
      </label>
    </div>
  );
}
