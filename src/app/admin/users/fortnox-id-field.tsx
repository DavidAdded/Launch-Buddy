"use client";

import { useState, useTransition } from "react";
import { updateUserFortnoxId } from "../actions";

export function FortnoxIdField({
  userId,
  fortnoxId: initial,
}: {
  userId: string;
  fortnoxId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    if (value === initial) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const result = await updateUserFortnoxId(userId, value);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        setEditing(false);
      }
    });
  }

  function handleCancel() {
    setValue(initial);
    setError(null);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="cursor-pointer rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
        title={initial ? `Fortnox ID: ${initial}` : "Set Fortnox ID"}
      >
        {initial ? `FNX: ${initial}` : "Fortnox ID"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") handleCancel();
        }}
        autoFocus
        placeholder="Fortnox ID"
        className="w-24 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="cursor-pointer rounded-full bg-zinc-900 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {isPending ? "..." : "Save"}
      </button>
      <button
        type="button"
        onClick={handleCancel}
        disabled={isPending}
        className="cursor-pointer rounded-full border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        X
      </button>
      {error && (
        <span className="text-xs text-red-500">{error}</span>
      )}
    </div>
  );
}
