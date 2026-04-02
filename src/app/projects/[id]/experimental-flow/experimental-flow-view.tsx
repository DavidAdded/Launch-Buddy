"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
      progress?: {
        completed_questions?: number;
        total_questions?: number;
      };
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
core_brand_image,Q01,How would you describe Oatly as a company to someone who has never heard of it?,,,,,,
core_brand_image,Q02,What are the most defining characteristics of Oatly as a brand?,,,,,,
core_brand_image,Q03,"If you had to summarize Oatly in one short paragraph, what would you emphasize?",,,,,,
core_brand_image,Q04,What overall impression does Oatly leave as a brand?,,,,,,
core_brand_image,Q05,How would you describe Oatly in simple terms?,,,,,,
core_brand_image,Q06,What kind of company does Oatly come across as?,,,,,,
core_brand_image,Q07,"If someone asked what Oatly is really known for, what would you say?",,,,,,
associations_positioning,Q08,What values are most strongly associated with Oatly?,,,,,,
associations_positioning,Q09,What ideas are most strongly associated with Oatly?,,,,,,
associations_positioning,Q10,What themes are most strongly associated with Oatly?,,,,,,
associations_positioning,Q11,What makes Oatly distinct from other plant-based food and drink brands?,,,,,,
associations_positioning,Q12,"Does Oatly come across more as a food company, a lifestyle brand, a mission-driven company, or something else?",,,,,,
associations_positioning,Q13,What kind of consumer is Oatly most commonly associated with?,,,,,,
associations_positioning,Q14,What kind of audience is Oatly most commonly associated with?,,,,,,
associations_positioning,Q15,What role does Oatly seem to play in culture or public conversation beyond just being a food or drink brand?,,,,,,
tone_personality,Q16,How would you characterize Oatly’s tone?,,,,,,
tone_personality,Q17,How would you characterize Oatly’s personality?,,,,,,
tone_personality,Q18,How would you characterize Oatly’s communication style?,,,,,,
tone_personality,Q19,"Does Oatly come across as playful, provocative, progressive, commercial, premium, mainstream, or something else?",,,,,,
tone_personality,Q20,Does Oatly appear more like a challenger brand or an established brand today?,,,,,,
tone_personality,Q21,"If Oatly were a person, how would you describe its personality and public persona?",,,,,,
tone_personality,Q22,How does Oatly come across in the way it communicates?,,,,,,
tone_personality,Q23,What kind of personality does Oatly project?,,,,,,
tone_personality,Q24,"Does Oatly feel more playful, political, or commercial?",,,,,,
reasons_to_choose,Q25,Why might someone choose Oatly over dairy milk or other plant-based alternatives?,,,,,,
reasons_to_choose,Q26,What are the main benefits people might associate with drinking Oatly?,,,,,,
reasons_to_choose,Q27,For what kind of person does Oatly seem like a strong fit?,,,,,,
reasons_to_choose,Q28,For what kind of preference does Oatly seem like a strong fit?,,,,,,
reasons_to_choose,Q29,For what kind of need does Oatly seem like a strong fit?,,,,,,
reasons_to_choose,Q30,What product qualities make Oatly feel like an appealing choice?,,,,,,
reasons_to_choose,Q31,What brand associations make Oatly feel like an appealing choice?,,,,,,
reasons_to_choose,Q32,Why do people choose Oatly?,,,,,,
reasons_to_choose,Q33,What makes Oatly appealing to people?,,,,,,
reasons_to_choose,Q34,In what situations does Oatly seem like a strong choice?,,,,,,
reasons_to_choose,Q35,What practical reasons might make someone choose Oatly?,,,,,,
reasons_to_avoid,Q36,Why might someone choose not to drink Oatly?,,,,,,
reasons_to_avoid,Q37,What are the main concerns people might associate with drinking Oatly?,,,,,,
reasons_to_avoid,Q38,What are the main drawbacks people might associate with drinking Oatly?,,,,,,
reasons_to_avoid,Q39,In what situations might Oatly seem like a less convincing choice?,,,,,,
reasons_to_avoid,Q40,For what concerns might Oatly seem like a less convincing choice?,,,,,,
reasons_to_avoid,Q41,What product qualities might make someone skeptical of Oatly?,,,,,,
reasons_to_avoid,Q42,What claims or messages might make someone skeptical of Oatly?,,,,,,
reasons_to_avoid,Q43,What broader associations might make someone skeptical of Oatly as a brand?,,,,,,
reasons_to_avoid,Q44,Why do some people avoid Oatly?,,,,,,
reasons_to_avoid,Q45,What makes some people skeptical of Oatly?,,,,,,
reasons_to_avoid,Q46,In what situations might Oatly feel like the wrong choice?,,,,,,
criticism_tension,Q47,What criticisms are most commonly associated with Oatly?,,,,,,
criticism_tension,Q48,What controversies are most commonly associated with Oatly?,,,,,,
criticism_tension,Q49,What points of skepticism are most commonly associated with Oatly?,,,,,,
criticism_tension,Q50,What tensions appear in how Oatly is described?,,,,,,
criticism_tension,Q51,What contradictions appear in how Oatly is described?,,,,,,
criticism_tension,Q52,What might someone admire about Oatly?,,,,,,
criticism_tension,Q53,What might someone be skeptical of when it comes to Oatly?,,,,,,
criticism_tension,Q54,Where does Oatly’s brand image become complicated?,,,,,,
criticism_tension,Q55,Where does Oatly’s brand image become contested?,,,,,,
criticism_tension,Q56,Where does Oatly’s brand image become polarizing?,,,,,,
criticism_tension,Q57,What product-related criticisms are most associated with Oatly?,,,,,,
criticism_tension,Q58,What brand or communication-related criticisms are most associated with Oatly?,,,,,,
criticism_tension,Q59,What company-level or reputation-related criticisms are most associated with Oatly?,,,,,,
simplification_distortion,Q60,What is the most common simplified version of Oatly that an AI-generated answer might produce?,,,,,,
simplification_distortion,Q61,What aspects of Oatly are most likely to be overemphasized in a short AI-generated description?,,,,,,
simplification_distortion,Q62,What aspects of Oatly are most likely to be underemphasized in a short AI-generated description?,,,,,,
simplification_distortion,Q63,What nuance is often lost when Oatly is described briefly?,,,,,,
simplification_distortion,Q64,"If an AI system had to compress Oatly into a few familiar ideas, what would those ideas most likely be?",,,,,,
comparative_framing,Q65,"Compared with other plant-based brands, how does Oatly typically come across?",,,,,,
comparative_framing,Q66,What makes Oatly feel more distinctive than many other food and beverage brands?,,,,,,
comparative_framing,Q67,What makes Oatly feel more controversial than many other food and beverage brands?,,,,,,
comparative_framing,Q68,"Does Oatly seem more product-driven, values-driven, or marketing-driven?",,,,,,
meta_reflection,Q69,What is the easiest narrative about Oatly for an AI system to produce?,,,,,,
meta_reflection,Q70,What is the hardest part of Oatly to capture fairly in a short AI-generated answer?,,,,,,
meta_reflection,Q71,"If an AI-generated description of Oatly feels incomplete, what is it most likely missing?",,,,,,
meta_reflection,Q72,What is Oatly most likely to be reduced to in public digital discourse?,,,,,,
human_queries,Q73,Should I drink Oatly?,,,,,,
human_queries,Q74,Is Oatly healthy?,,,,,,
human_queries,Q75,Is Oatly bad for you?,,,,,,
human_queries,Q76,Is Oatly actually sustainable?,,,,,,
human_queries,Q77,Why do people like Oatly?,,,,,,
human_queries,Q78,Why do some people avoid Oatly?,,,,,,
human_queries,Q79,Is Oatly better than regular milk?,,,,,,
human_queries,Q80,Is Oatly better than other oat milk brands?,,,,,,
human_queries,Q81,Is Oatly the best oat milk for coffee?,,,,,,
human_queries,Q82,Why is Oatly controversial?,,,,,,
human_queries,Q83,Is Oatly overhyped?,,,,,,
human_queries,Q84,Why do some people trust Oatly and others don’t?,,,,,,
indirect_context,Q85,What’s the healthiest milk alternative?,,,,,,
indirect_context,Q86,Which milk alternative is generally considered best for people who want a healthier option?,,,,,,
indirect_context,Q87,What oat milk works best in coffee?,,,,,,
indirect_context,Q88,Which oat milk brand is best for coffee drinks like lattes and cappuccinos?,,,,,,
indirect_context,Q89,What brands are considered most sustainable in plant-based milk?,,,,,,
indirect_context,Q90,Which plant-based milk brands are most associated with sustainability?,,,,,,
indirect_context,Q91,Which oat milk brands are controversial?,,,,,,
indirect_context,Q92,What brands in the oat milk category tend to attract criticism or debate?,,,,,,
indirect_context,Q93,Which oat milk brands are most popular?,,,,,,
indirect_context,Q94,Which oat milk brands have the strongest cultural presence or brand recognition?,,,,,,
indirect_context,Q95,Which oat milk brands are most widely used in cafes?,,,,,,
indirect_context,Q96,What plant-based milk brands are most associated with barista culture or coffee shops?,,,,,,
indirect_context,Q97,Which plant-based milk brands feel the most values-driven?,,,,,,
indirect_context,Q98,Which food or drink brands in the plant-based space feel the most polarizing?,,,,,,
indirect_context,Q99,Which oat milk brands feel the most mainstream?,,,,,,
indirect_context,Q100,Which oat milk brands feel the most niche?,,,,,,
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
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState<string>("oatly-answer-template-v2.csv");
  const [templateCsv, setTemplateCsv] = useState<string>(DEFAULT_EXPERIMENT_TEMPLATE);
  const [flowName, setFlowName] = useState<string>("test");
  const [includeClaude, setIncludeClaude] = useState<boolean>(false);
  const [selectedStage, setSelectedStage] = useState<StageKey>("base");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [lastRunInfo, setLastRunInfo] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState<boolean>(false);

  const [isBasePending, startBaseTransition] = useTransition();
  const [isSummaryPending, startSummaryTransition] = useTransition();
  const [isFinalPending, startFinalTransition] = useTransition();

  useEffect(() => {
    const hasPendingRequests = requests.some((request) => request.status === "pending");
    if (!hasPendingRequests) {
      return;
    }

    const timer = window.setInterval(() => {
      router.refresh();
    }, 3000);

    return () => window.clearInterval(timer);
  }, [requests, router]);

  const normalizedFlowId = flowName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-") || "test";

  const experimentalRuns = useMemo(
    () =>
      requests.filter((request) => {
        const meta = request.parsed_response?.experimental_flow;
        return meta?.flow_id === normalizedFlowId;
      }),
    [requests, normalizedFlowId],
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

  const pendingBase = useMemo(
    () =>
      grouped.base.filter(
        (r) => r.status === "pending" && (r.parsed_response?.experimental_flow?.progress?.completed_questions ?? 0) < (r.parsed_response?.experimental_flow?.progress?.total_questions ?? 0),
      ),
    [grouped.base],
  );

  const pendingSummary = useMemo(
    () =>
      grouped.summary.filter(
        (r) => r.status === "pending" && (r.parsed_response?.experimental_flow?.progress?.completed_questions ?? 0) < (r.parsed_response?.experimental_flow?.progress?.total_questions ?? 0),
      ),
    [grouped.summary],
  );

  const pendingFinal = useMemo(
    () =>
      grouped.final.filter(
        (r) => r.status === "pending" && (r.parsed_response?.experimental_flow?.progress?.completed_questions ?? 0) < (r.parsed_response?.experimental_flow?.progress?.total_questions ?? 0),
      ),
    [grouped.final],
  );

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
      const result = await requestExperimentalFlowBaseRuns(
        projectId,
        templateCsv,
        normalizedFlowId,
        includeClaude,
      );
      if (result.error) {
        setError(result.error);
        setLastRunInfo(null);
        return;
      }
      const parts: string[] = [];
      if (result.created) parts.push(`${result.created} created`);
      if (result.resumed) parts.push(`${result.resumed} resumed`);
      if (result.failed) parts.push(`${result.failed} failed`);
      if (result.skipped) parts.push(`${result.skipped} skipped`);
      setLastRunInfo(`Stage 1: ${parts.join(", ") || "no changes"}.`);
    });
  }

  function runSummaryStage() {
    setError(null);
    startSummaryTransition(async () => {
      const result = await requestExperimentalFlowSummaryRuns(
        projectId,
        templateCsv,
        normalizedFlowId,
        includeClaude,
      );
      if (result.error) {
        setError(result.error);
        setLastRunInfo(null);
        return;
      }
      const parts: string[] = [];
      if (result.created) parts.push(`${result.created} created`);
      if (result.resumed) parts.push(`${result.resumed} resumed`);
      setLastRunInfo(`Stage 2: ${parts.join(", ") || "no changes"}.`);
    });
  }

  function runFinalStage() {
    setError(null);
    startFinalTransition(async () => {
      const result = await requestExperimentalFlowFinalRuns(
        projectId,
        templateCsv,
        normalizedFlowId,
        includeClaude,
      );
      if (result.error) {
        setError(result.error);
        setLastRunInfo(null);
        return;
      }
      const parts: string[] = [];
      if (result.created) parts.push(`${result.created} created`);
      if (result.resumed) parts.push(`${result.resumed} resumed`);
      setLastRunInfo(`Stage 3: ${parts.join(", ") || "no changes"}.`);
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
            Upload template CSV
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

          <label className="flex items-center gap-2 rounded-full border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
            Flow
            <input
              value={flowName}
              onChange={(event) => setFlowName(event.target.value)}
              className="w-40 bg-transparent outline-none"
              placeholder="default"
            />
          </label>

          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            flow_id: {normalizedFlowId}
          </span>

          <label className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={includeClaude}
              onChange={(event) => setIncludeClaude(event.target.checked)}
              className="h-3.5 w-3.5"
            />
            Include Claude
          </label>

          <button
            type="button"
            onClick={runBaseStage}
            disabled={isBasePending || !companyName || !prodUrl}
            className="cursor-pointer rounded-full bg-zinc-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {isBasePending
                ? "Running stage 1..."
                : pendingBase.length > 0
                  ? `Stage 1: Resume (${pendingBase.map((r) => `${r.parsed_response?.experimental_flow?.progress?.completed_questions ?? 0}/${r.parsed_response?.experimental_flow?.progress?.total_questions ?? 0}`).join(", ")})`
                  : "Stage 1: Run base"}
          </button>

          <button
            type="button"
            onClick={runSummaryStage}
            disabled={isSummaryPending || !companyName || !prodUrl}
            className="cursor-pointer rounded-full border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {isSummaryPending
                ? "Running stage 2..."
                : pendingSummary.length > 0
                  ? `Stage 2: Resume summary`
                  : "Stage 2: Summary"}
          </button>

          <button
            type="button"
            onClick={runFinalStage}
            disabled={isFinalPending || !companyName || !prodUrl}
            className="cursor-pointer rounded-full border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {isFinalPending
                ? "Running stage 3..."
                : pendingFinal.length > 0
                  ? `Stage 3: Resume final`
                  : "Stage 3: Final consensus"}
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
                    {request.parsed_response?.experimental_flow?.progress && (
                      <div className="opacity-80">
                        {request.parsed_response.experimental_flow.progress.completed_questions ?? 0}/
                        {request.parsed_response.experimental_flow.progress.total_questions ?? 0} questions
                      </div>
                    )}
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
