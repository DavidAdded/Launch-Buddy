"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  FootprintFullResponse,
  FootprintGroup,
  GroupResponse,
  Source,
} from "@/lib/footprint-prompt";
import type { FootprintTreeNode } from "@/lib/footprint-hierarchy";
import { buildTreeFromGroups } from "@/lib/footprint-hierarchy";

type ExplorerSelection =
  | { kind: "category"; nodeId: string }
  | { kind: "question"; nodeId: string; groupId: string; question: string };

type AnswerTag =
  | "Core description"
  | "Brand attributes"
  | "Values/associations"
  | "Audience"
  | "Tone/personality"
  | "Positive arguments"
  | "Negative arguments"
  | "Criticisms/skepticism"
  | "Tensions/contradictions"
  | "Overemphasis"
  | "Underemphasis"
  | "Notable wording";

const ORIGIN_NODE_ID = "__origin__";
const ORIGIN_NODE_TITLE = "Oatly";
const PAGE_SIZE = 8;

const TAG_MATCHERS: Array<{ tag: AnswerTag; pattern: RegExp }> = [
  {
    tag: "Core description",
    pattern: /what is|described as|known for|core brand|stand for/i,
  },
  {
    tag: "Brand attributes",
    pattern: /innovative|premium|mainstream|quality|authentic/i,
  },
  {
    tag: "Values/associations",
    pattern: /values|lifestyle|sustainab|ethical|culture|symbolic/i,
  },
  { tag: "Audience", pattern: /consumer|audience|segment|buyers|people who/i },
  {
    tag: "Tone/personality",
    pattern: /tone|personality|voice|playful|provocative|bold/i,
  },
  {
    tag: "Positive arguments",
    pattern: /strength|benefit|advantage|recommended|choose/i,
  },
  {
    tag: "Negative arguments",
    pattern: /downside|avoid|drawback|concern|not recommended/i,
  },
  {
    tag: "Criticisms/skepticism",
    pattern: /critic|skeptic|backlash|doubt|questioned/i,
  },
  {
    tag: "Tensions/contradictions",
    pattern: /tension|contradiction|however|yet|trade-off/i,
  },
  {
    tag: "Overemphasis",
    pattern: /overhyped|too much focus|overemphasized/i,
  },
  {
    tag: "Underemphasis",
    pattern: /underreported|underemphasized|missing from narrative/i,
  },
  { tag: "Notable wording", pattern: /".+"|'.+'|framed as|wording/i },
];

