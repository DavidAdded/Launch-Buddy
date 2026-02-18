"use client";

import { useState, useOptimistic, useTransition } from "react";
import {
  toggleCheckItem,
  toggleIrrelevantItem,
  assignItem,
  deleteChecklistItem,
  addChecklistItem,
} from "../actions";
import { GROUP_ORDER } from "@/lib/checklist-defaults";

type ChecklistItem = {
  id: string;
  group_name: string;
  label: string;
  checked: boolean;
  irrelevant: boolean;
  assignee: string | null;
  position: number;
};

type Assignee = {
  id: string;
  displayName: string;
};

type OptimisticAction =
  | { type: "toggle_check"; id: string; checked: boolean }
  | { type: "toggle_irrelevant"; id: string; irrelevant: boolean }
  | { type: "assign"; id: string; assignee: string | null }
  | { type: "delete"; id: string }
  | { type: "add"; item: ChecklistItem };

function checklistReducer(
  state: ChecklistItem[],
  action: OptimisticAction
): ChecklistItem[] {
  switch (action.type) {
    case "toggle_check":
      return state.map((i) =>
        i.id === action.id ? { ...i, checked: action.checked } : i
      );
    case "toggle_irrelevant":
      return state.map((i) =>
        i.id === action.id ? { ...i, irrelevant: action.irrelevant } : i
      );
    case "assign":
      return state.map((i) =>
        i.id === action.id ? { ...i, assignee: action.assignee } : i
      );
    case "delete":
      return state.filter((i) => i.id !== action.id);
    case "add":
      return [...state, action.item];
  }
}

export function Checklist({
  items,
  projectId,
  isPublic,
  assignees,
}: {
  items: ChecklistItem[];
  projectId: string;
  isPublic: boolean;
  assignees: Assignee[];
}) {
  const [optimisticItems, addOptimistic] = useOptimistic(
    items,
    checklistReducer
  );

  const totalItems = optimisticItems.length;
  const doneItems = optimisticItems.filter(
    (i) => i.checked || i.irrelevant
  ).length;

  const grouped = GROUP_ORDER.reduce(
    (acc, group) => {
      acc[group] = optimisticItems
        .filter((i) => i.group_name === group)
        .sort((a, b) => a.position - b.position);
      return acc;
    },
    {} as Record<string, ChecklistItem[]>
  );

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
          Launch Checklist
        </h3>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {doneItems}/{totalItems} complete
        </span>
      </div>

      <div className="flex flex-col gap-8">
        {GROUP_ORDER.map((group) => {
          const groupItems = grouped[group] ?? [];
          const groupDone = groupItems.filter(
            (i) => i.checked || i.irrelevant
          ).length;

          return (
            <div key={group}>
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {group}
                </h4>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {groupDone}/{groupItems.length} done
                </span>
              </div>

              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {groupItems.map((item) => (
                  <ChecklistRow
                    key={item.id}
                    item={item}
                    projectId={projectId}
                    isPublic={isPublic}
                    assignees={assignees}
                    dispatch={addOptimistic}
                  />
                ))}
              </div>

              <AddItemForm
                groupName={group}
                projectId={projectId}
                dispatch={addOptimistic}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChecklistRow({
  item,
  projectId,
  isPublic,
  assignees,
  dispatch,
}: {
  item: ChecklistItem;
  projectId: string;
  isPublic: boolean;
  assignees: Assignee[];
  dispatch: (action: OptimisticAction) => void;
}) {
  const [, startTransition] = useTransition();
  const dimmed = item.irrelevant || item.checked;

  function handleToggleCheck() {
    const newChecked = !item.checked;
    startTransition(async () => {
      dispatch({ type: "toggle_check", id: item.id, checked: newChecked });
      await toggleCheckItem(item.id, newChecked, projectId);
    });
  }

  function handleAssign(assignee: string | null) {
    startTransition(async () => {
      dispatch({ type: "assign", id: item.id, assignee });
      await assignItem(item.id, assignee, projectId);
    });
  }

  function handleToggleIrrelevant() {
    const newIrrelevant = !item.irrelevant;
    startTransition(async () => {
      dispatch({
        type: "toggle_irrelevant",
        id: item.id,
        irrelevant: newIrrelevant,
      });
      await toggleIrrelevantItem(item.id, newIrrelevant, projectId);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      dispatch({ type: "delete", id: item.id });
      await deleteChecklistItem(item.id, projectId);
    });
  }

  return (
    <div className="flex items-center gap-3 py-2.5">
      <input
        type="checkbox"
        checked={item.checked}
        disabled={item.irrelevant}
        onChange={handleToggleCheck}
        className="h-4 w-4 shrink-0 cursor-pointer rounded border-zinc-300 accent-zinc-900 dark:border-zinc-600 dark:accent-zinc-100"
      />

      <span
        className={`min-w-0 flex-1 text-sm ${
          dimmed
            ? "text-zinc-400 line-through dark:text-zinc-500"
            : "text-zinc-900 dark:text-zinc-100"
        }`}
      >
        {item.label}
      </span>

      {isPublic && (
        <select
          value={item.assignee ?? ""}
          disabled={item.irrelevant}
          onChange={(e) => handleAssign(e.target.value || null)}
          className={`w-28 shrink-0 cursor-pointer rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-800 ${
            item.irrelevant
              ? "text-zinc-400 dark:text-zinc-500"
              : "text-zinc-700 dark:text-zinc-300"
          }`}
        >
          <option value="">Unassigned</option>
          {assignees.map((a) => (
            <option key={a.id} value={a.displayName}>
              {a.displayName}
            </option>
          ))}
        </select>
      )}

      <button
        type="button"
        onClick={handleToggleIrrelevant}
        className="shrink-0 cursor-pointer text-xs text-zinc-400 transition-colors hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
      >
        {item.irrelevant ? "Mark relevant" : "N/A"}
      </button>

      <button
        type="button"
        onClick={handleDelete}
        className="shrink-0 cursor-pointer text-xs text-red-500 transition-colors hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
      >
        Delete
      </button>
    </div>
  );
}

function AddItemForm({
  groupName,
  projectId,
  dispatch,
}: {
  groupName: string;
  projectId: string;
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
    formData.set("project_id", projectId);
    formData.set("group_name", groupName);
    formData.set("label", trimmedLabel);

    setLabel("");

    startTransition(async () => {
      dispatch({
        type: "add",
        item: {
          id: tempId,
          group_name: groupName,
          label: trimmedLabel,
          checked: false,
          irrelevant: false,
          assignee: null,
          position: 9999,
        },
      });
      await addChecklistItem(formData);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex gap-2">
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
