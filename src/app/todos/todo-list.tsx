"use client";

import { useState, useOptimistic, useTransition } from "react";
import {
  addTodoItem,
  toggleTodoItem,
  deleteTodoItem,
  assignTodoItem,
  assignTodoCustomer,
} from "./actions";

type TodoItem = {
  id: string;
  label: string;
  checked: boolean;
  assigned_to: string | null;
  customer_id: string | null;
  user_id: string;
  position: number;
  sharer_name?: string;
  customer_name?: string | null;
};

type UserOption = {
  id: string;
  displayName: string;
};

type CustomerOption = {
  id: string;
  name: string;
};

type OptimisticAction =
  | { type: "toggle"; id: string; checked: boolean }
  | { type: "assign"; id: string; assigned_to: string | null }
  | { type: "assign_customer"; id: string; customer_id: string | null; customer_name: string | null }
  | { type: "delete"; id: string }
  | { type: "add"; item: TodoItem };

function todoReducer(
  state: TodoItem[],
  action: OptimisticAction
): TodoItem[] {
  switch (action.type) {
    case "toggle":
      return state.map((i) =>
        i.id === action.id ? { ...i, checked: action.checked } : i
      );
    case "assign":
      return state.map((i) =>
        i.id === action.id ? { ...i, assigned_to: action.assigned_to } : i
      );
    case "assign_customer":
      return state.map((i) =>
        i.id === action.id
          ? {
              ...i,
              customer_id: action.customer_id,
              customer_name: action.customer_name,
            }
          : i
      );
    case "delete":
      return state.filter((i) => i.id !== action.id);
    case "add":
      return [...state, action.item];
  }
}

