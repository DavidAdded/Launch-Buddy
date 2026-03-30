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

type PositionedNode = {
  id: string;
  title: string;
  kind: FootprintTreeNode["kind"];
  level: number;
  groupId?: string;
  question?: string;
  parentId: string | null;
  childrenIds: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  isOrigin?: boolean;
};

type DrawHit = {
  left: number;
  top: number;
  width: number;
  height: number;
  node: PositionedNode;
};

type LayoutResult = {
  nodes: PositionedNode[];
  nodeById: Map<string, PositionedNode>;
  edges: Array<{ fromId: string; toId: string }>;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
};

const CANVAS_HEIGHT = 460;
const ORIGIN_TO_FIRST_SPACING = 214;
const LEVEL_SPACING = 244;
const V_SPACING = 120;
const ROOT_GAP = 1;
const H_MARGIN = 120;
const V_MARGIN = 90;

const CATEGORY_WIDTH = 192;
const CATEGORY_HEIGHT = 72;
const QUESTION_WIDTH = 232;
const QUESTION_HEIGHT = 64;
const ORIGIN_WIDTH = 184;
const ORIGIN_HEIGHT = 74;
const VIEW_SCALE = 0.9;

const ORIGIN_NODE_ID = "__origin__";
const ORIGIN_NODE_TITLE = "Oatly";

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hitMapRef = useRef<DrawHit[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  const effectiveTree = useMemo(
    () => tree ?? buildTreeFromGroups(groupMeta),
    [tree, groupMeta],
  );

  const layout = useMemo(() => buildFlowLayout(effectiveTree), [effectiveTree]);

  const initialCenter = useMemo(() => {
    const origin = layout.nodeById.get(ORIGIN_NODE_ID);
    if (origin) {
      return { x: origin.x, y: origin.y };
    }
    return {
      x: (layout.bounds.minX + layout.bounds.maxX) / 2,
      y: (layout.bounds.minY + layout.bounds.maxY) / 2,
    };
  }, [layout]);

  const [selection, setSelection] = useState<ExplorerSelection | null>(null);
  const [viewCenter, setViewCenter] = useState(initialCenter);

  const viewCenterRef = useRef(viewCenter);
  useEffect(() => {
    viewCenterRef.current = viewCenter;
  }, [viewCenter]);

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

  const selectedPath = useMemo(() => {
    if (!selection || selection.nodeId === ORIGIN_NODE_ID) {
      return [] as FootprintTreeNode[];
    }
    return findPathById(effectiveTree, selection.nodeId) ?? [];
  }, [effectiveTree, selection]);

  const selectedPathEdgeKeys = useMemo(() => {
    const keys = new Set<string>();

    if (!selection) {
      return keys;
    }

    if (selection.nodeId === ORIGIN_NODE_ID) {
      effectiveTree.forEach((rootNode) => {
        keys.add(`${ORIGIN_NODE_ID}->${rootNode.id}`);
      });
      return keys;
    }

    if (selectedPath.length > 0) {
      keys.add(`${ORIGIN_NODE_ID}->${selectedPath[0]?.id}`);
    }

    for (let index = 0; index < selectedPath.length - 1; index += 1) {
      const from = selectedPath[index]?.id;
      const to = selectedPath[index + 1]?.id;
      if (from && to) {
        keys.add(`${from}->${to}`);
      }
    }

    return keys;
  }, [effectiveTree, selectedPath, selection]);

  const visibleNodeIds = useMemo(() => {
    const ids = new Set<string>();
    ids.add(ORIGIN_NODE_ID);

    if (!selection) {
      return ids;
    }

    if (selection.nodeId === ORIGIN_NODE_ID) {
      const origin = layout.nodeById.get(ORIGIN_NODE_ID);
      origin?.childrenIds.forEach((childId) => ids.add(childId));
      return ids;
    }

    selectedPath.forEach((node) => ids.add(node.id));

    const selectedNode = layout.nodeById.get(selection.nodeId);
    selectedNode?.childrenIds.forEach((childId) => ids.add(childId));

    if (selectedPath.length === 0) {
      const origin = layout.nodeById.get(ORIGIN_NODE_ID);
      origin?.childrenIds.forEach((childId) => ids.add(childId));
    }

    return ids;
  }, [layout, selectedPath, selection]);

  const breadcrumbs = useMemo(
    () => [
      { id: ORIGIN_NODE_ID, title: ORIGIN_NODE_TITLE },
      ...selectedPath.map((step) => ({ id: step.id, title: step.title })),
    ],
    [selectedPath],
  );

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

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

    drawFlowCanvas(
      ctx,
      width,
      height,
      layout,
      viewCenter,
      visibleNodeIds,
      selectedPathEdgeKeys,
      selection?.nodeId ?? null,
      hitMapRef,
      groupById,
    );
  }, [
    groupById,
    layout,
    selection?.nodeId,
    selectedPathEdgeKeys,
    viewCenter,
    visibleNodeIds,
  ]);

  const isOriginSelected = selection?.nodeId === ORIGIN_NODE_ID;
  const selectedNode =
    selection?.nodeId && !isOriginSelected
      ? findNodeById(effectiveTree, selection.nodeId)
      : null;

  const selectedQuestion =
    selection?.kind === "question"
      ? findAnsweredQuestion(groupById.get(selection.groupId), selection.question)
      : null;

  function animateTo(target: { x: number; y: number }) {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const from = viewCenterRef.current;
    const to = clampCenter(target, layout.bounds);
    const duration = 320;
    let startTime: number | null = null;

    const frame = (time: number) => {
      if (startTime === null) {
        startTime = time;
      }

      const progress = Math.min(1, (time - startTime) / duration);
      const eased = easeInOutCubic(progress);
      const next = {
        x: from.x + (to.x - from.x) * eased,
        y: from.y + (to.y - from.y) * eased,
      };
      setViewCenter(next);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(frame);
      } else {
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(frame);
  }

  function selectByNode(node: PositionedNode) {
    let nextSelection: ExplorerSelection;
    if (node.kind === "question") {
      nextSelection = {
        kind: "question",
        nodeId: node.id,
        groupId: node.groupId ?? "",
        question: node.question ?? node.title,
      };
    } else {
      nextSelection = { kind: "category", nodeId: node.id };
    }

    setSelection(nextSelection);
    const target = selectionFocusTarget(node.id, layout);
    if (target) {
      animateTo(target);
    }
  }

  function handleCanvasClick(event: MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const hit = hitMapRef.current.find(
      (candidate) =>
        x >= candidate.left &&
        x <= candidate.left + candidate.width &&
        y >= candidate.top &&
        y <= candidate.top + candidate.height,
    );

    if (!hit) return;
    selectByNode(hit.node);
  }

  function stepBack() {
    if (!selection || selection.nodeId === ORIGIN_NODE_ID) {
      return;
    }

    if (selectedPath.length <= 1) {
      const originNode = layout.nodeById.get(ORIGIN_NODE_ID);
      if (originNode) {
        selectByNode(originNode);
      }
      return;
    }

    const parent = selectedPath[selectedPath.length - 2];
    if (!parent) return;

    const parentNode = layout.nodeById.get(parent.id);
    if (parentNode) {
      selectByNode(parentNode);
    }
  }

  function jumpToCrumb(index: number) {
    const target = breadcrumbs[index];
    if (!target) return;

    const node = layout.nodeById.get(target.id);
    if (node) {
      selectByNode(node);
    }
  }

  function resetView() {
    setSelection(null);
    setViewCenter(initialCenter);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <aside className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Footprint Navigator (Flow)
            </h4>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Rounded branch cards stay fixed. Click a node to reveal only its next
              sub-branch.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={stepBack}
              disabled={!selection || selection.nodeId === ORIGIN_NODE_ID}
              className="cursor-pointer rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Back
            </button>
            <button
              type="button"
              onClick={resetView}
              className="cursor-pointer rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Reset view
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {breadcrumbs.map((step, index, all) => {
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
            className="h-[460px] w-full cursor-pointer rounded-lg bg-white dark:bg-zinc-900"
            style={{ height: CANVAS_HEIGHT }}
          />

          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            {layout.nodes.length} nodes • {layout.edges.length} links
          </p>
        </div>
      </aside>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        {!selection ? (
          <EmptyDetailState />
        ) : isOriginSelected ? (
          <OriginSummary parsed={parsed} groupMeta={groupMeta} groupById={groupById} />
        ) : selection.kind === "question" && selectedQuestion ? (
          <QuestionDetail
            question={selectedQuestion.question}
            answer={selectedQuestion.answer}
            confidence={selectedQuestion.confidence}
            sources={selectedQuestion.sources}
            tags={extractTags(selectedQuestion.question, selectedQuestion.answer)}
          />
        ) : selectedNode ? (
          <CategorySummary
            node={selectedNode}
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
    .map((group) => ({
      group,
      response: groupById.get(group.id),
    }))
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
      Click the Oatly origin node to start exploring, then click a branch to reveal
      its sub-nodes.
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

function buildFlowLayout(tree: FootprintTreeNode[]): LayoutResult {
  const nodes: PositionedNode[] = [];
  const nodeById = new Map<string, PositionedNode>();
  const edges: Array<{ fromId: string; toId: string }> = [];

  let leafIndex = 0;

  const placeNode = (
    node: FootprintTreeNode,
    level: number,
    parentId: string | null,
  ): PositionedNode => {
    const isQuestion = node.kind === "question";
    const width = isQuestion ? QUESTION_WIDTH : CATEGORY_WIDTH;
    const height = isQuestion ? QUESTION_HEIGHT : CATEGORY_HEIGHT;

    const positioned: PositionedNode = {
      id: node.id,
      title: node.title,
      kind: node.kind,
      level,
      groupId: node.groupId,
      question: node.question,
      parentId,
      childrenIds: node.children.map((child) => child.id),
      x: H_MARGIN + ORIGIN_TO_FIRST_SPACING + (level - 1) * LEVEL_SPACING,
      y: 0,
      width,
      height,
    };

    nodes.push(positioned);
    nodeById.set(positioned.id, positioned);

    if (parentId) {
      edges.push({ fromId: parentId, toId: positioned.id });
    }

    if (node.children.length === 0) {
      positioned.y = V_MARGIN + leafIndex * V_SPACING;
      leafIndex += 1;
      return positioned;
    }

    const childNodes = node.children.map((child) => placeNode(child, level + 1, node.id));
    const minChildY = Math.min(...childNodes.map((child) => child.y));
    const maxChildY = Math.max(...childNodes.map((child) => child.y));
    positioned.y = (minChildY + maxChildY) / 2;

    return positioned;
  };

  const rootNodeIds = tree.map((rootNode) => rootNode.id);

  tree.forEach((rootNode, rootIndex) => {
    placeNode(rootNode, 1, null);
    if (rootIndex < tree.length - 1) {
      leafIndex += ROOT_GAP;
    }
  });

  const rootNodes = rootNodeIds
    .map((rootId) => nodeById.get(rootId))
    .filter((node): node is PositionedNode => Boolean(node));

  const shiftSubtreeY = (nodeId: string, deltaY: number) => {
    const stack = [nodeId];
    while (stack.length > 0) {
      const currentId = stack.pop();
      if (!currentId) continue;

      const currentNode = nodeById.get(currentId);
      if (!currentNode) continue;

      currentNode.y += deltaY;
      currentNode.childrenIds.forEach((childId) => stack.push(childId));
    }
  };

  if (rootNodes.length > 1) {
    const orderedRoots = [...rootNodes].sort((a, b) => a.y - b.y);
    const rootVerticalGap = Math.max(CATEGORY_HEIGHT + 24, 104);
    const currentCenterY =
      orderedRoots.reduce((sum, node) => sum + node.y, 0) / orderedRoots.length;
    const compactStartY =
      currentCenterY - ((orderedRoots.length - 1) * rootVerticalGap) / 2;

    orderedRoots.forEach((rootNode, index) => {
      const targetY = compactStartY + index * rootVerticalGap;
      const deltaY = targetY - rootNode.y;
      if (Math.abs(deltaY) > 0.5) {
        shiftSubtreeY(rootNode.id, deltaY);
      }
    });
  }

  if (rootNodes.length > 0) {
    const originY = rootNodes.reduce((sum, node) => sum + node.y, 0) / rootNodes.length;

    const originNode: PositionedNode = {
      id: ORIGIN_NODE_ID,
      title: ORIGIN_NODE_TITLE,
      kind: "category",
      level: 0,
      parentId: null,
      childrenIds: rootNodes.map((node) => node.id),
      x: H_MARGIN,
      y: originY,
      width: ORIGIN_WIDTH,
      height: ORIGIN_HEIGHT,
      isOrigin: true,
    };

    nodes.push(originNode);
    nodeById.set(originNode.id, originNode);

    rootNodes.forEach((rootNode) => {
      edges.push({ fromId: originNode.id, toId: rootNode.id });
    });
  }

  if (nodes.length === 0) {
    return {
      nodes,
      nodeById,
      edges,
      bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
    };
  }

  const lefts = nodes.map((node) => node.x - node.width / 2);
  const rights = nodes.map((node) => node.x + node.width / 2);
  const tops = nodes.map((node) => node.y - node.height / 2);
  const bottoms = nodes.map((node) => node.y + node.height / 2);

  return {
    nodes,
    nodeById,
    edges,
    bounds: {
      minX: Math.min(...lefts) - H_MARGIN,
      maxX: Math.max(...rights) + H_MARGIN,
      minY: Math.min(...tops) - V_MARGIN,
      maxY: Math.max(...bottoms) + V_MARGIN,
    },
  };
}

function drawFlowCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  layout: LayoutResult,
  viewCenter: { x: number; y: number },
  visibleNodeIds: Set<string>,
  selectedPathEdgeKeys: Set<string>,
  selectedNodeId: string | null,
  hitMapRef: MutableRefObject<DrawHit[]>,
  groupById: Map<string, GroupResponse>,
) {
  hitMapRef.current = [];
  ctx.clearRect(0, 0, width, height);

  drawCanvasGrid(ctx, width, height);

  const centerX = width / 2;
  const centerY = height / 2;

  const positionedScreen = new Map<string, { x: number; y: number; node: PositionedNode }>();
  layout.nodes.forEach((node) => {
    positionedScreen.set(node.id, {
      x: node.x - viewCenter.x + centerX,
      y: node.y - viewCenter.y + centerY,
      node,
    });
  });

  for (const edge of layout.edges) {
    if (!visibleNodeIds.has(edge.fromId) || !visibleNodeIds.has(edge.toId)) {
      continue;
    }

    const from = positionedScreen.get(edge.fromId);
    const to = positionedScreen.get(edge.toId);
    if (!from || !to) continue;

    const edgeKey = `${edge.fromId}->${edge.toId}`;
    drawFlowLink(ctx, from, to, selectedPathEdgeKeys.has(edgeKey));
  }

  for (const node of layout.nodes) {
    if (!visibleNodeIds.has(node.id)) {
      continue;
    }

    const screen = positionedScreen.get(node.id);
    if (!screen) continue;

    const x = screen.x;
    const y = screen.y;
    const widthHalf = node.width / 2;
    const heightHalf = node.height / 2;

    if (
      x + widthHalf < -40 ||
      x - widthHalf > width + 40 ||
      y + heightHalf < -40 ||
      y - heightHalf > height + 40
    ) {
      continue;
    }

    const left = x - widthHalf;
    const top = y - heightHalf;
    const isSelected =
      selectedNodeId === node.id || (!selectedNodeId && node.isOrigin === true);
    const subtitle = nodeSubtitle(node, groupById, layout);

    drawNodeCard(ctx, left, top, node.width, node.height, node.kind, isSelected, node.isOrigin === true);
    drawCenteredText(ctx, node.title, x, y - 8, node.width - 24, 14, 2, 600);
    drawCenteredText(ctx, subtitle, x, y + 16, node.width - 20, 12, 2, 500);

    hitMapRef.current.push({
      left,
      top,
      width: node.width,
      height: node.height,
      node,
    });
  }
}

function drawCanvasGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.strokeStyle = "rgba(148,163,184,0.12)";
  ctx.lineWidth = 1;

  for (let x = 0; x <= width; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = 0; y <= height; y += 28) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawFlowLink(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number; node: PositionedNode },
  to: { x: number; y: number; node: PositionedNode },
  highlighted: boolean,
) {
  const fromRight = from.x + from.node.width / 2 - 8;
  const toLeft = to.x - to.node.width / 2 + 8;
  const minGap = 24;
  const startX = Math.min(fromRight, toLeft - minGap);
  const endX = Math.max(toLeft, startX + minGap);
  const controlOffset = Math.max(24, Math.min(110, (endX - startX) * 0.45));

  ctx.beginPath();
  ctx.moveTo(startX, from.y);
  ctx.bezierCurveTo(
    startX + controlOffset,
    from.y,
    endX - controlOffset,
    to.y,
    endX,
    to.y,
  );
  ctx.strokeStyle = highlighted ? "rgba(99,102,241,0.86)" : "rgba(100,116,139,0.30)";
  ctx.lineWidth = highlighted ? 2.4 : 1.35;
  ctx.stroke();
}

function drawNodeCard(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  width: number,
  height: number,
  kind: FootprintTreeNode["kind"],
  selected: boolean,
  isOrigin: boolean,
) {
  const radius = Math.min(20, height / 2.3);

  roundedRectPath(ctx, left, top, width, height, radius);

  const gradient = ctx.createLinearGradient(left, top, left + width, top + height);
  if (isOrigin) {
    gradient.addColorStop(0, "#c2410c");
    gradient.addColorStop(1, "#9a3412");
  } else if (kind === "question") {
    gradient.addColorStop(0, "#0f766e");
    gradient.addColorStop(1, "#065f46");
  } else {
    gradient.addColorStop(0, "#1d4ed8");
    gradient.addColorStop(1, "#1e3a8a");
  }

  ctx.save();
  ctx.shadowColor = "rgba(15, 23, 42, 0.20)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();

  roundedRectPath(ctx, left, top, width, height, radius);
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  ctx.stroke();

  if (selected) {
    roundedRectPath(ctx, left - 3, top - 3, width + 6, height + 6, radius + 2);
    ctx.strokeStyle = "rgba(255,255,255,0.96)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
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

function drawCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
  fontWeight: 500 | 600,
) {
  const lines = wrapText(ctx, text, maxWidth, maxLines, fontWeight);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${fontWeight} ${fontWeight === 600 ? 13 : 11}px Inter, sans-serif`;

  const blockHeight = (lines.length - 1) * lineHeight;
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y - blockHeight / 2 + index * lineHeight);
  });

  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
  fontWeight: 500 | 600,
) {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  ctx.font = `${fontWeight} ${fontWeight === 600 ? 13 : 11}px Inter, sans-serif`;

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
    } else {
      lines.push(word);
      current = "";
    }

    if (lines.length >= maxLines) {
      break;
    }
  }

  if (lines.length < maxLines && current) {
    lines.push(current);
  }

  if (lines.length === 0) {
    return [text];
  }

  if (lines.length > maxLines) {
    lines.length = maxLines;
  }

  if (lines.length === maxLines) {
    const last = lines[maxLines - 1] ?? "";
    if (ctx.measureText(last).width > maxWidth) {
      lines[maxLines - 1] = `${last.slice(0, Math.max(4, last.length - 3))}...`;
    }
  }

  return lines;
}

function nodeSubtitle(
  node: PositionedNode,
  groupById: Map<string, GroupResponse>,
  layout: LayoutResult,
) {
  if (node.isOrigin) {
    return `${node.childrenIds.length} connected branches`;
  }

  if (node.kind === "question") {
    const questionText = node.question ?? node.title;
    const answer = findAnsweredQuestion(
      node.groupId ? groupById.get(node.groupId) : undefined,
      questionText,
    );

    if (!answer) {
      return "Question";
    }

    return `${Math.round(answer.confidence * 100)}% • ${answer.sources.length} src`;
  }

  const questionCount = countDescendantQuestions(node.id, layout.nodeById);
  return `${node.childrenIds.length} branches • ${questionCount} q`;
}

function countDescendantQuestions(nodeId: string, nodeById: Map<string, PositionedNode>): number {
  const node = nodeById.get(nodeId);
  if (!node) {
    return 0;
  }

  if (node.kind === "question") {
    return 1;
  }

  return node.childrenIds.reduce(
    (sum, childId) => sum + countDescendantQuestions(childId, nodeById),
    0,
  );
}

function selectionFocusTarget(nodeId: string, layout: LayoutResult) {
  const node = layout.nodeById.get(nodeId);
  if (!node) {
    return null;
  }

  if (node.isOrigin) {
    const children = node.childrenIds
      .map((id) => layout.nodeById.get(id))
      .filter((child): child is PositionedNode => Boolean(child));

    if (children.length === 0) {
      return { x: node.x, y: node.y };
    }

    const avgY = children.reduce((sum, child) => sum + child.y, 0) / children.length;
    const avgX = children.reduce((sum, child) => sum + child.x, 0) / children.length;

    return { x: (node.x + avgX) / 2, y: avgY };
  }

  if (node.childrenIds.length === 0) {
    return { x: node.x, y: node.y };
  }

  const children = node.childrenIds
    .map((id) => layout.nodeById.get(id))
    .filter((child): child is PositionedNode => Boolean(child));

  if (children.length === 0) {
    return { x: node.x, y: node.y };
  }

  const avgY = children.reduce((sum, child) => sum + child.y, 0) / children.length;
  const avgX = children.reduce((sum, child) => sum + child.x, 0) / children.length;

  return { x: (node.x + avgX) / 2, y: avgY };
}

function clampCenter(center: { x: number; y: number }, bounds: LayoutResult["bounds"]) {
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, center.x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, center.y)),
  };
}

function easeInOutCubic(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
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
