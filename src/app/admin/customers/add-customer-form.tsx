"use client";

import { useActionState } from "react";
import { createCustomer } from "../actions";

type CustomerState = { error?: string; success?: boolean } | null;

function createCustomerAction(_prev: CustomerState, formData: FormData) {
  return createCustomer(formData);
}

export function AddCustomerForm() {
  const [state, action, pending] = useActionState(createCustomerAction, null);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="customer-name"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Company name
        </label>
        <input
          id="customer-name"
          name="name"
          type="text"
          required
          placeholder="Acme AB"
          className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="customer-fortnox-id"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Fortnox ID
        </label>
        <input
          id="customer-fortnox-id"
          name="fortnox_id"
          type="text"
          placeholder="123"
          className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="cursor-pointer rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 sm:col-span-2 sm:justify-self-start"
      >
        {pending ? "Adding..." : "Add Customer"}
      </button>
      {state?.error && !pending && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      {state?.success && !pending && (
        <p className="text-sm text-green-600 dark:text-green-400">Added!</p>
      )}
    </form>
  );
}
