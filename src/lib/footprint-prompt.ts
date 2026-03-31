export type Source = {
  url: string;
  title: string;
  type: "company_site" | "press" | "directory" | "review" | "social" | "other";
};

export type AnsweredQuestion = {
  question: string;
  answer: string;
  confidence: number;
  sources: Source[];
};

export type GroupResponse = {
  summary: string;
  questions: AnsweredQuestion[];
};

export type FootprintOriginSummary = {
  summary: string;
  confidence: number;
  sources: Source[];
};

export type FootprintHierarchySnapshotNode = {
  id: string;
  title: string;
  kind: "category" | "question";
  level: number;
  children: FootprintHierarchySnapshotNode[];
  question?: string;
  groupId?: string;
};

export type FootprintNodeAnswer = {
  nodeId: string;
  title: string;
  kind: "category" | "question";
  answer: string;
  confidence: number;
  sources: Source[];
};

export type FootprintFullResponse = {
  groups: GroupResponse[];
  group_meta?: FootprintGroup[];
  hierarchy_tree?: FootprintHierarchySnapshotNode[];
  node_answers?: Record<string, FootprintNodeAnswer>;
  origin_summary?: FootprintOriginSummary;
};

export type FootprintGroup = {
  id: string;
  title: string;
  emoji: string;
  questions: string[];
};

export const FOOTPRINT_GROUPS: FootprintGroup[] = [
  {
    id: "core_brand_image",
    title: "Core Brand Image",
    emoji: "1️⃣",
    questions: [
      "What is Oatly in one clear sentence?",
      "How is Oatly most commonly described as a brand?",
      "What does Oatly stand for in the minds of people and AI systems?",
      "What are the strongest recurring signals in Oatly's core brand image?",
    ],
  },
  {
    id: "associations_positioning",
    title: "Associations & Positioning",
    emoji: "2️⃣",
    questions: [
      "Which ideas, values, or lifestyles are most associated with Oatly?",
      "How is Oatly positioned relative to dairy and other plant-based brands?",
      "Which consumer segments are most strongly associated with Oatly?",
      "What emotional or symbolic associations appear most often around Oatly?",
    ],
  },
  {
    id: "tone_brand_personality",
    title: "Tone & Brand Personality",
    emoji: "3️⃣",
    questions: [
      "How is Oatly's communication tone typically described?",
      "Which personality traits are most frequently attributed to Oatly?",
      "Where is Oatly's tone seen as distinctive versus polarizing?",
    ],
  },
  {
    id: "tensions_criticism",
    title: "Tensions & Criticism",
    emoji: "4️⃣",
    questions: [
      "What are the most common criticisms or skeptical claims about Oatly?",
      "Which tensions or contradictions appear in how Oatly is described?",
      "What perception risks are most likely to harm trust in Oatly?",
    ],
  },
  {
    id: "reasons_choose_avoid",
    title: "Reasons to Choose / Avoid",
    emoji: "5️⃣",
    questions: [
      "What are the strongest reasons to choose Oatly?",
      "What are the strongest reasons to avoid Oatly?",
      "In which use-cases is Oatly typically recommended?",
      "In which use-cases is Oatly typically not recommended?",
      "How does AI frame the trade-offs between Oatly and dairy milk?",
      "How does AI frame the trade-offs between Oatly and other plant-based alternatives?",
    ],
  },
];

export const FOOTPRINT_TOTAL_GROUPS = FOOTPRINT_GROUPS.length;
export const FOOTPRINT_TOTAL_QUESTIONS = FOOTPRINT_GROUPS.reduce(
  (sum, group) => sum + group.questions.length,
  0,
);

export function buildGroupPrompt(
  group: FootprintGroup,
  companyName: string,
  productionUrl: string,
): string {
  const numberedQuestions = group.questions.map((q, i) => `${i + 1}. ${q}`).join("\n");

  return `You are performing a digital footprint & authority analysis for a specific category of questions.

Company: ${companyName}
Website: ${productionUrl}
Category: ${group.title}

QUESTIONS TO ANSWER
${numberedQuestions}

PROCESS
1) Browse ${productionUrl}: homepage, about, key service/product pages.
2) Web search "${companyName}" plus relevant queries for this category.
3) Cross-check self-claims vs third-party mentions. Prefer third-party.

OUTPUT RULES
- Return ONLY valid JSON matching the schema.
- The "summary" field must be a 1-2 sentence overview of findings for this category.
- The "questions" array must contain exactly ${group.questions.length} items, one per question above, in order.
- Each answer should be substantive (2-4 sentences) and specific to this company.
- Every answer MUST include at least 1 source with a real URL.
- If you cannot provide a real source URL for a question, still answer but set confidence below 0.5.
- No guessing, no fabrication of facts or URLs.

CONFIDENCE SCORING
- 0.9–1.0: verified by multiple independent sources
- 0.7–0.8: one credible third-party source
- 0.5–0.6: only company site
- 0.3–0.4: indirect inference
- <0.3: very low confidence, answer is speculative

RETURN JSON ONLY (schema enforced).`;
}

