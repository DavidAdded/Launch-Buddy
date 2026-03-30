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

export type FootprintFullResponse = {
  groups: GroupResponse[];
  group_meta?: FootprintGroup[];
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
  productionUrl: string
): string {
  const numberedQuestions = group.questions
    .map((q, i) => `${i + 1}. ${q}`)
    .join("\n");

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
