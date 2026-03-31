"use client";

import { useState, useTransition, useMemo } from "react";
import {
  requestFootprint,
  generateFootprintNarrative,
  requestFootprintV2TemplateFill,
} from "../../actions";
import type {
  FootprintFullResponse,
  FootprintGroup,
  Source,
} from "@/lib/footprint-prompt";
import {
  FOOTPRINT_GROUPS,
  FOOTPRINT_TOTAL_GROUPS,
  FOOTPRINT_TOTAL_QUESTIONS,
} from "@/lib/footprint-prompt";
import {
  buildTreeFromGroups,
  parseFootprintHierarchyCsv,
  type FootprintTreeNode,
} from "@/lib/footprint-hierarchy";
import { FootprintSplitExplorer } from "./footprint-split-explorer";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Radar, Doughnut } from "react-chartjs-2";

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  ArcElement,
  Tooltip,
  Legend,
);

type FootprintRequest = {
  id: string;
  model_name: string;
  company_name: string;
  status: string;
  error_message: string | null;
  parsed_response:
    | (FootprintFullResponse & {
        narrative_report?: {
          content: string;
          model: string;
          generated_at: string;
          source_request_id: string;
        };
      })
    | null;
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
  const [isNarrativePending, startNarrativeTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [narrativeError, setNarrativeError] = useState<string | null>(null);
  const [narrativeReport, setNarrativeReport] = useState<string | null>(null);
  const [narrativeMeta, setNarrativeMeta] = useState<{
    sourceRequestId: string;
    model: string;
    generatedAt: string;
  } | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [customGroups, setCustomGroups] = useState<FootprintGroup[] | null>(
    null,
  );
  const [customTree, setCustomTree] = useState<FootprintTreeNode[] | null>(
    null,
  );
  const [csvWarnings, setCsvWarnings] = useState<string[]>([]);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [v2TemplateName, setV2TemplateName] = useState<string | null>(null);
  const [v2TemplateContent, setV2TemplateContent] = useState<string | null>(null);
  const [v2Error, setV2Error] = useState<string | null>(null);
  const [v2Warnings, setV2Warnings] = useState<string[]>([]);
  const [v2OutputFileName, setV2OutputFileName] = useState<string | null>(null);
  const [isV2Pending, startV2Transition] = useTransition();

  const latest = requests[selectedIndex] ?? null;
  const parsed = latest?.parsed_response ?? null;
  const persistedNarrative = parsed?.narrative_report ?? null;
  const effectiveNarrativeReport =
    narrativeReport ?? persistedNarrative?.content ?? null;
  const effectiveNarrativeMeta =
    narrativeMeta ??
    (persistedNarrative
      ? {
          sourceRequestId: persistedNarrative.source_request_id,
          model: persistedNarrative.model,
          generatedAt: persistedNarrative.generated_at,
        }
      : null);
  const hasNarrativeForSelected =
    Boolean(latest?.id) &&
    effectiveNarrativeMeta?.sourceRequestId === latest?.id &&
    Boolean(effectiveNarrativeReport);
  const configuredGroups = customGroups ?? FOOTPRINT_GROUPS;
  const configuredTree = customTree ?? buildTreeFromGroups(configuredGroups);
  const requestGroups = useMemo(() => {
    if (!parsed) {
      return configuredGroups;
    }

    if (parsed.group_meta && parsed.group_meta.length > 0) {
      return parsed.group_meta;
    }

    return inferGroupsFromParsed(parsed);
  }, [configuredGroups, parsed]);
  const requestTree = useMemo(() => {
    if (!parsed) {
      return configuredTree;
    }

    if (parsed.hierarchy_tree && parsed.hierarchy_tree.length > 0) {
      return parsed.hierarchy_tree;
    }

    return buildTreeFromGroups(requestGroups);
  }, [configuredTree, parsed, requestGroups]);

  const showPerceptionReport = false;
  const showFootprintCharts = false;

  function handleRequest() {
    setError(null);
    startTransition(async () => {
      const result = await requestFootprint(
        projectId,
        customGroups ?? FOOTPRINT_GROUPS,
        customTree ?? null,
      );
      if (result.error) {
        setError(result.error);
      }
    });
  }

  async function handleCsvUpload(file: File | null) {
    if (!file) {
      return;
    }

    const raw = await file.text();
    const parsedCsv = parseFootprintHierarchyCsv(raw);

    if (parsedCsv.groups.length === 0) {
      setError(parsedCsv.warnings[0] ?? "CSV could not be parsed.");
      return;
    }

    setError(null);
    setCustomGroups(parsedCsv.groups);
    setCustomTree(parsedCsv.tree);
    setCsvWarnings(parsedCsv.warnings);
    setCsvFileName(file.name);
  }

  async function handleV2TemplateUpload(file: File | null) {
    if (!file) {
      return;
    }

    const raw = await file.text();
    setV2Error(null);
    setV2Warnings([]);
    setV2OutputFileName(null);
    setV2TemplateName(file.name);
    setV2TemplateContent(raw);
  }

  function downloadCsvFile(fileName: string, content: string) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleFillV2Template() {
    if (!v2TemplateContent) {
      setV2Error("Upload a Digital Footprint v2 template CSV first.");
      return;
    }

    setV2Error(null);
    setV2Warnings([]);
    startV2Transition(async () => {
      const result = await requestFootprintV2TemplateFill(
        projectId,
        v2TemplateContent,
      );

      if (result.error || !result.outputCsv) {
        setV2OutputFileName(null);
        setV2Error(result.error ?? "Failed to fill v2 template.");
        return;
      }

      const outputName =
        result.fileName ??
        `${(companyName ?? "company").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-digital-footprint-v2.csv`;
      setV2OutputFileName(outputName);
      setV2Warnings(result.warnings ?? []);
      downloadCsvFile(outputName, result.outputCsv);
    });
  }

  function handleGenerateNarrative() {
    if (!latest?.id) {
      setNarrativeError("No analysis selected.");
      return;
    }

    setNarrativeError(null);
    startNarrativeTransition(async () => {
      const result = await generateFootprintNarrative(projectId, latest.id);
      if (result.error || !result.report) {
        setNarrativeReport(null);
        setNarrativeMeta(null);
        setNarrativeError(result.error ?? "Failed to generate report.");
        return;
      }

      setNarrativeReport(result.report);
      setNarrativeMeta({
        sourceRequestId: result.sourceRequestId ?? latest.id,
        model: result.model ?? "gpt-5.2",
        generatedAt: result.generatedAt ?? new Date().toISOString(),
      });
    });
  }

  return (
    <div>
      {error && (
        <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}

      {narrativeError && (
        <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {narrativeError}
        </p>
      )}

      {v2Error && (
        <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {v2Error}
        </p>
      )}

      <div className="mb-6">
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

        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
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

          <label className="inline-flex cursor-pointer items-center rounded-full border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
            Upload CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                void handleCsvUpload(file);
                event.target.value = "";
              }}
            />
          </label>

          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {csvFileName
              ? `${csvFileName} (${configuredGroups.length} categories)`
              : `No CSV uploaded · Default ${FOOTPRINT_TOTAL_QUESTIONS}-question model`}
          </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <label className="inline-flex cursor-pointer items-center rounded-full border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
              Upload v2 Template CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  void handleV2TemplateUpload(file);
                  event.target.value = "";
                }}
              />
            </label>

            <button
              type="button"
              onClick={handleFillV2Template}
              disabled={isV2Pending || !v2TemplateContent || !companyName || !prodUrl}
              className="cursor-pointer rounded-full bg-zinc-900 px-5 py-2.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {isV2Pending ? "Filling v2 CSV..." : "Fill v2 CSV with AI"}
            </button>

            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {v2TemplateName
                ? `Template: ${v2TemplateName}`
                : "No v2 template uploaded"}
            </span>

            {v2OutputFileName && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400">
                Downloaded: {v2OutputFileName}
              </span>
            )}
          </div>
        </div>

        {csvWarnings.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-600 dark:text-amber-400">
            {csvWarnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        )}

        {v2Warnings.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-600 dark:text-amber-400">
            {v2Warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        )}
      </div>

      {(!companyName || !prodUrl) && (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Set a{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Company Name
            </span>{" "}
            and{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Production URL
            </span>{" "}
            in project settings to enable footprint analysis.
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
            Browsing website and analyzing {FOOTPRINT_TOTAL_QUESTIONS} questions
            across {FOOTPRINT_TOTAL_GROUPS} categories...
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
              onClick={() => {
                setSelectedIndex(i);
                setNarrativeError(null);
              }}
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
        <div className="flex  flex-col gap-4">
          <FootprintSplitExplorer
            key={`${latest?.id ?? "no-request"}-${requestGroups.map((group) => group.id).join("|")}`}
            parsed={parsed}
            groupMeta={requestGroups}
            tree={requestTree}
          />

          {showPerceptionReport && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    AI Perception Report
                  </h4>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Send this full analysis back to OpenAI and generate a
                    leadership-ready synthesis of AI&apos;s current picture of
                    the brand.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateNarrative}
                  disabled={isNarrativePending}
                  className="cursor-pointer rounded-full bg-zinc-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  {isNarrativePending
                    ? "Generating report..."
                    : "Generate AI Perception Report"}
                </button>
              </div>

              {hasNarrativeForSelected && effectiveNarrativeReport && (
                <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-950">
                  <NarrativeReportView report={effectiveNarrativeReport} />
                  {effectiveNarrativeMeta && (
                    <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
                      Generated with {effectiveNarrativeMeta.model} at{" "}
                      {new Date(
                        effectiveNarrativeMeta.generatedAt,
                      ).toLocaleString()}{" "}
                      from request {effectiveNarrativeMeta.sourceRequestId}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {showFootprintCharts && (
            <FootprintCharts parsed={parsed} groupMeta={requestGroups} />
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

function inferGroupsFromParsed(
  parsed: FootprintFullResponse,
): FootprintGroup[] {
  return parsed.groups.map((group, index) => ({
    id: `group_${index + 1}`,
    title: `Category ${index + 1}`,
    emoji: "📌",
    questions: group.questions.map((question) => question.question),
  }));
}

const SOURCE_TYPE_COLORS: Record<Source["type"], string> = {
  company_site: "#3b82f6",
  press: "#8b5cf6",
  directory: "#f59e0b",
  review: "#10b981",
  social: "#ec4899",
  other: "#6b7280",
};

function FootprintCharts({
  parsed,
  groupMeta,
}: {
  parsed: FootprintFullResponse;
  groupMeta: FootprintGroup[];
}) {
  const { totalSources, radarData, doughnutData } = useMemo(() => {
    const counts: Record<Source["type"], number> = {
      company_site: 0,
      press: 0,
      directory: 0,
      review: 0,
      social: 0,
      other: 0,
    };

    let total = 0;
    for (const group of parsed.groups) {
      for (const q of group.questions) {
        for (const src of q.sources) {
          if (src.type in counts) {
            counts[src.type]++;
          } else {
            counts.other++;
          }
          total++;
        }
      }
    }

    const confidencePerGroup = parsed.groups.map((group, i) => {
      const avg =
        group.questions.length > 0
          ? group.questions.reduce((sum, q) => sum + q.confidence, 0) /
            group.questions.length
          : 0;
      return { label: groupMeta[i]?.title ?? `Group ${i + 1}`, avg };
    });

    const activeTypes = (Object.keys(counts) as Source["type"][]).filter(
      (t) => counts[t] > 0,
    );

    const radar = {
      labels: confidencePerGroup.map((g) => g.label),
      datasets: [
        {
          label: "Avg Confidence",
          data: confidencePerGroup.map((g) => Math.round(g.avg * 100)),
          backgroundColor: "rgba(113, 113, 122, 0.15)",
          borderColor: "rgba(113, 113, 122, 0.6)",
          borderWidth: 2,
          pointBackgroundColor: "rgba(113, 113, 122, 0.8)",
          pointRadius: 3,
        },
      ],
    };

    const doughnut = {
      labels: activeTypes.map((t) => sourceTypeLabels[t]),
      datasets: [
        {
          data: activeTypes.map((t) => counts[t]),
          backgroundColor: activeTypes.map((t) => SOURCE_TYPE_COLORS[t]),
          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    };

    return {
      sourceTypeCounts: counts,
      totalSources: total,
      radarData: radar,
      doughnutData: doughnut,
    };
  }, [groupMeta, parsed]);

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: { r: number } }) => `${ctx.parsed.r}%`,
        },
      },
    },
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: {
          stepSize: 20,
          display: false,
        },
        grid: {
          color: "rgba(113, 113, 122, 0.15)",
        },
        angleLines: {
          color: "rgba(113, 113, 122, 0.15)",
        },
        pointLabels: {
          font: { size: 10 },
          color: "rgba(113, 113, 122, 0.7)",
        },
      },
    },
  } as const;

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "60%",
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          boxWidth: 12,
          padding: 16,
          font: { size: 11 },
          color: "rgba(113, 113, 122, 0.7)",
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { label: string; parsed: number }) => {
            const pct =
              totalSources > 0
                ? Math.round((ctx.parsed / totalSources) * 100)
                : 0;
            return `${ctx.label}: ${ctx.parsed} (${pct}%)`;
          },
        },
      },
    },
  } as const;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h4 className="mb-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Confidence by Category
        </h4>
        <div className="relative h-64">
          <Radar data={radarData} options={radarOptions} />
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h4 className="mb-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Source Distribution
          <span className="ml-2 text-xs font-normal text-zinc-400 dark:text-zinc-500">
            {totalSources} total
          </span>
        </h4>
        <div className="relative h-64">
          <Doughnut data={doughnutData} options={doughnutOptions} />
        </div>
      </div>
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

