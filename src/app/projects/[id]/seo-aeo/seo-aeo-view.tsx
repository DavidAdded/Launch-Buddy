"use client";

import { useMemo, useState, useTransition } from "react";
import { analyzeSeoAeoPage } from "../../actions";
import type { SeoAeoAnalysisResult } from "@/lib/seo-aeo-analyzer";

export function SeoAeoView({
  projectId,
  defaultUrl,
}: {
  projectId: string;
  defaultUrl: string | null;
}) {
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SeoAeoAnalysisResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const groupedMetrics = useMemo(() => {
    if (!result) {
      return {
        seo: [] as SeoAeoAnalysisResult["metrics"],
        aeo: [] as SeoAeoAnalysisResult["metrics"],
      };
    }

    return {
      seo: result.metrics.filter((metric) => metric.category === "seo"),
      aeo: result.metrics.filter((metric) => metric.category === "aeo"),
    };
  }, [result]);

  function handleAnalyze() {
    setError(null);

    startTransition(async () => {
      const response = await analyzeSeoAeoPage(projectId, url);
      if (response.error || !response.result) {
        setResult(null);
        setError(response.error ?? "Analysis failed");
        return;
      }

      setResult(response.result);
      setError(null);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          SEO & AEO Analyzer
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Scrape a live URL and score technical SEO + answer engine readiness.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com"
            className="flex-1 rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
          />
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={isPending || !url.trim()}
            className="cursor-pointer rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {isPending ? "Analyzing..." : "Analyze Page"}
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
            {error}
          </p>
        )}
      </div>

      {isPending && !result && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-600 dark:border-zinc-700 dark:border-t-zinc-300" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Scraping page HTML, evaluating SEO signals, and scoring AEO readiness...
          </p>
        </div>
      )}

      {result && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <ScoreCard label="Total" score={result.totalScore} />
            <ScoreCard label="SEO" score={result.seoScore} />
            <ScoreCard label="AEO" score={result.aeoScore} />
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Snapshot
            </h3>
            <p className="mt-2 break-all text-xs text-zinc-500 dark:text-zinc-400">
              URL: {result.url}
            </p>
            <div className="mt-3 grid gap-2 text-xs text-zinc-600 dark:text-zinc-300 sm:grid-cols-2 lg:grid-cols-3">
              <Fact label="H1 Count" value={String(result.facts.h1Count)} />
              <Fact
                label="Headings"
                value={String(result.facts.headingCount)}
              />
              <Fact
                label="Word Count"
                value={String(result.facts.wordCount)}
              />
              <Fact
                label="Internal Links"
                value={String(result.facts.internalLinks)}
              />
              <Fact
                label="External Links"
                value={String(result.facts.externalLinks)}
              />
              <Fact
                label="Structured Data"
                value={result.facts.hasAnySchema ? "Yes" : "No"}
              />
            </div>
          </div>

          <MetricGroup title="SEO Metrics" metrics={groupedMetrics.seo} />
          <MetricGroup title="AEO Metrics" metrics={groupedMetrics.aeo} />

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Priority Recommendations
            </h3>
            {result.recommendations.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                No critical gaps found.
              </p>
            ) : (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-600 dark:text-zinc-300">
                {result.recommendations.map((recommendation) => (
                  <li key={recommendation}>{recommendation}</li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ScoreCard({ label, score }: { label: string; score: number }) {
  const tone =
    score >= 85
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
      : score >= 70
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
        : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300";

  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{score}</p>
      <p className="text-xs">/ 100</p>
    </div>
  );
}

function MetricGroup({
  title,
  metrics,
}: {
  title: string;
  metrics: SeoAeoAnalysisResult["metrics"];
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{title}</h3>
      <div className="mt-3 flex flex-col gap-3">
        {metrics.map((metric) => {
          const pct = Math.round((metric.score / metric.maxScore) * 100);
          return (
            <div key={metric.key} className="rounded-xl border border-zinc-100 p-3 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {metric.label}
                </p>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {metric.score.toFixed(1)} / {metric.maxScore}
                </p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-zinc-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                {metric.details}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
      <p className="text-[11px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
        {value}
      </p>
    </div>
  );
}