export function buildOriginSummaryPrompt(
  companyName: string,
  productionUrl: string,
  groups: FootprintGroup[],
  responses: GroupResponse[],
): string {
  const categoryDigest = groups
    .map((group, index) => {
      const response = responses[index];
      if (!response) {
        return `- ${group.title}: No category response available.`;
      }

      return [
        `- ${group.title}`,
        `  Summary: ${response.summary}`,
        ...response.questions.map((question) => `  Q: ${question.question}\n  A: ${question.answer}`),
      ].join("\n");
    })
    .join("\n\n");

  const sourcePool = responses
    .flatMap((response) => response.questions)
    .flatMap((question) => question.sources)
    .map((source) => `- ${source.type} | ${source.title} | ${source.url}`)
    .slice(0, 80)
    .join("\n");

  return `You are synthesizing ONE company-level digital footprint summary from already-produced category analyses.

Company: ${companyName}
Website: ${productionUrl}

CATEGORY ANALYSIS INPUT
${categoryDigest}

SOURCE POOL (use only these URLs)
${sourcePool || "- none"}

TASK
Return a single holistic summary for the company as a whole.

OUTPUT RULES
- Return ONLY valid JSON matching the schema.
- "summary": 2-4 sentences, concise but specific.
- "confidence": a number from 0 to 1.
- "sources": include 2-6 strongest supporting sources.
- Source URLs MUST be selected from SOURCE POOL only.
- No fabricated URLs, no markdown, no extra keys.`;
}



export function buildHierarchyNodeSummaryPrompt(
  companyName: string,
  productionUrl: string,
  nodeTitle: string,
  childAnswers: Array<{
    title: string;
    answer: string;
    confidence: number;
    sources: Source[];
  }>,
): string {
  const digest = childAnswers
    .map((child, index) =>
      [
        `${index + 1}. ${child.title}`,
        `   Answer: ${child.answer}`,
        `   Confidence: ${Math.round(child.confidence * 100)}%`,
      ].join("\n"),
    )
    .join("\n\n");

  const sourcePool = childAnswers
    .flatMap((child) => child.sources)
    .map((source) => `- ${source.type} | ${source.title} | ${source.url}`)
    .slice(0, 80)
    .join("\n");

  return `You are synthesizing one hierarchical footprint summary for a parent category node.

Company: ${companyName}
Website: ${productionUrl}
Parent node: ${nodeTitle}

CHILD NODE ANALYSIS
${digest || "- none"}

SOURCE POOL (use only these URLs)
${sourcePool || "- none"}

TASK
Produce one parent-level answer that summarizes the child findings.

OUTPUT RULES
- Return ONLY valid JSON matching the schema.
- "answer": 2-4 sentences, specific and concrete.
- "confidence": number between 0 and 1.
- "sources": include 1-6 strongest sources chosen from SOURCE POOL only.
- Do not invent URLs.
- No markdown and no extra keys.`;
}

const sourceSchema = {
  type: "object",
  properties: {
    url: { type: "string" },
    title: { type: "string" },
    type: {
      type: "string",
      enum: ["company_site", "press", "directory", "review", "social", "other"],
    },
  },
  required: ["url", "title", "type"],
  additionalProperties: false,
} as const;

export const GROUP_JSON_SCHEMA = {
  type: "json_schema" as const,
  name: "footprint_group",
  strict: true,
  schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            question: { type: "string" },
            answer: { type: "string" },
            confidence: { type: "number" },
            sources: { type: "array", items: sourceSchema },
          },
          required: ["question", "answer", "confidence", "sources"],
          additionalProperties: false,
        },
      },
    },
    required: ["summary", "questions"],
    additionalProperties: false,
  },
} as const;

export const NODE_SUMMARY_JSON_SCHEMA = {
  type: "json_schema" as const,
  name: "footprint_node_summary",
  strict: true,
  schema: {
    type: "object",
    properties: {
      answer: { type: "string" },
      confidence: { type: "number" },
      sources: { type: "array", items: sourceSchema },
    },
    required: ["answer", "confidence", "sources"],
    additionalProperties: false,
  },
} as const;

export const ORIGIN_SUMMARY_JSON_SCHEMA = {
  type: "json_schema" as const,
  name: "footprint_origin_summary",
  strict: true,
  schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      confidence: { type: "number" },
      sources: { type: "array", items: sourceSchema },
    },
    required: ["summary", "confidence", "sources"],
    additionalProperties: false,
  },
} as const;
