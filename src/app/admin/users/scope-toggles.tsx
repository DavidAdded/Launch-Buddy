"use client";

import { useTransition, useOptimistic } from "react";
import { toggleUserScope } from "../actions";

const ALL_SCOPES = [
  { key: "projects", label: "Projects" },
  { key: "fortnox", label: "Fortnox" },
] as const;

export function ScopeToggles({
  userId,
  scopes,
}: {
  userId: string;
  scopes: string[];
}) {
  return (
    <div className="flex items-center gap-3">
      {ALL_SCOPES.map((scope) => (
        <ScopeToggle
          key={scope.key}
          userId={userId}
          scopeKey={scope.key}
          label={scope.label}
          enabled={scopes.includes(scope.key)}
        />
      ))}
    </div>
  );
}

function ScopeToggle({
  userId,
  scopeKey,
  label,
  enabled,
}: {
  userId: string;
  scopeKey: string;
  label: string;
  enabled: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [optimisticEnabled, setOptimisticEnabled] = useOptimistic(enabled);

  return (
    <button
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          setOptimisticEnabled(!optimisticEnabled);
          await toggleUserScope(userId, scopeKey, !optimisticEnabled);
        });
      }}
      className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
        optimisticEnabled
          ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-950 dark:text-green-400 dark:hover:bg-green-900"
          : "border-zinc-200 bg-zinc-50 text-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500 dark:hover:bg-zinc-700"
      }`}
    >
      {label}
    </button>
  );
}
