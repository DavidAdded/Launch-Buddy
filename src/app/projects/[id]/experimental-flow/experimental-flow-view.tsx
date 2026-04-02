"use client";

import { useMemo, useState, useTransition } from "react";
import {
  requestExperimentalFlowBaseRuns,
  requestExperimentalFlowSummaryRuns,
  requestExperimentalFlowFinalRuns,
} from "../../actions";

type ExperimentalRequest = {
  id: string;
  model_name: string;
  company_name: string;
  status: string;
  error_message: string | null;
  parsed_response: {
    experimental_flow?: {
      flow_id?: string;
      stage?: "base" | "summary" | "final";
      model?: string;
      run_label?: string;
      source_request_ids?: string[];
    };
    rows?: Array<{
      theme: string;
      question_id: string;
      question: string;
      answer: string;
      confidence: number;
      notes: string;
      sources: Array<{ title: string; url: string }>;
    }>;
  } | null;
  raw_response: unknown;
  created_at: string;
};

type StageKey = "base" | "summary" | "final";

const DEFAULT_EXPERIMENT_TEMPLATE = `theme,question_id,question,model,run_id,answer,sources,confidence,notes
Core Brand Image,Q1,What is Oatly in one clear sentence?,,,,,,
Core Brand Image,Q2,How is Oatly most commonly described as a brand?,,,,,,
Core Brand Image,Q3,What does Oatly stand for in the minds of people and AI systems?,,,,,,
Core Brand Image,Q4,What are the strongest recurring signals in Oatly's core brand image?,,,,,,
Associations & Positioning,Q5,Which ideas values or lifestyles are most associated with Oatly?,,,,,,
Associations & Positioning,Q6,How is Oatly positioned relative to dairy and other plant-based brands?,,,,,,
Associations & Positioning,Q7,Which consumer segments are most strongly associated with Oatly?,,,,,,
Associations & Positioning,Q8,What emotional or symbolic associations appear most often around Oatly?,,,,,,
Tone & Personality,Q9,How is Oatly's communication tone typically described?,,,,,,
Tone & Personality,Q10,Which personality traits are most frequently attributed to Oatly?,,,,,,
Tone & Personality,Q11,Where is Oatly's tone seen as distinctive versus polarizing?,,,,,,
Tensions & Criticism,Q12,What are the most common criticisms or skeptical claims about Oatly?,,,,,,
Tensions & Criticism,Q13,Which tensions or contradictions appear in how Oatly is described?,,,,,,
Tensions & Criticism,Q14,What perception risks are most likely to harm trust in Oatly?,,,,,,
Reasons to Choose / Avoid,Q15,What are the strongest reasons to choose Oatly?,,,,,,
Reasons to Choose / Avoid,Q16,What are the strongest reasons to avoid Oatly?,,,,,,
Reasons to Choose / Avoid,Q17,In which use-cases is Oatly typically recommended?,,,,,,
Reasons to Choose / Avoid,Q18,In which use-cases is Oatly typically not recommended?,,,,,,
Reasons to Choose / Avoid,Q19,How does AI frame trade-offs between Oatly and dairy milk?,,,,,,
Reasons to Choose / Avoid,Q20,How does AI frame trade-offs between Oatly and other plant-based alternatives?,,,,,,
Product Experience,Q21,How is Oatly described in taste and texture versus alternatives?,,,,,,
Product Experience,Q22,How is Oatly perceived for coffee use-cases specifically?,,,,,,
Product Experience,Q23,How is Oatly perceived for cooking and baking use-cases?,,,,,,
Product Experience,Q24,What product quality criticisms are repeated most often?,,,,,,
Health Framing,Q25,How is Oatly framed in health and nutrition discussions?,,,,,,
Health Framing,Q26,What health-related misconceptions about Oatly appear repeatedly?,,,,,,
Health Framing,Q27,How does AI describe sugar and ingredient concerns around Oatly?,,,,,,
Health Framing,Q28,How does AI compare Oatly to dairy on nutrition trade-offs?,,,,,,
Sustainability,Q29,How is Oatly's climate and sustainability story described by AI?,,,,,,
Sustainability,Q30,Which sustainability claims are most trusted versus challenged?,,,,,,
Sustainability,Q31,What sustainability controversies are most likely to be surfaced?,,,,,,
Sustainability,Q32,How does AI compare Oatly sustainability against competitors?,,,,,,
Market & Competition,Q33,How does AI position Oatly against direct oat milk competitors?,,,,,,
Market & Competition,Q34,What brand strengths does AI attribute to Oatly in competitive context?,,,,,,
Market & Competition,Q35,What competitive weaknesses does AI most often mention for Oatly?,,,,,,
Market & Competition,Q36,What strategic narrative would best strengthen Oatly's AI footprint now?,,,,,,
`;

