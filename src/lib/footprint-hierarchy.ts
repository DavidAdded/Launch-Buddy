import type { FootprintGroup } from "@/lib/footprint-prompt";

export type FootprintTreeNode = {
  id: string;
  title: string;
  kind: "category" | "question";
  level: number;
  children: FootprintTreeNode[];
  question?: string;
  groupId?: string;
};

type CsvParseResult = {
  groups: FootprintGroup[];
  tree: FootprintTreeNode[];
  warnings: string[];
};

type ParsedRow = {
  rowIndex: number;
  question: string;
  path: string[];
};

const GROUP_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

const QUESTION_COLUMN_CANDIDATES = ["question", "prompt", "fraga", "fråga"];

export function parseFootprintHierarchyCsv(csvText: string): CsvParseResult {
  const warnings: string[] = [];
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) {
    return {
      groups: [],
      tree: [],
      warnings: ["CSV is empty or missing rows."],
    };
  }

  const headers = rows[0].map((value) => value.trim());
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));

  const questionIndex = normalizedHeaders.findIndex((header) =>
    QUESTION_COLUMN_CANDIDATES.includes(header),
  );
  if (questionIndex < 0) {
    return {
      groups: [],
      tree: [],
      warnings: [
        "Missing question column. Add one of: question, prompt, fråga/fraga.",
      ],
    };
  }

  const levelIndexes = normalizedHeaders
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => isLevelHeader(header))
    .sort((a, b) => getLevelOrder(a.header) - getLevelOrder(b.header));

  if (levelIndexes.length === 0) {
    warnings.push(
      "No hierarchy level columns found. Using one default category: Imported Questions.",
    );
  }

  const parsedRows: ParsedRow[] = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (row.every((cell) => cell.trim().length === 0)) {
      continue;
    }

    const question = (row[questionIndex] ?? "").trim();
    if (!question) {
      warnings.push(`Row ${rowIndex + 1}: missing question value, row skipped.`);
      continue;
    }

    const path = levelIndexes
      .map(({ index }) => (row[index] ?? "").trim())
      .filter(Boolean);

    if (path.length === 0) {
      parsedRows.push({ rowIndex, question, path: ["Imported Questions"] });
      continue;
    }

    parsedRows.push({ rowIndex, question, path });
  }

  if (parsedRows.length === 0) {
    return { groups: [], tree: [], warnings };
  }

  let groupLevelIndex = 0;
  const hasMultipleLevels = parsedRows.every((entry) => entry.path.length > 1);
  const firstLevelSet = new Set(parsedRows.map((entry) => entry.path[0]?.toLowerCase()));

  if (hasMultipleLevels && firstLevelSet.size === 1) {
    groupLevelIndex = 1;
    const sharedRoot = parsedRows[0]?.path[0] ?? "Root";
    warnings.push(
      `Detected shared level-1 root "${sharedRoot}". Grouping analysis by level 2 while keeping level 1 in the navigator.`,
    );
  }

  const root: FootprintTreeNode[] = [];
  const groupMap = new Map<string, { title: string; questions: string[] }>();
  const seenQuestionIds = new Set<string>();

  for (const entry of parsedRows) {
    const { rowIndex, question, path } = entry;

    const groupTitle = path[groupLevelIndex] ?? path[0] ?? "Imported Questions";
    const groupIdBase = slugify(groupTitle);
    const groupId = groupIdBase || `group-${rowIndex}`;

    const existingGroup = groupMap.get(groupId);
    if (!existingGroup) {
      groupMap.set(groupId, { title: groupTitle, questions: [question] });
    } else {
      existingGroup.questions.push(question);
    }

    let nodes = root;
    let parentPath = "";

    path.forEach((segment, level) => {
      const segmentId = slugify(segment) || `level-${level + 1}`;
      parentPath = parentPath ? `${parentPath}/${segmentId}` : segmentId;

      let node = nodes.find(
        (candidate) => candidate.kind === "category" && candidate.id === parentPath,
      );

      if (!node) {
        node = {
          id: parentPath,
          title: segment,
          kind: "category",
          level,
          children: [],
          groupId,
        };
        nodes.push(node);
      }

      nodes = node.children;
    });

    const questionId = `${parentPath}/q-${slugify(question) || rowIndex}`;
    if (!seenQuestionIds.has(questionId)) {
      seenQuestionIds.add(questionId);
      nodes.push({
        id: questionId,
        title: question,
        kind: "question",
        question,
        level: path.length,
        children: [],
        groupId,
      });
    }
  }

  const groups = Array.from(groupMap.entries()).map(([id, value], index) => ({
    id,
    title: value.title,
    emoji: GROUP_EMOJIS[index] ?? "📌",
    questions: value.questions,
  }));

  return { groups, tree: root, warnings };
}

export function buildTreeFromGroups(groups: FootprintGroup[]): FootprintTreeNode[] {
  return groups.map((group) => ({
    id: group.id,
    title: group.title,
    kind: "category",
    level: 0,
    groupId: group.id,
    children: group.questions.map((question, questionIndex) => ({
      id: `${group.id}/q-${questionIndex + 1}`,
      title: question,
      kind: "question",
      question,
      groupId: group.id,
      level: 1,
      children: [],
    })),
  }));
}

function parseCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (char === '"') {
      const next = input[index + 1];
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && input[index + 1] === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, "_");
}

function isLevelHeader(header: string) {
  return /^(level|nav)(_|-)?\d*$/.test(header) || ["category", "group", "section", "theme"].includes(header);
}

function getLevelOrder(header: string) {
  const match = header.match(/(\d+)/);
  if (match) {
    return Number(match[1]);
  }

  const staticOrder: Record<string, number> = {
    category: 1,
    group: 2,
    section: 3,
    theme: 4,
  };

  return staticOrder[header] ?? 99;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
