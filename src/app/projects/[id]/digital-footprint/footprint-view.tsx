"use client";

import { useState, useTransition } from "react";
import { requestFootprint } from "../../actions";
import type { FootprintFullResponse, Source } from "@/lib/footprint-prompt";
import { FOOTPRINT_GROUPS } from "@/lib/footprint-prompt";

type FootprintRequest = {
  id: string;
  model_name: string;
  company_name: string;
  status: string;
  error_message: string | null;
  parsed_response: FootprintFullResponse | null;
  created_at: string;
};

export function FootprintView({
  projectId,
  companyName,
  prodUrl,
  requests,
}: {
  projectId: string;
  companyName: string | null;
  prodUrl: string | null;
  requests: FootprintRequest[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const latest = requests[selectedIndex] ?? null;
  const parsed = latest?.parsed_response ?? null;

  function handleRequest() {
    setError(null);
    startTransition(async () => {
      const result = await requestFootprint(projectId);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  function toggleGroup(groupId: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  return (
    <div>
      {error && (
        <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
            Digital Footprint
          </h3>
          {companyName && (
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              Analysis for {companyName}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleRequest}
          disabled={isPending || !companyName || !prodUrl}
          className="cursor-pointer rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isPending
            ? "Analyzing..."
            : requests.length === 0
              ? "Request Analysis"
              : "Re-analyze"}
        </button>
      </div>

      {(!companyName || !prodUrl) && (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Set a{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Company Name
            </span>
            {" "}and{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Production URL
            </span>
            {" "}in project settings to enable footprint analysis.
          </p>
        </div>
      )}

      {companyName && prodUrl && requests.length === 0 && !isPending && (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No analysis yet. Click &ldquo;Request Analysis&rdquo; to generate a
            digital footprint report.
          </p>
        </div>
      )}

      {isPending && requests.length === 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-600 dark:border-zinc-700 dark:border-t-zinc-300" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Browsing website and analyzing 100 questions across 10 categories...
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            This may take 2-3 minutes as the model browses the web for each
            category.
          </p>
        </div>
      )}

      {requests.length > 1 && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            History:
          </span>
          {requests.map((req, i) => (
            <button
              key={req.id}
              type="button"
              onClick={() => setSelectedIndex(i)}
              className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                i === selectedIndex
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
            >
              {new Date(req.created_at).toLocaleDateString()}{" "}
              {new Date(req.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </button>
          ))}
        </div>
      )}

      {latest && latest.status === "error" && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950">
          <p className="text-sm font-medium text-red-700 dark:text-red-400">
            Analysis failed
          </p>
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {latest.error_message}
          </p>
        </div>
      )}

      {latest && latest.status === "pending" && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-600 dark:border-zinc-700 dark:border-t-zinc-300" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Analysis in progress...
          </p>
        </div>
      )}

      {parsed && (
        <div className="flex flex-col gap-4">
          {parsed.groups.map((group, groupIndex) => {
            const meta = FOOTPRINT_GROUPS[groupIndex];
            if (!meta) return null;
            const isOpen = openGroups.has(meta.id);
            const avgConfidence =
              group.questions.length > 0
                ? group.questions.reduce((sum, q) => sum + q.confidence, 0) /
                  group.questions.length
                : 0;

            return (
              <div
                key={meta.id}
                className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(meta.id)}
                  className="flex w-full cursor-pointer items-center justify-between px-5 py-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{meta.emoji}</span>
                    <div>
                      <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {meta.title}
                      </h4>
                      <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {group.summary}
                      </p>
                    </div>
                  </div>
                  <div className="ml-4 flex shrink-0 items-center gap-3">
                    <ConfidenceBar confidence={avgConfidence} />
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      {group.questions.length}q
                    </span>
                    <svg
                      className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </button>

                <div
                  className={`grid transition-[grid-template-rows] duration-200 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                >
                  <div className="overflow-hidden">
                    <div className="border-t border-zinc-100 px-5 pb-5 pt-4 dark:border-zinc-800">
                      <div className="flex flex-col gap-4">
                        {group.questions.map((q, qIndex) => (
                          <div key={qIndex} className="flex flex-col gap-1.5">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                                {qIndex + 1}. {q.question}
                              </p>
                              <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                                {Math.round(q.confidence * 100)}%
                              </span>
                            </div>
                            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                              {q.answer}
                            </p>
                            <SourceLinks sources={q.sources} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Analyzed by {latest.model_name} on{" "}
              {new Date(latest.created_at).toLocaleString()} for &ldquo;
              {latest.company_name}&rdquo;
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-zinc-400 dark:bg-zinc-500"
          style={{ width: `${confidence * 100}%` }}
        />
      </div>
      <span className="text-xs text-zinc-400 dark:text-zinc-500">
        {Math.round(confidence * 100)}%
      </span>
    </div>
  );
}

const sourceTypeLabels: Record<Source["type"], string> = {
  company_site: "Company",
  press: "Press",
  directory: "Directory",
  review: "Review",
  social: "Social",
  other: "Other",
};

function SourceLinks({ sources }: { sources: Source[] }) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
      {sources.map((src, i) => (
        <a
          key={`${src.url}-${i}`}
          href={src.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-600 underline decoration-blue-300 underline-offset-2 transition-colors hover:text-blue-800 dark:text-blue-400 dark:decoration-blue-700 dark:hover:text-blue-300"
          title={src.title}
        >
          <span className="rounded bg-zinc-100 px-1 py-0.5 text-[10px] font-medium text-zinc-500 no-underline dark:bg-zinc-800 dark:text-zinc-400">
            {sourceTypeLabels[src.type] ?? src.type}
          </span>
          <span className="max-w-[200px] truncate">{src.title}</span>
        </a>
      ))}
    </div>
  );
}