export function TodoList({
  myItems,
  sharedWithMe,
  currentUserId,
  users,
  customers,
}: {
  myItems: TodoItem[];
  sharedWithMe: TodoItem[];
  currentUserId: string;
  users: UserOption[];
  customers: CustomerOption[];
}) {
  const [optimisticMy, dispatchMy] = useOptimistic(myItems, todoReducer);
  const [optimisticShared, dispatchShared] = useOptimistic(
    sharedWithMe,
    todoReducer
  );

  const myTotal = optimisticMy.length;
  const myDone = optimisticMy.filter((i) => i.checked).length;
  const sharedTotal = optimisticShared.length;
  const sharedDone = optimisticShared.filter((i) => i.checked).length;

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
            My Items
          </h3>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {myDone}/{myTotal} complete
          </span>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {optimisticMy
            .sort((a, b) => a.position - b.position)
            .map((item) => (
              <MyTodoRow
                key={item.id}
                item={item}
                users={users}
                customers={customers}
                dispatch={dispatchMy}
              />
            ))}
        </div>

        {optimisticMy.length === 0 && (
          <p className="py-4 text-center text-sm text-zinc-400 dark:text-zinc-500">
            No items yet. Add one below.
          </p>
        )}

        <AddItemForm currentUserId={currentUserId} dispatch={dispatchMy} />
      </div>

      {(optimisticShared.length > 0 || sharedWithMe.length > 0) && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
              Shared with me
            </h3>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {sharedDone}/{sharedTotal} complete
            </span>
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {optimisticShared
              .sort((a, b) => a.position - b.position)
              .map((item) => (
                <SharedTodoRow
                  key={item.id}
                  item={item}
                  dispatch={dispatchShared}
                />
              ))}
          </div>

          {optimisticShared.length === 0 && (
            <p className="py-4 text-center text-sm text-zinc-400 dark:text-zinc-500">
              No shared items.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MyTodoRow({
  item,
  users,
  customers,
  dispatch,
}: {
  item: TodoItem;
  users: UserOption[];
  customers: CustomerOption[];
  dispatch: (action: OptimisticAction) => void;
}) {
  const [, startTransition] = useTransition();

  function handleToggle() {
    const newChecked = !item.checked;
    startTransition(async () => {
      dispatch({ type: "toggle", id: item.id, checked: newChecked });
      await toggleTodoItem(item.id, newChecked);
    });
  }

  function handleAssign(assignedTo: string | null) {
    startTransition(async () => {
      dispatch({ type: "assign", id: item.id, assigned_to: assignedTo });
      await assignTodoItem(item.id, assignedTo);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      dispatch({ type: "delete", id: item.id });
      await deleteTodoItem(item.id);
    });
  }

  function handleCustomerAssign(customerId: string | null) {
    const customerName = customerId
      ? customers.find((c) => c.id === customerId)?.name ?? null
      : null;

    startTransition(async () => {
      dispatch({
        type: "assign_customer",
        id: item.id,
        customer_id: customerId,
        customer_name: customerName,
      });
      await assignTodoCustomer(item.id, customerId);
    });
  }

  return (
    <div className="flex items-center gap-3 py-2.5">
      <input
        type="checkbox"
        checked={item.checked}
        onChange={handleToggle}
        className="h-4 w-4 shrink-0 cursor-pointer rounded border-zinc-300 accent-zinc-900 dark:border-zinc-600 dark:accent-zinc-100"
      />

      <span
        className={`min-w-0 flex-1 text-sm ${
          item.checked
            ? "text-zinc-400 line-through dark:text-zinc-500"
            : "text-zinc-900 dark:text-zinc-100"
        }`}
      >
        {item.label}
      </span>

      <select
        value={item.customer_id ?? ""}
        onChange={(e) => handleCustomerAssign(e.target.value || null)}
        className="w-36 shrink-0 cursor-pointer rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
      >
        <option value="">No customer</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <select
        value={item.assigned_to ?? ""}
        onChange={(e) => handleAssign(e.target.value || null)}
        className="w-28 shrink-0 cursor-pointer rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
      >
        <option value="">Unassigned</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.displayName}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={handleDelete}
        className="shrink-0 cursor-pointer text-xs text-red-500 transition-colors hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
      >
        Delete
      </button>

      {item.customer_name && (
        <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {item.customer_name}
        </span>
      )}
    </div>
  );
}

function SharedTodoRow({
  item,
  dispatch,
}: {
  item: TodoItem;
  dispatch: (action: OptimisticAction) => void;
}) {
  const [, startTransition] = useTransition();

  function handleToggle() {
    const newChecked = !item.checked;
    startTransition(async () => {
      dispatch({ type: "toggle", id: item.id, checked: newChecked });
      await toggleTodoItem(item.id, newChecked);
    });
  }

  return (
    <div className="flex items-center gap-3 py-2.5">
      <input
        type="checkbox"
        checked={item.checked}
        onChange={handleToggle}
        className="h-4 w-4 shrink-0 cursor-pointer rounded border-zinc-300 accent-zinc-900 dark:border-zinc-600 dark:accent-zinc-100"
      />

      <span
        className={`min-w-0 flex-1 text-sm ${
          item.checked
            ? "text-zinc-400 line-through dark:text-zinc-500"
            : "text-zinc-900 dark:text-zinc-100"
        }`}
      >
        {item.label}
      </span>

      {item.customer_name && (
        <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {item.customer_name}
        </span>
      )}

      <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        Shared by {item.sharer_name}
      </span>
    </div>
  );
}

function AddItemForm({
  currentUserId,
  dispatch,
}: {
  currentUserId: string;
  dispatch: (action: OptimisticAction) => void;
}) {
  const [, startTransition] = useTransition();
  const [label, setLabel] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;

    const tempId = `temp-${Date.now()}`;
    const trimmedLabel = label.trim();

    const formData = new FormData();
    formData.set("label", trimmedLabel);

    setLabel("");

    startTransition(async () => {
      dispatch({
        type: "add",
        item: {
          id: tempId,
          label: trimmedLabel,
          checked: false,
          assigned_to: null,
          customer_id: null,
          user_id: currentUserId,
          position: 9999,
        },
      });
      await addTodoItem(formData);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Add item..."
        className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
      />
      <button
        type="submit"
        disabled={!label.trim()}
        className="cursor-pointer rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Add
      </button>
    </form>
  );
}
