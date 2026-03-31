"use client";

import { useMemo, useState } from "react";
import type {
  FootprintFullResponse,
  FootprintNodeAnswer,
  FootprintGroup,
  GroupResponse,
  Source,
} from "@/lib/footprint-prompt";
import type { FootprintTreeNode } from "@/lib/footprint-hierarchy";
import { buildTreeFromGroups } from "@/lib/footprint-hierarchy";

type ExplorerSelection = { nodeId: string };

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
  { tag: "Core description", pattern: /what is|described as|known for|core brand|stand for/i },
  { tag: "Brand attributes", pattern: /innovative|premium|mainstream|quality|authentic/i },
  { tag: "Values/associations", pattern: /values|lifestyle|sustainab|ethical|culture|symbolic/i },
  { tag: "Audience", pattern: /consumer|audience|segment|buyers|people who/i },
  { tag: "Tone/personality", pattern: /tone|personality|voice|playful|provocative|bold/i },
  { tag: "Positive arguments", pattern: /strength|benefit|advantage|recommended|choose/i },
  { tag: "Negative arguments", pattern: /downside|avoid|drawback|concern|not recommended/i },
  { tag: "Criticisms/skepticism", pattern: /critic|skeptic|backlash|doubt|questioned/i },
  { tag: "Tensions/contradictions", pattern: /tension|contradiction|however|yet|trade-off/i },
  { tag: "Overemphasis", pattern: /overhyped|too much focus|overemphasized/i },
  { tag: "Underemphasis", pattern: /underreported|underemphasized|missing from narrative/i },
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
  const effectiveTree = useMemo<FootprintTreeNode[]>(
    () =>
      (parsed.hierarchy_tree as unknown as FootprintTreeNode[] | undefined) ??
      tree ??
      buildTreeFromGroups(parsed.group_meta ?? groupMeta),
    [groupMeta, parsed.group_meta, parsed.hierarchy_tree, tree],
  );

  const rootNode = useMemo<FootprintTreeNode>(() => {
    const first = effectiveTree[0];
    if (effectiveTree.length === 1 && first && normalizeTitle(first.title) === normalizeTitle(ORIGIN_NODE_TITLE)) {
      return first;
    }

    return {
      id: ORIGIN_NODE_ID,
      title: ORIGIN_NODE_TITLE,
      kind: "category",
      level: -1,
      children: effectiveTree,
    };
  }, [effectiveTree]);

  const [selection, setSelection] = useState<ExplorerSelection>({ nodeId: rootNode.id });
  const [page, setPage] = useState(0);

  const activePath = useMemo(() => {
    return findPathToNode(rootNode, selection.nodeId) ?? [rootNode];
  }, [rootNode, selection.nodeId]);

  const activeNode = activePath[activePath.length - 1] ?? rootNode;
  const containerNode =
    activeNode.kind === "question" ? activePath[activePath.length - 2] ?? rootNode : activeNode;

  const currentNodes = containerNode.children;
  const totalPages = Math.max(1, Math.ceil(currentNodes.length / PAGE_SIZE));
  const boundedPage = Math.min(page, totalPages - 1);
  const visibleNodes = currentNodes.slice(
    boundedPage * PAGE_SIZE,
    boundedPage * PAGE_SIZE + PAGE_SIZE,
  );

  const breadcrumbs = activePath.map((node) => ({ id: node.id, title: node.title }));

  const nodeAnswers = parsed.node_answers ?? {};
  const activeNodeAnswer = nodeAnswers[activeNode.id] ?? null;

  const fallbackQuestionAnswer =
    activeNode.kind === "question"
      ? findAnsweredQuestionFallback(
          parsed.groups,
          parsed.group_meta,
          activeNode.groupId,
          activeNode.question ?? activeNode.title,
        )
      : null;

  function openNode(node: FootprintTreeNode) {
    setSelection({ nodeId: node.id });
    if (node.kind === "category") {
      setPage(0);
    }
  }

  function stepBack() {
    if (activePath.length <= 1) {
      return;
    }

    const parent = activePath[activePath.length - 2];
    if (!parent) return;

    setSelection({ nodeId: parent.id });
    setPage(0);
  }

  function jumpTo(index: number) {
    const target = activePath[index];
    if (!target) return;

    setSelection({ nodeId: target.id });
    setPage(0);
  }

  return (
    <div className="h-full w-full pb-1">
      <div className="grid h-full w-full gap-4 lg:grid-cols-2">
        <aside className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 min-h-[500px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Footprint Navigator
              </h4>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Breadcrumb drilldown with one active item at a time.
              </p>
            </div>

            <button
              type="button"
              onClick={stepBack}
              disabled={activePath.length <= 1}
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

          <div className="mt-4 flex-1 overflow-auto pr-1">
            <div className="grid gap-3 sm:grid-cols-2">
              {visibleNodes.map((node) => {
                const isActive = activeNode.id === node.id;
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => openNode(node)}
                    className={`cursor-pointer rounded-2xl border p-4 text-left transition-all ${
                      node.kind === "question"
                        ? "border-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40"
                        : "border-blue-300 bg-blue-50 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:hover:bg-blue-900/40"
                    } ${isActive ? "ring-2 ring-zinc-900 dark:ring-zinc-100" : "ring-0"}`}
                  >
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{node.title}</p>
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                      {describeNode(node, nodeAnswers)}
                    </p>
                  </button>
                );
              })}
            </div>
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

        <section className="h-full min-h-0 overflow-auto rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          {activeNodeAnswer ? (
            <NodeAnswerDetail
              nodeTitle={activeNode.title}
              answer={activeNodeAnswer.answer}
              confidence={activeNodeAnswer.confidence}
              sources={activeNodeAnswer.sources}
              tags={activeNode.kind === "question" ? extractTags(activeNode.title, activeNodeAnswer.answer) : []}
            />
          ) : fallbackQuestionAnswer ? (
            <NodeAnswerDetail
              nodeTitle={activeNode.title}
              answer={fallbackQuestionAnswer.answer}
              confidence={fallbackQuestionAnswer.confidence}
              sources={fallbackQuestionAnswer.sources}
              tags={extractTags(activeNode.title, fallbackQuestionAnswer.answer)}
            />
          ) : (
            <EmptyDetailState />
          )}
        </section>
      </div>
    </div>
  );
}

