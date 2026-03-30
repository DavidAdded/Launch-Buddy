"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, MutableRefObject } from "react";
import type {
  FootprintFullResponse,
  FootprintGroup,
  Source,
} from "@/lib/footprint-prompt";
import {
  FOOTPRINT_LENS_DEFINITIONS,
  FOOTPRINT_SUPER_CATEGORIES,
} from "@/lib/footprint-canvas-taxonomy";

type QuestionLeaf = {
  id: string;
  title: string;
  answer: string;
  confidence: number;
  sources: Source[];
};

type CanvasNode = {
  id: string;
  title: string;
  subtitle: string;
  kind: "super" | "group" | "lens" | "question";
  children?: CanvasNode[];
  questionLeaf?: QuestionLeaf;
};

type DrawHit = {
  x: number;
  y: number;
  width: number;
  height: number;
  node: CanvasNode;
};

type PathStep = {
  id: string;
  title: string;
  nodes: CanvasNode[];
};

const PAGE_SIZE = 6;
const CANVAS_HEIGHT = 420;

export function FootprintCanvasExplorer({
  parsed,
  groupMeta,
}: {
  parsed: FootprintFullResponse;
  groupMeta: FootprintGroup[];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hitMapRef = useRef<DrawHit[]>([]);

  const rootNodes = useMemo(() => buildRootNodes(parsed, groupMeta), [parsed, groupMeta]);
  const [path, setPath] = useState<PathStep[]>([
    { id: "root", title: "Insight Map", nodes: rootNodes },
  ]);
  const [page, setPage] = useState(0);
  const [selectedLeaf, setSelectedLeaf] = useState<QuestionLeaf | null>(null);

  const currentStep = path[path.length - 1];
  const totalPages = Math.max(1, Math.ceil(currentStep.nodes.length / PAGE_SIZE));
  const boundedPage = Math.min(page, totalPages - 1);
  const visibleNodes = currentStep.nodes.slice(
    boundedPage * PAGE_SIZE,
    boundedPage * PAGE_SIZE + PAGE_SIZE,
  );

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

    drawCanvas(ctx, width, height, visibleNodes, hitMapRef);
  }, [visibleNodes]);

  function openNode(node: CanvasNode) {
    if (node.kind === "question" && node.questionLeaf) {
      setSelectedLeaf(node.questionLeaf);
      return;
    }

    if (!node.children || node.children.length === 0) return;
    setSelectedLeaf(null);
    setPage(0);
    setPath((prev) => [...prev, { id: node.id, title: node.title, nodes: node.children ?? [] }]);
  }

  function stepBack() {
    if (path.length <= 1) return;
    setSelectedLeaf(null);
    setPage(0);
    setPath((prev) => prev.slice(0, -1));
  }

  function jumpTo(stepIndex: number) {
    if (stepIndex < 0 || stepIndex >= path.length) return;
    setSelectedLeaf(null);
    setPage(0);
    setPath((prev) => prev.slice(0, stepIndex + 1));
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
    openNode(hit.node);
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            2D Insight Canvas (Drill-down)
          </h4>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Click nodes to go deeper: super-categories → categories → sub-lenses → questions.
          </p>
        </div>
        <button
          type="button"
          onClick={stepBack}
          disabled={path.length <= 1}
          className="cursor-pointer rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Back one level
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {path.map((step, index) => {
          const isLast = index === path.length - 1;
          return (
            <button
              key={`${step.id}-${index}`}
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

      <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-950">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="h-[420px] w-full cursor-pointer rounded-lg bg-white dark:bg-zinc-900"
          style={{ height: CANVAS_HEIGHT }}
        />

        <div className="mt-3 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>
            Showing {visibleNodes.length} of {currentStep.nodes.length} nodes
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

      {selectedLeaf && (
        <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-950">
          <div className="flex items-start justify-between gap-3">
            <h5 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {selectedLeaf.title}
            </h5>
            <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {Math.round(selectedLeaf.confidence * 100)}% confidence
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {selectedLeaf.answer}
          </p>
          {selectedLeaf.sources.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedLeaf.sources.map((source, index) => (
                <a
                  key={`${source.url}-${index}`}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <span className="rounded bg-zinc-100 px-1 py-0.5 text-[10px] font-medium dark:bg-zinc-800">
                    {source.type}
                  </span>
                  <span className="max-w-[220px] truncate">{source.title}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function buildRootNodes(parsed: FootprintFullResponse, groupMeta: FootprintGroup[]) {
  const groupById = new Map<string, { meta: FootprintGroup; response: FootprintFullResponse["groups"][number] }>();

  groupMeta.forEach((meta, index) => {
    const response = parsed.groups[index];
    if (!response) return;
    groupById.set(meta.id, { meta, response });
  });

  return FOOTPRINT_SUPER_CATEGORIES.map((superCategory) => {
    const groups = superCategory.groupIds
      .map((groupId) => groupById.get(groupId))
      .filter((entry): entry is { meta: FootprintGroup; response: FootprintFullResponse["groups"][number] } => Boolean(entry));

    const children = groups.map(({ meta, response }) => {
      const lensNodes = buildLensNodes(meta, response);
      const averageConfidence =
        response.questions.length > 0
          ? response.questions.reduce((sum, question) => sum + question.confidence, 0) /
            response.questions.length
          : 0;

      return {
        id: meta.id,
        title: meta.title,
        subtitle: `${response.questions.length} answers • ${Math.round(averageConfidence * 100)}% avg confidence`,
        kind: "group" as const,
        children: lensNodes,
      };
    });

    const questionCount = children.reduce(
      (sum, node) =>
        sum +
        (node.children?.reduce((lensSum, lens) => lensSum + (lens.children?.length ?? 0), 0) ?? 0),
      0,
    );

    return {
      id: superCategory.id,
      title: superCategory.title,
      subtitle: `${children.length} categories • ${questionCount} responses`,
      kind: "super" as const,
      children,
    };
  });
}

function buildLensNodes(
  group: FootprintGroup,
  response: FootprintFullResponse["groups"][number],
): CanvasNode[] {
  const bucket = new Map<string, CanvasNode[]>();

  for (const lens of FOOTPRINT_LENS_DEFINITIONS) {
    bucket.set(lens.id, []);
  }
  bucket.set("other", []);

  response.questions.forEach((question, index) => {
    const match = FOOTPRINT_LENS_DEFINITIONS.find((lens) => lens.pattern.test(question.question));
    const lensId = match?.id ?? "other";
    const sourceCount = question.sources.length;

    bucket.get(lensId)?.push({
      id: `${group.id}-q-${index + 1}`,
      title: question.question,
      subtitle: `${Math.round(question.confidence * 100)}% confidence • ${sourceCount} source${sourceCount === 1 ? "" : "s"}`,
      kind: "question",
      questionLeaf: {
        id: `${group.id}-q-${index + 1}`,
        title: question.question,
        answer: question.answer,
        confidence: question.confidence,
        sources: question.sources,
      },
    });
  });

  const lensNodes: CanvasNode[] = [];
  for (const lens of FOOTPRINT_LENS_DEFINITIONS) {
    const questions = bucket.get(lens.id) ?? [];
    if (questions.length === 0) continue;

    const avgConfidence =
      questions.reduce((sum, node) => sum + (node.questionLeaf?.confidence ?? 0), 0) /
      questions.length;

    lensNodes.push({
      id: `${group.id}-${lens.id}`,
      title: lens.title,
      subtitle: `${questions.length} responses • ${Math.round(avgConfidence * 100)}% avg confidence`,
      kind: "lens",
      children: questions,
    });
  }

  const otherNodes = bucket.get("other") ?? [];
  if (otherNodes.length > 0) {
    lensNodes.push({
      id: `${group.id}-other`,
      title: "Other signals",
      subtitle: `${otherNodes.length} responses`,
      kind: "lens",
      children: otherNodes,
    });
  }

  return lensNodes;
}

function drawCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  nodes: CanvasNode[],
  hitMapRef: MutableRefObject<DrawHit[]>,
) {
  hitMapRef.current = [];

  ctx.clearRect(0, 0, width, height);

  // Background grid for spatial orientation
  ctx.strokeStyle = "rgba(148,163,184,0.15)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const columns = 3;
  const rows = 2;
  const gapX = 16;
  const gapY = 16;
  const margin = 20;
  const cardWidth = (width - margin * 2 - gapX * (columns - 1)) / columns;
  const cardHeight = (height - margin * 2 - gapY * (rows - 1)) / rows;

  nodes.forEach((node, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = margin + col * (cardWidth + gapX);
    const y = margin + row * (cardHeight + gapY);

    const color = colorForNode(node.kind);
    drawRoundedCard(ctx, x, y, cardWidth, cardHeight, color);

    ctx.fillStyle = "#ffffff";
    ctx.font = "600 14px Inter, sans-serif";
    drawWrappedText(ctx, node.title, x + 14, y + 24, cardWidth - 28, 18, 3);

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "500 12px Inter, sans-serif";
    drawWrappedText(ctx, node.subtitle, x + 14, y + cardHeight - 42, cardWidth - 28, 16, 2);

    ctx.fillStyle = "rgba(255,255,255,0.85)";
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
  const radius = 16;
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

  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "#111827");
  ctx.fillStyle = gradient;
  ctx.fill();
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

  if (lines.length > maxLines) {
    lines.length = maxLines;
  }

  const rendered = lines.slice(0, maxLines).map((line, index) => {
    if (index !== maxLines - 1 || lines.length <= maxLines) return line;
    return ctx.measureText(line).width <= maxWidth ? line : `${line.slice(0, Math.max(3, line.length - 3))}...`;
  });

  rendered.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
}

function colorForNode(kind: CanvasNode["kind"]) {
  switch (kind) {
    case "super":
      return "#1d4ed8";
    case "group":
      return "#7c3aed";
    case "lens":
      return "#0f766e";
    case "question":
      return "#b45309";
    default:
      return "#374151";
  }
}
