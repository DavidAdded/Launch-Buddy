"use client";

import { useState, useTransition } from "react";
import { deleteCustomer, updateCustomer } from "../actions";

export function CustomerRow({
  customer,
}: {
  customer: { id: string; name: string; fortnox_id: string | null };
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState(customer.name);
  const [fortnoxId, setFortnoxId] = useState(customer.fortnox_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (editing) {
    return (
      <div className="grid gap-3 px-6 py-4">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Company name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
          />
        </div>
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Fortnox ID
          </label>
          <input
            type="text"
            value={fortnoxId}
            onChange={(e) => setFortnoxId(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
          />
          {error && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const formData = new FormData();
                formData.set("name", name.trim());
                formData.set("fortnox_id", fortnoxId.trim());
                const result = await updateCustomer(customer.id, formData);
                if (result.error) {
                  setError(result.error);
                  return;
                }
                setEditing(false);
              });
            }}
            disabled={isPending}
            className="cursor-pointer rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {isPending ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => {
              setName(customer.name);
              setFortnoxId(customer.fortnox_id ?? "");
              setError(null);
              setEditing(false);
            }}
            disabled={isPending}
            className="cursor-pointer rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (deleting) {
    return (
      <div className="flex items-center justify-between gap-3 px-6 py-4">
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Delete <span className="font-medium">{customer.name}</span>?
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await deleteCustomer(customer.id);
                if (result.error) {
                  setError(result.error);
                  setDeleting(false);
                }
              });
            }}
            disabled={isPending}
            className="cursor-pointer rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            {isPending ? "Deleting..." : "Confirm"}
          </button>
          <button
            onClick={() => {
              setDeleting(false);
              setError(null);
            }}
            disabled={isPending}
            className="cursor-pointer rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 px-6 py-4">
      <div>
        <p className="font-medium text-zinc-900 dark:text-zinc-50">{customer.name}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Fortnox ID: {customer.fortnox_id || "-"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={() => setEditing(true)}
          className="cursor-pointer rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Edit
        </button>
        <button
          onClick={() => setDeleting(true)}
          className="cursor-pointer rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-500 transition-colors hover:border-red-200 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-red-800 dark:hover:text-red-400"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
