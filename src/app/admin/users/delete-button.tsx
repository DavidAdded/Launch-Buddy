"use client";

import { useState, useTransition } from "react";
import { deleteUser } from "../actions";

export function DeleteUserButton({ userId, isSelf }: { userId: string; isSelf: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (isSelf) return null;

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        {error && (
          <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
        )}
        <button
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await deleteUser(userId);
              if (result.error) {
                setError(result.error);
                setConfirming(false);
              }
            });
          }}
          disabled={isPending}
          className="cursor-pointer rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
        >
          {isPending ? "Deleting..." : "Confirm"}
        </button>
        <button
          onClick={() => { setConfirming(false); setError(null); }}
          disabled={isPending}
          className="cursor-pointer rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="cursor-pointer rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-500 transition-colors hover:border-red-200 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-red-800 dark:hover:text-red-400"
    >
      Delete
    </button>
  );
}
