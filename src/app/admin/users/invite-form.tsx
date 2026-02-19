"use client";

import { useActionState } from "react";
import { inviteUser } from "../actions";

type InviteState = { error?: string; success?: boolean } | null;

function inviteAction(_prev: InviteState, formData: FormData) {
  return inviteUser(formData);
}

export function InviteUserForm() {
  const [state, action, pending] = useActionState(inviteAction, null);

  return (
    <form action={action} className="flex items-end gap-3">
      <div className="flex flex-1 flex-col gap-1.5">
        <label
          htmlFor="invite-email"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Email address
        </label>
        <input
          id="invite-email"
          name="email"
          type="email"
          required
          placeholder="user@example.com"
          className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="cursor-pointer rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Sending..." : "Send Invite"}
      </button>
      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-sm text-green-600 dark:text-green-400">
          Invite sent!
        </p>
      )}
    </form>
  );
}