export function ExperimentalFlowView({
  projectId,
  companyName,
  prodUrl,
  requests,
}: {
  projectId: string;
  companyName: string | null;
  prodUrl: string | null;
  requests: ExperimentalRequest[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState<string>("default-36-questions.csv");
  const [templateCsv, setTemplateCsv] = useState<string>(DEFAULT_EXPERIMENT_TEMPLATE);
  const [selectedStage, setSelectedStage] = useState<StageKey>("base");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [lastRunInfo, setLastRunInfo] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState<boolean>(false);

  const [isBasePending, startBaseTransition] = useTransition();
  const [isSummaryPending, startSummaryTransition] = useTransition();
  const [isFinalPending, startFinalTransition] = useTransition();

  const experimentalRuns = useMemo(
    () =>
      requests.filter((request) => {
        const meta = request.parsed_response?.experimental_flow;
        return meta?.flow_id === "experimental_flow_v1";
      }),
    [requests],
  );

  const grouped = useMemo(() => {
    const map: Record<StageKey, ExperimentalRequest[]> = {
      base: [],
      summary: [],
      final: [],
    };

    for (const request of experimentalRuns) {
      const stage = request.parsed_response?.experimental_flow?.stage;
      if (stage === "base" || stage === "summary" || stage === "final") {
        map[stage].push(request);
      }
    }

    return map;
  }, [experimentalRuns]);

  const selectedList = grouped[selectedStage];
  const selectedRequest =
    selectedList.find((request) => request.id === selectedRequestId) ??
    selectedList[0] ??
    null;

  async function handleTemplateUpload(file: File | null) {
    if (!file) return;
    const raw = await file.text();
    setTemplateCsv(raw);
    setTemplateName(file.name);
    setError(null);
  }

  function runBaseStage() {
    setError(null);
    startBaseTransition(async () => {
      const result = await requestExperimentalFlowBaseRuns(projectId, templateCsv, 10);
      if (result.error) {
        setError(result.error);
        setLastRunInfo(null);
        return;
      }
      setLastRunInfo(
        `Stage 1 completed: ${result.created ?? 0} created, ${result.failed ?? 0} failed, concurrency ${result.concurrency ?? "n/a"}.`,
      );
    });
  }

  function runSummaryStage() {
    setError(null);
    startSummaryTransition(async () => {
      const result = await requestExperimentalFlowSummaryRuns(projectId, templateCsv);
      if (result.error) {
        setError(result.error);
        setLastRunInfo(null);
        return;
      }
      setLastRunInfo(`Stage 2 completed: ${result.created ?? 0} summary runs created.`);
    });
  }

  function runFinalStage() {
    setError(null);
    startFinalTransition(async () => {
      const result = await requestExperimentalFlowFinalRuns(projectId, templateCsv);
      if (result.error) {
        setError(result.error);
        setLastRunInfo(null);
        return;
      }
      setLastRunInfo(`Stage 3 completed: ${result.created ?? 0} final runs created.`);
    });
  }

  return (
    <div className="space-y-5">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}

      {lastRunInfo && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          {lastRunInfo}
        </p>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Experimental flow
        </h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {companyName
            ? `Runs for ${companyName}`
            : "Set Company Name in project settings."}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center rounded-full border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
            Upload 36-question CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                void handleTemplateUpload(file);
                event.target.value = "";
              }}
            />
          </label>

          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Template: {templateName}
          </span>

          <button
            type="button"
            onClick={runBaseStage}
            disabled={isBasePending || !companyName || !prodUrl}
            className="cursor-pointer rounded-full bg-zinc-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {isBasePending ? "Running stage 1..." : "Stage 1: 10 runs/model"}
          </button>

          <button
            type="button"
            onClick={runSummaryStage}
            disabled={isSummaryPending || !companyName || !prodUrl}
            className="cursor-pointer rounded-full border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {isSummaryPending ? "Running stage 2..." : "Stage 2: summary runs"}
          </button>

          <button
            type="button"
            onClick={runFinalStage}
            disabled={isFinalPending || !companyName || !prodUrl}
            className="cursor-pointer rounded-full border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {isFinalPending ? "Running stage 3..." : "Stage 3: final consensus"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800">
          {([
            ["base", `Base runs (${grouped.base.length})`],
            ["summary", `Summary runs (${grouped.summary.length})`],
            ["final", `Final runs (${grouped.final.length})`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setSelectedStage(key);
                setSelectedRequestId(null);
              }}
              className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selectedStage === key
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[360px_1fr]">
          <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Clickable responses
            </p>
            <div className="max-h-[60vh] space-y-2 overflow-auto">
              {selectedList.length === 0 && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  No responses in this stage yet.
                </p>
              )}
              {selectedList.map((request) => {
                const label =
                  request.parsed_response?.experimental_flow?.run_label ??
                  `${request.model_name} ${new Date(request.created_at).toLocaleString()}`;

                return (
                  <button
                    key={request.id}
                    type="button"
                    onClick={() => setSelectedRequestId(request.id)}
                    className={`block w-full cursor-pointer rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                      selectedRequest?.id === request.id
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <div className="font-semibold">{label}</div>
                    <div className="opacity-80">{request.model_name}</div>
                    <div className="opacity-80">{request.status}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            {selectedRequest ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                    {selectedRequest.model_name}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                    {selectedRequest.parsed_response?.experimental_flow?.stage ?? "unknown"}
                  </span>
                  <span>{new Date(selectedRequest.created_at).toLocaleString()}</span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Parsed rows (column list)
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowRawJson((value) => !value)}
                      className="cursor-pointer rounded-full border border-zinc-300 px-3 py-1 text-[11px] font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      {showRawJson ? "Hide raw JSON" : "Show raw JSON"}
                    </button>
                  </div>

                  <div className="max-h-[70vh] overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <table className="min-w-full border-collapse text-xs">
                      <thead className="sticky top-0 bg-zinc-100 text-left dark:bg-zinc-800">
                        <tr>
                          <th className="px-2 py-2 font-semibold text-zinc-700 dark:text-zinc-200">Theme</th>
                          <th className="px-2 py-2 font-semibold text-zinc-700 dark:text-zinc-200">Question ID</th>
                          <th className="px-2 py-2 font-semibold text-zinc-700 dark:text-zinc-200">Question</th>
                          <th className="px-2 py-2 font-semibold text-zinc-700 dark:text-zinc-200">Answer</th>
                          <th className="px-2 py-2 font-semibold text-zinc-700 dark:text-zinc-200">Confidence</th>
                          <th className="px-2 py-2 font-semibold text-zinc-700 dark:text-zinc-200">Notes</th>
                          <th className="px-2 py-2 font-semibold text-zinc-700 dark:text-zinc-200">Sources</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedRequest.parsed_response?.rows ?? []).map((row, index) => (
                          <tr
                            key={`${row.question_id}-${index}`}
                            className="border-t border-zinc-200 align-top dark:border-zinc-800"
                          >
                            <td className="px-2 py-2 text-zinc-700 dark:text-zinc-300">{row.theme}</td>
                            <td className="px-2 py-2 text-zinc-700 dark:text-zinc-300">{row.question_id}</td>
                            <td className="px-2 py-2 text-zinc-700 dark:text-zinc-300">{row.question}</td>
                            <td className="px-2 py-2 text-zinc-700 dark:text-zinc-300">{row.answer}</td>
                            <td className="px-2 py-2 text-zinc-700 dark:text-zinc-300">{row.confidence}</td>
                            <td className="px-2 py-2 text-zinc-700 dark:text-zinc-300">{row.notes}</td>
                            <td className="px-2 py-2 text-zinc-700 dark:text-zinc-300">
                              <div className="space-y-1">
                                {(row.sources ?? []).map((source, sourceIndex) => (
                                  <a
                                    key={`${source.url}-${sourceIndex}`}
                                    href={source.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block text-blue-600 underline dark:text-blue-400"
                                  >
                                    {source.title}
                                  </a>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {(selectedRequest.parsed_response?.rows ?? []).length === 0 && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      No parsed rows found for this response.
                    </p>
                  )}

                  {showRawJson && (
                    <pre className="max-h-[40vh] overflow-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-100">
                      {JSON.stringify(selectedRequest.raw_response, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Select a response on the left to inspect exact JSON data.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
