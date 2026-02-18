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
};

export type FootprintGroup = {
  id: string;
  title: string;
  emoji: string;
  questions: string[];
};

export const FOOTPRINT_GROUPS: FootprintGroup[] = [
  {
    id: "core_identity",
    title: "Core Identity & Baseline",
    emoji: "1️⃣",
    questions: [
      "How would you describe the company in one sentence?",
      "What type of company is this?",
      "What primary problem does this company solve?",
      "Who is the main target audience?",
      "What industry does the company belong to?",
      "Is the company B2B, B2C, or both?",
      "What geographic market does it primarily operate in?",
      "What keywords best describe this company?",
      "What category would AI place this company in?",
      "What is the simplest explanation of what this company does?",
    ],
  },
  {
    id: "products_services",
    title: "Products & Services",
    emoji: "2️⃣",
    questions: [
      "What are the core services or products offered?",
      "Which service appears to be the primary revenue driver?",
      "Are the offerings standardized or customized?",
      "What specific outcomes does the company promise?",
      "Are the services technical, strategic, creative, or operational?",
      "What level of complexity do the offerings suggest?",
      "Does the company sell projects, retainers, or products?",
      "Are there clear pricing signals (premium, mid-market, budget)?",
      "What client size seems targeted?",
      "What adjacent services could logically expand the offering?",
    ],
  },
  {
    id: "positioning_differentiation",
    title: "Positioning & Differentiation",
    emoji: "3️⃣",
    questions: [
      "How is the company positioned compared to typical competitors?",
      "What makes this company different?",
      "Is the positioning niche or broad?",
      "What specialization (if any) is implied?",
      "What unique angle is communicated?",
      "What positioning weaknesses exist?",
      "Is the messaging outcome-driven or feature-driven?",
      "Does the company position itself as expert, partner, or vendor?",
      "What claim appears strongest?",
      "What claim appears weakest?",
    ],
  },
  {
    id: "competitive_landscape",
    title: "Competitive Landscape",
    emoji: "4️⃣",
    questions: [
      "Who are the most likely direct competitors?",
      "What type of companies would clients compare this to?",
      "What larger players compete indirectly?",
      "What local competitors might overlap?",
      "What global competitors might overlap?",
      "What alternatives might customers consider?",
      "What substitute solutions compete with this company?",
      "Is the company competing on quality, price, or specialization?",
      "Which competitor type poses the biggest threat?",
      "Where does the company likely lose deals?",
    ],
  },
  {
    id: "brand_perception",
    title: "Brand Perception & Tone",
    emoji: "5️⃣",
    questions: [
      "How would you describe the brand personality?",
      "What tone of voice is implied?",
      "Does the brand feel premium, mid-tier, or budget?",
      "Is the brand perceived as innovative or traditional?",
      "Is the communication confident or cautious?",
      "Does the company appear ambitious or conservative?",
      "Is the messaging clear or vague?",
      "What emotions does the brand evoke?",
      "Does the brand appear trustworthy?",
      "What brand archetype fits best?",
    ],
  },
  {
    id: "authority_credibility",
    title: "Authority & Credibility",
    emoji: "6️⃣",
    questions: [
      "What signals of credibility are visible?",
      "Does the company appear well-established?",
      "Is there evidence of industry recognition?",
      "Are partnerships or integrations implied?",
      "Does the company appear thought-leading?",
      "Is there social proof?",
      "Does the website suggest strong expertise?",
      "Are case studies or proof points implied?",
      "What authority gaps exist?",
      "How strong is overall digital authority?",
    ],
  },
  {
    id: "strengths_weaknesses",
    title: "Strengths & Weaknesses",
    emoji: "7️⃣",
    questions: [
      "What are the strongest perceived capabilities?",
      "What are the weakest perceived areas?",
      "What risks might clients associate with this company?",
      "What unclear messaging elements exist?",
      "What assumptions are being made about the company?",
      "What operational weaknesses might exist?",
      "What scalability challenges might exist?",
      "What strategic risks might exist?",
      "What reputation risks might exist?",
      "What improvement areas are most obvious?",
    ],
  },
  {
    id: "market_growth",
    title: "Market & Growth Signals",
    emoji: "8️⃣",
    questions: [
      "Does the company appear growth-oriented?",
      "What signals suggest maturity level?",
      "Does the company appear innovative?",
      "What expansion opportunities seem logical?",
      "What partnerships would strengthen positioning?",
      "What verticals could they expand into?",
      "What geographic expansion seems plausible?",
      "What pricing strategy seems implied?",
      "What business model evolution seems likely?",
      "What future positioning risks exist?",
    ],
  },
  {
    id: "ai_search_framing",
    title: "AI Search Framing & Narrative",
    emoji: "9️⃣",
    questions: [
      "How would AI summarize this company in a search result?",
      "What three phrases would AI associate most strongly?",
      "What recurring themes define the company?",
      "What narrative would AI construct?",
      "How would AI categorize the company in a comparison table?",
      "What misconceptions might AI form?",
      "What overgeneralizations might occur?",
      "What missing data limits accurate classification?",
      "How might AI incorrectly compare this company?",
      "What corrections would improve AI understanding?",
    ],
  },
  {
    id: "adversarial_hallucination",
    title: "Adversarial / Hallucination Testing",
    emoji: "🔟",
    questions: [
      "What incorrect assumptions could AI make?",
      "What industry might AI wrongly associate the company with?",
      "What competitor might be incorrectly assigned?",
      "What service might AI hallucinate?",
      "What exaggerated claims might AI infer?",
      "What underestimation might AI make?",
      "What ambiguity could cause misclassification?",
      "What signals could mislead AI systems?",
      "Where is the information too sparse for confident judgment?",
      "What would you need to increase confidence to 0.9+?",
    ],
  },
];

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
- The "questions" array must contain exactly 10 items, one per question above, in order.
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