type NarrativeSection = {
  title: string;
  evidenceNote: string | null;
  bullets: string[];
  numbered: string[];
  paragraphs: string[];
};

function NarrativeReportView({ report }: { report: string }) {
  const sections = useMemo(() => parseNarrativeReport(report), [report]);

  if (sections.length === 0) {
    return (
      <pre className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        {report}
      </pre>
    );
  }

  const executive = sections.find((section) =>
    /executive summary/i.test(section.title),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <h5 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Report navigation
        </h5>
        <div className="mt-3 flex flex-wrap gap-2">
          {sections.map((section) => (
            <a
              key={section.title}
              href={`#report-section-${slugify(section.title)}`}
              className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              {section.title}
            </a>
          ))}
        </div>
      </div>

      {executive && executive.bullets.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <h5 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Executive Summary Highlights
          </h5>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {executive.bullets.map((bullet, i) => (
              <div
                key={`${bullet}-${i}`}
                className="rounded-lg border border-zinc-100 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800/70 dark:text-zinc-300"
              >
                {bullet}
              </div>
            ))}
          </div>
        </div>
      )}

      {sections.map((section) => (
        <article
          key={section.title}
          id={`report-section-${slugify(section.title)}`}
          className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <h5 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {section.title}
          </h5>

          {section.evidenceNote && (
            <p className="mt-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
              {section.evidenceNote}
            </p>
          )}

          {section.paragraphs.map((paragraph, index) => (
            <p
              key={`${section.title}-p-${index}`}
              className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300"
            >
              {paragraph}
            </p>
          ))}

          {section.bullets.length > 0 && (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
              {section.bullets.map((bullet, index) => (
                <li key={`${section.title}-b-${index}`}>{bullet}</li>
              ))}
            </ul>
          )}

          {section.numbered.length > 0 && (
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
              {section.numbered.map((item, index) => (
                <li key={`${section.title}-n-${index}`}>{item}</li>
              ))}
            </ol>
          )}
        </article>
      ))}
    </div>
  );
}

