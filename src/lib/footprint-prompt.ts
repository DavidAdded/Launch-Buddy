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
    id: "brand_dna_positioning",
    title: "Brand DNA & Positioning",
    emoji: "1️⃣",
    questions: [
      "What is Oatly?",
      "How would you describe Oatly?",
      "What kind of company is Oatly?",
      "What is Oatly known for?",
      "What does Oatly do?",
      "What does Oatly sell?",
      "What is Oatly’s brand identity?",
      "What does Oatly stand for?",
      "How is Oatly positioned as a brand?",
      "How is Oatly positioned in the market?",
      "What makes Oatly different?",
      "What makes Oatly unique?",
      "How does Oatly differ from other food brands?",
      "How does Oatly differ from other plant-based brands?",
      "What role does Oatly play in the plant-based category?",
    ],
  },
  {
    id: "brand_perception_image",
    title: "Brand Perception & Image",
    emoji: "2️⃣",
    questions: [
      "How is Oatly perceived as a brand?",
      "What is Oatly’s public image?",
      "Is Oatly seen as a premium brand?",
      "Is Oatly seen as a mainstream brand?",
      "Is Oatly seen as a challenger brand?",
      "Is Oatly considered innovative?",
      "Is Oatly considered authentic?",
      "Is Oatly seen as marketing-driven?",
      "Is Oatly seen as purpose-driven?",
      "Is Oatly seen as trendy?",
      "Is Oatly a lifestyle brand?",
      "What kind of consumers are associated with Oatly?",
      "Who typically buys Oatly?",
      "How has Oatly built its brand image?",
      "What emotions or associations are linked to Oatly?",
    ],
  },
  {
    id: "company_business_category_role",
    title: "Company, Business & Category Role",
    emoji: "3️⃣",
    questions: [
      "Is Oatly a food company or a beverage company?",
      "Is Oatly mainly an oat milk brand?",
      "Is Oatly more than oat milk?",
      "What categories does Oatly compete in?",
      "Is Oatly a leader in oat milk?",
      "Is Oatly a leader in plant-based dairy?",
      "How important is Oatly in the oat milk category?",
      "Who are the key players in oat milk?",
      "Which companies lead the plant-based milk category?",
      "Which brands dominate oat milk?",
      "Which brands are most associated with plant-based milk?",
      "Which brands helped popularize oat milk?",
      "What brands are shaping the plant-based dairy category?",
      "Where does Oatly fit in the broader dairy alternatives market?",
    ],
  },
  {
    id: "product_understanding",
    title: "Product Understanding",
    emoji: "4️⃣",
    questions: [
      "What products is Oatly best known for?",
      "What products does Oatly make?",
      "What are Oatly’s main products?",
      "What is Oatly best known for as a product brand?",
      "Is Oatly just oat milk?",
      "What kinds of oat-based products does Oatly sell?",
      "What makes Oatly products different?",
      "How are Oatly products typically described?",
      "What are Oatly’s most popular products?",
      "What is special about Oatly’s oat milk?",
      "What should consumers know about Oatly products?",
    ],
  },
  {
    id: "consumer_choice_decision_support",
    title: "Consumer Choice & Decision Support",
    emoji: "5️⃣",
    questions: [
      "Should I drink oat milk or regular milk?",
      "Should I buy dairy milk or oat milk?",
      "Is oat milk better than milk?",
      "Is oat milk a good alternative to milk?",
      "When should someone choose oat milk over dairy milk?",
      "Who should choose oat milk instead of milk?",
      "Is Oatly a good substitute for milk?",
      "Is Oatly a good alternative to dairy milk?",
      "Should I choose Oatly over regular milk?",
      "Which is better for me, Oatly or milk?",
      "Which is better for everyday use, milk or oat milk?",
      "What are the trade-offs between Oatly and dairy milk?",
    ],
  },
  {
    id: "health_nutrition",
    title: "Health & Nutrition",
    emoji: "6️⃣",
    questions: [
      "Is Oatly healthy?",
      "Is oat milk healthy?",
      "Is Oatly healthier than milk?",
      "Is oat milk healthier than milk?",
      "Is Oatly good for you?",
      "Is Oatly good for everyday use?",
      "Is Oatly highly processed?",
      "Is Oatly ultra-processed?",
      "What are the pros and cons of Oatly?",
      "What are the pros and cons of oat milk?",
      "Is Oatly nutritious?",
      "How does Oatly compare nutritionally to milk?",
      "Does Oatly contain too much sugar?",
      "Is Oatly suitable for people trying to eat healthy?",
      "What should people know about Oatly from a nutrition perspective?",
    ],
  },
  {
    id: "sustainability_climate",
    title: "Sustainability & Climate",
    emoji: "7️⃣",
    questions: [
      "Is Oatly sustainable?",
      "Is oat milk sustainable?",
      "Is Oatly better for the environment than dairy milk?",
      "Is oat milk better for the environment than milk?",
      "Which is better for the climate, dairy milk or oat milk?",
      "Which plant-based milk is most sustainable?",
      "What is Oatly’s sustainability profile?",
      "How sustainable is Oatly compared to dairy?",
      "Is Oatly environmentally friendly?",
      "Is oat milk environmentally friendly?",
      "What are the environmental benefits of Oatly?",
      "What are the environmental criticisms of Oatly?",
      "Are there sustainability concerns about Oatly?",
      "Is oat milk really better for the environment?",
      "What should people know about Oatly from a sustainability perspective?",
    ],
  },
  {
    id: "reputation_criticism_controversy",
    title: "Reputation, Criticism & Controversy",
    emoji: "8️⃣",
    questions: [
      "Why is Oatly controversial?",
      "What criticism has Oatly received?",
      "Is Oatly a controversial brand?",
      "What are the main arguments against Oatly?",
      "Why do some people dislike Oatly?",
      "Has Oatly faced backlash?",
      "What controversies has Oatly been involved in?",
      "What are the main criticisms of Oatly as a company?",
      "What are the main criticisms of Oatly as a brand?",
      "Is Oatly more marketing than substance?",
      "Has Oatly been accused of greenwashing?",
      "Are there reasons to avoid Oatly?",
      "What should people know before buying Oatly?",
      "What are the downsides of Oatly?",
      "What concerns do people have about Oatly?",
    ],
  },
  {
    id: "competitive_framing",
    title: "Competitive Framing",
    emoji: "9️⃣",
    questions: [
      "Who are Oatly’s main competitors?",
      "What brands compete with Oatly?",
      "What are the main alternatives to Oatly?",
      "What are the main alternatives to dairy milk?",
      "What are the main alternatives to oat milk?",
      "Which oat milk brands compete with Oatly?",
      "Which soy milk brands compete with Oatly?",
      "Which almond milk brands compete with Oatly?",
      "Which dairy brands compete most directly with Oatly?",
      "Which plant-based brands compete most directly with Oatly?",
      "Which supermarket own brands compete with Oatly?",
      "What brands are strongest in dairy alternatives?",
      "What brands are strongest in oat milk?",
    ],
  },
  {
    id: "comparative_evaluation",
    title: "Comparative Evaluation",
    emoji: "🔟",
    questions: [
      "Is Oatly better than other oat milk brands?",
      "Is Oatly better than other plant-based milk brands?",
      "Oatly vs dairy milk",
      "Oatly vs cow’s milk",
      "Oatly vs regular milk",
      "Oatly vs other oat milk brands",
      "Oatly vs plant-based milk",
      "Oatly vs soy milk",
      "Oatly vs almond milk",
      "Oatly vs pea milk",
      "Oatly vs lactose-free milk",
      "Oatly vs premium dairy brands",
      "Oatly vs supermarket private label oat milk",
      "Which is better, Oatly or dairy milk?",
      "Which is better, Oatly or soy milk?",
      "Which is better, Oatly or almond milk?",
      "Which is better, Oatly or other oat milk brands?",
    ],
  },
  {
    id: "purchase_preference_recommendation",
    title: "Purchase, Preference & Recommendation",
    emoji: "1️⃣1️⃣",
    questions: [
      "Is Oatly worth buying?",
      "Should I buy Oatly?",
      "When is Oatly a better choice than dairy?",
      "Which oat milk brand is best?",
      "Which plant-based milk brand is best?",
      "Which milk alternative is best?",
      "What is the best alternative to dairy milk?",
      "Is Oatly the best oat milk brand?",
      "When should someone choose Oatly?",
      "Who is Oatly best for?",
      "Who should not choose Oatly?",
      "Is Oatly a good choice for families?",
      "Is Oatly a good choice for coffee?",
      "Is Oatly a good choice for cooking?",
      "Is Oatly a good choice for everyday use?",
      "Would you recommend Oatly?",
      "When is Oatly the wrong choice?",
      "What makes Oatly a good or bad choice?",
    ],
  },
  {
    id: "accuracy_uncertainty_stress_test",
    title: "Accuracy, Uncertainty & Framing Stress-Test",
    emoji: "1️⃣2️⃣",
    questions: [
      "Is Oatly bad for you?",
      "Is Oatly bad for the environment?",
      "Is Oatly unhealthy?",
      "Is Oatly overhyped?",
      "Is Oatly actually sustainable or just marketed that way?",
      "Is Oatly healthier than people think?",
      "Is Oatly less healthy than people think?",
      "Is Oatly mainly a branding success?",
      "Is Oatly a polarizing brand?",
      "What is the biggest misconception about Oatly?",
      "What is the most misunderstood thing about Oatly?",
      "What do people get wrong about Oatly?",
      "Is there misinformation about Oatly?",
      "How balanced is public perception of Oatly?",
      "What is the most nuanced way to understand Oatly?",
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