export function FootprintSplitExplorer({
  parsed,
  groupMeta,
  tree,
}: {
  parsed: FootprintFullResponse;
  groupMeta: FootprintGroup[];
  tree?: FootprintTreeNode[] | null;
}) {
  const effectiveTree = useMemo(
    () => tree ?? buildTreeFromGroups(groupMeta),
    [tree, groupMeta],
  );

  const rootNode = useMemo<FootprintTreeNode>(
    () => ({
      id: ORIGIN_NODE_ID,
      title: ORIGIN_NODE_TITLE,
      kind: "category",
      level: -1,
      children: effectiveTree,
    }),
    [effectiveTree],
  );

  const [path, setPath] = useState<FootprintTreeNode[]>([rootNode]);
  const [page, setPage] = useState(0);
  const [selection, setSelection] = useState<ExplorerSelection>({
    kind: "category",
    nodeId: ORIGIN_NODE_ID,
  });

  useEffect(() => {
    setPath([rootNode]);
    setPage(0);
    setSelection({ kind: "category", nodeId: ORIGIN_NODE_ID });
  }, [rootNode]);

  const currentStep = path[path.length - 1] ?? rootNode;
  const currentNodes = currentStep.children;

  const totalPages = Math.max(1, Math.ceil(currentNodes.length / PAGE_SIZE));
  const boundedPage = Math.min(page, totalPages - 1);
  const visibleNodes = currentNodes.slice(
    boundedPage * PAGE_SIZE,
    boundedPage * PAGE_SIZE + PAGE_SIZE,
  );

  const breadcrumbs = useMemo(
    () => path.map((step) => ({ id: step.id, title: step.title })),
    [path],
  );

  const groupById = useMemo(() => {
    const map = new Map<string, GroupResponse>();
    groupMeta.forEach((group, index) => {
      const response = parsed.groups[index];
      if (!response) return;
      map.set(group.id, response);
    });
    return map;
  }, [groupMeta, parsed]);

  const groupTitlesById = useMemo(() => {
    const map = new Map<string, string>();
    groupMeta.forEach((group) => {
      map.set(group.id, `${group.emoji} ${group.title}`);
    });
    return map;
  }, [groupMeta]);

  const isOriginSelected =
    selection.kind === "category" && selection.nodeId === ORIGIN_NODE_ID;

  const selectedCategoryNode =
    selection.kind === "category" && !isOriginSelected
      ? findNodeById(effectiveTree, selection.nodeId)
      : null;

  const selectedQuestion =
    selection.kind === "question"
      ? findAnsweredQuestion(groupById.get(selection.groupId), selection.question)
      : null;

  function openNode(node: FootprintTreeNode) {
    if (node.kind === "question") {
      setSelection({
        kind: "question",
        nodeId: node.id,
        groupId: node.groupId ?? "",
        question: node.question ?? node.title,
      });
      return;
    }

    setPath((prev) => [...prev, node]);
    setSelection({ kind: "category", nodeId: node.id });
    setPage(0);
  }

  function stepBack() {
    if (path.length <= 1) {
      return;
    }

    setPath((prev) => {
      const next = prev.slice(0, -1);
      const nextTop = next[next.length - 1] ?? rootNode;
      setSelection({ kind: "category", nodeId: nextTop.id });
      setPage(0);
      return next;
    });
  }

  function jumpTo(index: number) {
    setPath((prev) => {
      const next = prev.slice(0, index + 1);
      const nextTop = next[next.length - 1] ?? rootNode;
      setSelection({ kind: "category", nodeId: nextTop.id });
      setPage(0);
      return next;
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <aside className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Footprint Navigator
            </h4>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Full-card drilldown. Click cards to go deeper, then use Back or breadcrumbs.
            </p>
          </div>

          <button
            type="button"
            onClick={stepBack}
            disabled={path.length <= 1}
            className="cursor-pointer rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Back
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {breadcrumbs.map((step, index, all) => {
            const isLast = index === all.length - 1;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => jumpTo(index)}
                disabled={isLast}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  isLast
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "cursor-pointer border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {step.title}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {visibleNodes.map((node) => {
            const isActive = selection.nodeId === node.id;
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => openNode(node)}
                className={`cursor-pointer rounded-2xl border p-4 text-left transition-all ${
                  node.kind === "question"
                    ? "border-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40"
                    : "border-blue-300 bg-blue-50 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:hover:bg-blue-900/40"
                } ${
                  isActive
                    ? "ring-2 ring-zinc-900 dark:ring-zinc-100"
                    : "ring-0"
                }`}
              >
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {node.title}
                </p>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                  {describeNode(node, groupById)}
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>
            Showing {visibleNodes.length} of {currentNodes.length} nodes
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(0, prev - 1))}
              disabled={boundedPage <= 0}
              className="rounded-full border border-zinc-200 px-2.5 py-1 font-medium disabled:opacity-40 dark:border-zinc-700"
            >
              Prev
            </button>
            <span>
              Page {boundedPage + 1}/{totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
              disabled={boundedPage >= totalPages - 1}
              className="rounded-full border border-zinc-200 px-2.5 py-1 font-medium disabled:opacity-40 dark:border-zinc-700"
            >
              Next
            </button>
          </div>
        </div>
      </aside>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        {isOriginSelected ? (
          <OriginSummary parsed={parsed} groupMeta={groupMeta} groupById={groupById} />
        ) : selection.kind === "question" && selectedQuestion ? (
          <QuestionDetail
            question={selectedQuestion.question}
            answer={selectedQuestion.answer}
            confidence={selectedQuestion.confidence}
            sources={selectedQuestion.sources}
            tags={extractTags(selectedQuestion.question, selectedQuestion.answer)}
          />
        ) : selectedCategoryNode ? (
          <CategorySummary
            node={selectedCategoryNode}
            groupById={groupById}
            groupTitlesById={groupTitlesById}
          />
        ) : (
          <EmptyDetailState />
        )}
      </section>
    </div>
  );
}

function OriginSummary({
  parsed,
  groupMeta,
  groupById,
}: {
  parsed: FootprintFullResponse;
  groupMeta: FootprintGroup[];
  groupById: Map<string, GroupResponse>;
}) {
  const availableGroups = groupMeta
    .map((group) => ({ group, response: groupById.get(group.id) }))
    .filter(
      (entry): entry is { group: FootprintGroup; response: GroupResponse } =>
        Boolean(entry.response),
    );

  const allQuestions = availableGroups.flatMap((entry) => entry.response.questions);
  const avgConfidence =
    allQuestions.length > 0
      ? allQuestions.reduce((sum, question) => sum + question.confidence, 0) /
        allQuestions.length
      : 0;

  const aiOriginSummary = parsed.origin_summary ?? null;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h4 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          {ORIGIN_NODE_TITLE}
        </h4>
        {aiOriginSummary && (
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {Math.round(aiOriginSummary.confidence * 100)}% overall confidence
          </span>
        )}
      </div>

      <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
        {aiOriginSummary?.summary ??
          `Origin overview across ${availableGroups.length} categories and ${allQuestions.length} answers.`}
      </p>

      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        {availableGroups.length} categories • {allQuestions.length} answers • {Math.round(avgConfidence * 100)}% average category confidence
      </p>

      {aiOriginSummary?.sources?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {aiOriginSummary.sources.map((source, index) => (
            <a
              key={`${source.url}-${index}`}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <span className="rounded bg-zinc-100 px-1 py-0.5 text-[10px] font-medium dark:bg-zinc-800">
                {source.type}
              </span>
              <span className="max-w-[220px] truncate">{source.title}</span>
            </a>
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {availableGroups.map((entry) => (
          <article
            key={entry.group.id}
            className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-950"
          >
            <h5 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              {entry.group.emoji} {entry.group.title}
            </h5>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {entry.response.summary}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

function CategorySummary({
  node,
  groupById,
  groupTitlesById,
}: {
  node: FootprintTreeNode;
  groupById: Map<string, GroupResponse>;
  groupTitlesById: Map<string, string>;
}) {
  const branchQuestionNodes = collectQuestionNodes(node);

  const answeredInBranch = branchQuestionNodes
    .map((questionNode) => {
      const group = questionNode.groupId ? groupById.get(questionNode.groupId) : undefined;
      const questionText = questionNode.question ?? questionNode.title;
      const answer = findAnsweredQuestion(group, questionText);
      if (!answer) {
        return null;
      }

      return {
        ...answer,
        groupId: questionNode.groupId ?? "",
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const avgConfidence =
    answeredInBranch.length > 0
      ? answeredInBranch.reduce((sum, question) => sum + question.confidence, 0) /
        answeredInBranch.length
      : 0;

  const groupsInBranch = Array.from(
    new Set(
      branchQuestionNodes
        .map((questionNode) => questionNode.groupId)
        .filter((groupId): groupId is string => Boolean(groupId)),
    ),
  )
    .map((groupId) => ({
      groupId,
      group: groupById.get(groupId),
      title: groupTitlesById.get(groupId) ?? groupId,
    }))
    .filter((entry): entry is { groupId: string; group: GroupResponse; title: string } =>
      Boolean(entry.group),
    );

  return (
    <div>
      <h4 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{node.title}</h4>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {answeredInBranch.length} answers • {Math.round(avgConfidence * 100)}% average confidence
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {groupsInBranch.map((entry) => (
          <article
            key={`${node.id}-${entry.groupId}`}
            className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-950"
          >
            <h5 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              {entry.title}
            </h5>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {entry.group.summary}
            </p>
          </article>
        ))}
      </div>

      {branchQuestionNodes.length > 0 && (
        <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-950">
          <h5 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Questions in this branch
          </h5>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
            {branchQuestionNodes.slice(0, 10).map((item) => (
              <li key={item.id}>{item.question ?? item.title}</li>
            ))}
          </ul>
          {branchQuestionNodes.length > 10 && (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              +{branchQuestionNodes.length - 10} more questions in this branch.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionDetail({
  question,
  answer,
  confidence,
  sources,
  tags,
}: {
  question: string;
  answer: string;
  confidence: number;
  sources: Source[];
  tags: AnswerTag[];
}) {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h4 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{question}</h4>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {Math.round(confidence * 100)}% confidence
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{answer}</p>

      <div className="mt-4">
        <h5 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Auto-tags
        </h5>
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <SourceLinks sources={sources} />
    </div>
  );
}

function EmptyDetailState() {
  return (
    <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
      Select a card from the navigator to view summaries or detailed answers.
    </div>
  );
}

function SourceLinks({ sources }: { sources: Source[] }) {
  if (!sources.length) {
    return null;
  }

  return (
    <div className="mt-4">
      <h5 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Sources
      </h5>
      <div className="mt-2 flex flex-wrap gap-2">
        {sources.map((source, index) => (
          <a
            key={`${source.url}-${index}`}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <span className="rounded bg-zinc-100 px-1 py-0.5 text-[10px] font-medium dark:bg-zinc-800">
              {source.type}
            </span>
            <span className="max-w-[220px] truncate">{source.title}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function describeNode(node: FootprintTreeNode, groupById: Map<string, GroupResponse>) {
  if (node.kind === "question") {
    const question = node.question ?? node.title;
    const answer = findAnsweredQuestion(
      node.groupId ? groupById.get(node.groupId) : undefined,
      question,
    );

    if (!answer) {
      return "Question response";
    }

    return `${Math.round(answer.confidence * 100)}% confidence • ${answer.sources.length} source${answer.sources.length === 1 ? "" : "s"}`;
  }

  const questionCount = collectQuestionNodes(node).length;
  const branchCount = node.children.filter((child) => child.kind === "category").length;

  if (branchCount > 0) {
    return `${branchCount} branches • ${questionCount} question${questionCount === 1 ? "" : "s"}`;
  }

  return `${questionCount} question${questionCount === 1 ? "" : "s"}`;
}

function findNodeById(nodes: FootprintTreeNode[], targetId: string): FootprintTreeNode | null {
  for (const node of nodes) {
    if (node.id === targetId) {
      return node;
    }

    const nested = findNodeById(node.children, targetId);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function collectQuestionNodes(node: FootprintTreeNode): FootprintTreeNode[] {
  if (node.kind === "question") {
    return [node];
  }

  return node.children.flatMap((child) => collectQuestionNodes(child));
}

function findAnsweredQuestion(group: GroupResponse | undefined, question: string) {
  if (!group) {
    return null;
  }

  const exact = group.questions.find((item) => item.question === question);
  if (exact) {
    return exact;
  }

  const normalizedQuestion = normalizeQuestion(question);
  return (
    group.questions.find((item) => normalizeQuestion(item.question) === normalizedQuestion) ?? null
  );
}

function normalizeQuestion(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function extractTags(question: string, answer: string): AnswerTag[] {
  const combined = `${question} ${answer}`;
  const matches = TAG_MATCHERS.filter((entry) => entry.pattern.test(combined)).map(
    (entry) => entry.tag,
  );

  return matches.length > 0 ? matches.slice(0, 5) : ["Core description"];
}