function parseNarrativeReport(report: string): NarrativeSection[] {
  const normalized = report.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  const sections: NarrativeSection[] = [];
  let current: NarrativeSection | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^#{1,3}\s+/.test(line)) {
      if (current) sections.push(current);
      current = {
        title: line.replace(/^#{1,3}\s+/, "").trim(),
        evidenceNote: null,
        bullets: [],
        numbered: [],
        paragraphs: [],
      };
      continue;
    }

    if (!current) {
      current = {
        title: "Overview",
        evidenceNote: null,
        bullets: [],
        numbered: [],
        paragraphs: [],
      };
    }

    const evidenceMatch = line.match(
      /\*\*Evidence-strength note:\*\*\s*(.+)$/i,
    );
    if (evidenceMatch) {
      current.evidenceNote = evidenceMatch[1].trim();
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)/);
    if (bulletMatch) {
      current.bullets.push(stripMarkdown(bulletMatch[1]));
      continue;
    }

    const numberedMatch = line.match(/^\d+[\.)]\s+(.+)/);
    if (numberedMatch) {
      current.numbered.push(stripMarkdown(numberedMatch[1]));
      continue;
    }

    current.paragraphs.push(stripMarkdown(line));
  }

  if (current) sections.push(current);
  return sections;
}

function stripMarkdown(value: string) {
  return value
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .trim();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
