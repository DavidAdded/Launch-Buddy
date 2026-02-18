"use client";

import { useState, useTransition } from "react";
import { requestFootprint } from "../../actions";
import type { FootprintResponseV2, Source } from "@/lib/footprint-prompt";

type FootprintRequest = {
  id: string;
  model_name: string;
  company_name: string;
  status: string;
  error_message: string | null;
  parsed_response: FootprintResponseV2 | null;
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
            Browsing website and analyzing digital footprint...
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            This may take 30-60 seconds as the model browses the web.
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
        <div className="flex flex-col gap-6">
          <AuthorityBadge assessment={parsed.overall_authority_assessment} />

          <Section title="Known For">
            <div className="flex flex-col gap-3">
              {parsed.known_for.map((item) => (
                <div key={item.theme}>
                  <ConfidenceTag
                    label={item.theme}
                    confidence={item.confidence}
                  />
                  <SourceLinks sources={item.sources} />
                </div>
              ))}
            </div>
          </Section>

          <Section title="Industry">
            <p className="text-sm text-zinc-900 dark:text-zinc-100">
              {parsed.industry_context.primary}
            </p>
            {parsed.industry_context.secondary.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {parsed.industry_context.secondary.map((s) => (
                  <div key={s.label}>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {s.label}
                      </span>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">
                        {Math.round(s.confidence * 100)}%
                      </span>
                    </div>
                    <SourceLinks sources={s.sources} />
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Competitors">
            <div className="flex flex-col gap-3">
              {parsed.competitors.map((c) => (
                <div key={c.name}>
                  <ConfidenceTag
                    label={c.name}
                    confidence={c.confidence}
                  />
                  <SourceLinks sources={c.sources} />
                </div>
              ))}
            </div>
          </Section>

          <Section title="Partnerships & Associations">
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {parsed.partnerships_or_associations.map((a) => (
                <div key={a.entity} className="py-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-zinc-900 dark:text-zinc-100">
                        {a.entity}
                      </span>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        {a.type}
                      </span>
                    </div>
                    <ConfidenceBar confidence={a.confidence} />
                  </div>
                  <SourceLinks sources={a.sources} />
                </div>
              ))}
            </div>
          </Section>

          {parsed.common_criticisms.length > 0 && (
            <Section title="Common Criticisms">
              <div className="flex flex-col gap-3">
                {parsed.common_criticisms.map((c) => (
                  <div key={c.theme}>
                    <ConfidenceTag
                      label={c.theme}
                      confidence={c.confidence}
                      variant="warning"
                    />
                    <SourceLinks sources={c.sources} />
                  </div>
                ))}
              </div>
            </Section>
          )}

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

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h4 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {title}
      </h4>
      {children}
    </div>
  );
}

function AuthorityBadge({
  assessment,
}: {
  assessment: {
    strength: string;
    justification: string;
    sources: Source[];
  };
}) {
  const colors: Record<string, string> = {
    high: "bg-green-50 border-green-200 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-400",
    medium:
      "bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-400",
    low: "bg-red-50 border-red-200 text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-400",
  };

  return (
    <div
      className={`rounded-2xl border p-5 ${colors[assessment.strength] ?? colors.low}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-semibold">Authority:</span>
        <span className="rounded-full bg-white/50 px-2.5 py-0.5 text-xs font-bold uppercase dark:bg-black/20">
          {assessment.strength}
        </span>
      </div>
      <p className="text-sm">{assessment.justification}</p>
      <SourceLinks sources={assessment.sources} />
    </div>
  );
}

function ConfidenceTag({
  label,
  confidence,
  variant = "default",
}: {
  label: string;
  confidence: number;
  variant?: "default" | "warning";
}) {
  const opacity = Math.max(0.4, confidence);
  const bg =
    variant === "warning"
      ? "bg-amber-50 dark:bg-amber-950"
      : "bg-zinc-100 dark:bg-zinc-800";
  const text =
    variant === "warning"
      ? "text-amber-700 dark:text-amber-400"
      : "text-zinc-700 dark:text-zinc-300";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ${bg} ${text}`}
      style={{ opacity }}
    >
      {label}
      <span className="text-xs opacity-60">
        {Math.round(confidence * 100)}%
      </span>
    </span>
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