function NodeAnswerDetail({
  nodeTitle,
  answer,
  confidence,
  sources,
  tags,
}: {
  nodeTitle: string;
  answer: string;
  confidence: number;
  sources: Source[];
  tags: AnswerTag[];
}) {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h4 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{nodeTitle}</h4>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {Math.round(confidence * 100)}% confidence
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{answer}</p>

      {tags.length > 0 ? (
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
      ) : null}

      <SourceLinks sources={sources} />
    </div>
  );
}

function EmptyDetailState() {
  return (
    <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
      No answer available for this node yet. Re-analyze to generate hierarchical summaries.
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

function describeNode(
  node: FootprintTreeNode,
  nodeAnswers: Record<string, FootprintNodeAnswer>,
) {
  const answer = nodeAnswers[node.id];
  if (answer) {
    return `${Math.round(answer.confidence * 100)}% confidence • ${answer.sources.length} source${answer.sources.length === 1 ? "" : "s"}`;
  }

  if (node.kind === "question") {
    return "Question response";
  }

  const questionCount = collectQuestionNodes(node).length;
  const branchCount = node.children.filter((child) => child.kind === "category").length;

  if (branchCount > 0) {
    return `${branchCount} branches • ${questionCount} question${questionCount === 1 ? "" : "s"}`;
  }

  return `${questionCount} question${questionCount === 1 ? "" : "s"}`;
}

function findPathToNode(rootNode: FootprintTreeNode, targetId: string): FootprintTreeNode[] | null {
  if (rootNode.id === targetId) {
    return [rootNode];
  }

  for (const child of rootNode.children) {
    const childPath = findPathToNode(child, targetId);
    if (childPath) {
      return [rootNode, ...childPath];
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

function findAnsweredQuestionFallback(
  groups: GroupResponse[],
  groupMeta: FootprintFullResponse["group_meta"] | undefined,
  groupId: string | undefined,
  question: string,
) {
  if (!groupId || !groupMeta) {
    return null;
  }

  const groupIndex = groupMeta.findIndex((group) => group.id === groupId);
  if (groupIndex < 0) {
    return null;
  }

  const group = groups[groupIndex];
  if (!group) {
    return null;
  }

  const exact = group.questions.find((item) => item.question === question);
  if (exact) {
    return exact;
  }

  const normalizedQuestion = normalizeTitle(question);
  return (
    group.questions.find((item) => normalizeTitle(item.question) === normalizedQuestion) ?? null
  );
}

function normalizeTitle(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function extractTags(question: string, answer: string): AnswerTag[] {
  const combined = `${question} ${answer}`;
  const matches = TAG_MATCHERS.filter((entry) => entry.pattern.test(combined)).map(
    (entry) => entry.tag,
  );

  return matches.length > 0 ? matches.slice(0, 5) : ["Core description"];
}
