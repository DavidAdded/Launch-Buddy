"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, MutableRefObject } from "react";
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

type DrawHit = {
  x: number;
  y: number;
  width: number;
  height: number;
  node: FootprintTreeNode;
};

type CanvasDrawNode = {
  node: FootprintTreeNode;
  subtitle: string;
};

const PAGE_SIZE = 6;
const CANVAS_HEIGHT = 420;

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hitMapRef = useRef<DrawHit[]>([]);

  const effectiveTree = useMemo(
    () => tree ?? buildTreeFromGroups(groupMeta),
    [tree, groupMeta],
  );

  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [selection, setSelection] = useState<ExplorerSelection | null>(
    effectiveTree[0] ? { kind: "category", nodeId: effectiveTree[0].id } : null,
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

  const focusPath = useMemo(() => {
    if (!focusNodeId) {
      return [] as FootprintTreeNode[];
    }

    return findPathById(effectiveTree, focusNodeId) ?? [];
  }, [effectiveTree, focusNodeId]);

  const focusNode = focusPath.length > 0 ? focusPath[focusPath.length - 1] : null;
  const nodesAtFocus = focusNode ? focusNode.children : effectiveTree;

  const totalPages = Math.max(1, Math.ceil(nodesAtFocus.length / PAGE_SIZE));
  const boundedPage = Math.min(page, totalPages - 1);
  const visibleNodes = nodesAtFocus.slice(
    boundedPage * PAGE_SIZE,
    boundedPage * PAGE_SIZE + PAGE_SIZE,
  );

  const drawNodes = useMemo<CanvasDrawNode[]>(() => {
    return visibleNodes.map((node) => ({
      node,
      subtitle: describeNode(node, groupById),
    }));
  }, [groupById, visibleNodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    drawCanvas(
      ctx,
      width,
      height,
      drawNodes,
      selection?.nodeId ?? null,
      hitMapRef,
    );
  }, [drawNodes, selection?.nodeId]);

  const selectedNode = selection
    ? findNodeById(effectiveTree, selection.nodeId)
    : null;

  const selectedQuestion =
    selection?.kind === "question"
      ? findAnsweredQuestion(groupById.get(selection.groupId), selection.question)
      : null;

  function drillIntoCategory(node: FootprintTreeNode) {
    setSelection({ kind: "category", nodeId: node.id });
    if (node.children.length > 0) {
      setPage(0);
      setFocusNodeId(node.id);
    }
  }

  function handleNodeClick(node: FootprintTreeNode) {
    if (node.kind === "question") {
      setSelection({
        kind: "question",
        nodeId: node.id,
        groupId: node.groupId ?? "",
        question: node.question ?? node.title,
      });
      return;
    }

    drillIntoCategory(node);
  }

  function stepBack() {
    if (!focusNodeId) {
      return;
    }

    setPage(0);
    if (focusPath.length <= 1) {
      setFocusNodeId(null);
      return;
    }

    setFocusNodeId(focusPath[focusPath.length - 2].id);
  }

  function jumpToCrumb(index: number) {
    setPage(0);
    if (index === 0) {
      setFocusNodeId(null);
      return;
    }

    const target = focusPath[index - 1];
    if (!target) {
      return;
    }

    setFocusNodeId(target.id);
  }

  function handleCanvasClick(event: MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const hit = hitMapRef.current.find(
      (candidate) =>
        x >= candidate.x &&
        x <= candidate.x + candidate.width &&
        y >= candidate.y &&
        y <= candidate.y + candidate.height,
    );

    if (!hit) return;
    handleNodeClick(hit.node);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(320px,420px)_1fr]">
      <aside className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Footprint Navigator (2D)
            </h4>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Click a card to focus that branch. The canvas moves to available children.
            </p>
          </div>
          <button
            type="button"
            onClick={stepBack}
            disabled={!focusNodeId}
            className="cursor-pointer rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Back
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {[{ id: "root", title: "Overview" }, ...focusPath].map((step, index, all) => {
            const isLast = index === all.length - 1;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => jumpToCrumb(index)}
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

        <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-950">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="h-[420px] w-full cursor-pointer rounded-lg bg-white dark:bg-zinc-900"
            style={{ height: CANVAS_HEIGHT }}
          />

          <div className="mt-3 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>
              Showing {visibleNodes.length} of {nodesAtFocus.length} nodes
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
        </div>
      </aside>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        {!selection || !selectedNode ? (
          <EmptyDetailState />
        ) : selection.kind === "question" && selectedQuestion ? (
          <QuestionDetail
            question={selectedQuestion.question}
            answer={selectedQuestion.answer}
            confidence={selectedQuestion.confidence}
            sources={selectedQuestion.sources}
            tags={extractTags(selectedQuestion.question, selectedQuestion.answer)}
          />
        ) : (
          <CategorySummary
            node={selectedNode}
            groupById={groupById}
            groupTitlesById={groupTitlesById}
          />
        )}
      </section>
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
        <h4 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          {question}
        </h4>
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
      Select a branch from the 2D navigator to view summaries, or select a question card to see the full answer.
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
    return `${branchCount} branch${branchCount === 1 ? "" : "es"} • ${questionCount} question${questionCount === 1 ? "" : "s"}`;
  }

  return `${questionCount} question${questionCount === 1 ? "" : "s"}`;
}

function drawCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  nodes: CanvasDrawNode[],
  selectedNodeId: string | null,
  hitMapRef: MutableRefObject<DrawHit[]>,
) {
  hitMapRef.current = [];

  ctx.clearRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(148,163,184,0.14)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const columns = nodes.length <= 2 ? 2 : 3;
  const rows = Math.max(1, Math.ceil(nodes.length / columns));
  const gapX = 16;
  const gapY = 16;
  const margin = 16;
  const cardWidth = (width - margin * 2 - gapX * (columns - 1)) / columns;
  const cardHeight = (height - margin * 2 - gapY * (rows - 1)) / rows;

  nodes.forEach((drawNode, index) => {
    const node = drawNode.node;
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = margin + col * (cardWidth + gapX);
    const y = margin + row * (cardHeight + gapY);

    const color = colorForNode(node.kind);
    drawRoundedCard(ctx, x, y, cardWidth, cardHeight, color);

    if (selectedNodeId === node.id) {
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 2;
      roundedRectPath(ctx, x + 1.5, y + 1.5, cardWidth - 3, cardHeight - 3, 14);
      ctx.stroke();
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = "600 14px Inter, sans-serif";
    drawWrappedText(ctx, node.title, x + 14, y + 24, cardWidth - 28, 18, 3);

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "500 12px Inter, sans-serif";
    drawWrappedText(ctx, drawNode.subtitle, x + 14, y + cardHeight - 42, cardWidth - 28, 16, 2);

    ctx.fillStyle = "rgba(255,255,255,0.84)";
    ctx.font = "500 11px Inter, sans-serif";
    ctx.fillText(node.kind.toUpperCase(), x + 14, y + cardHeight - 12);

    hitMapRef.current.push({ x, y, width: cardWidth, height: cardHeight, node });
  });
}

function drawRoundedCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
) {
  roundedRectPath(ctx, x, y, width, height, 16);

  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "#111827");
  ctx.fillStyle = gradient;
  ctx.fill();
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
    } else {
      lines.push(word);
      current = "";
    }

    if (lines.length >= maxLines) break;
  }

  if (lines.length < maxLines && current) {
    lines.push(current);
  }

  const rendered = lines.slice(0, maxLines);
  if (lines.length > maxLines && rendered.length > 0) {
    rendered[rendered.length - 1] = `${rendered[rendered.length - 1]}...`;
  }

  rendered.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
}

function colorForNode(kind: FootprintTreeNode["kind"]) {
  switch (kind) {
    case "category":
      return "#1d4ed8";
    case "question":
      return "#0f766e";
    default:
      return "#374151";
  }
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

function findPathById(nodes: FootprintTreeNode[], targetId: string): FootprintTreeNode[] | null {
  for (const node of nodes) {
    if (node.id === targetId) {
      return [node];
    }

    const childPath = findPathById(node.children, targetId);
    if (childPath) {
      return [node, ...childPath];
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
