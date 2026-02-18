export type Source = {
  url: string;
  title: string;
  type: "company_site" | "press" | "directory" | "review" | "social" | "other";
};

export type FootprintResponseV2 = {
  known_for: { theme: string; confidence: number; sources: Source[] }[];
  industry_context: {
    primary: string;
    secondary: { label: string; confidence: number; sources: Source[] }[];
  };
  competitors: { name: string; confidence: number; sources: Source[] }[];
  partnerships_or_associations: {
    entity: string;
    type: "company" | "organization" | "technology" | "other";
    confidence: number;
    sources: Source[];
  }[];
  common_criticisms: { theme: string; confidence: number; sources: Source[] }[];
  overall_authority_assessment: {
    strength: "low" | "medium" | "high";
    justification: string;
    sources: Source[];
  };
};

export function buildFootprintPromptV2(
  companyName: string,
  productionUrl: string
): string {
  return `You are performing a digital footprint & authority analysis.

Company: ${companyName}
Website: ${productionUrl}

OUTPUT RULES
- Return ONLY valid JSON matching the schema.
- Every non-empty item MUST include at least 1 source with a URL.
- If you cannot provide a real source URL, do not include the item.
- No guessing, no fabrication.

PROCESS
1) Browse ${productionUrl}: homepage, about, key service/product pages.
2) Web search "${companyName}" plus queries for reviews, alternatives/competitors, partnerships/integrations.
3) Cross-check self-claims vs third-party mentions. Prefer third-party.

CONFIDENCE
- 0.9–1.0: multiple independent sources
- 0.7–0.8: one credible third-party source
- 0.5–0.6: only company site
- 0.3–0.4: indirect inference (rare)
- <0.3: omit

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

export const FOOTPRINT_JSON_SCHEMA_V2 = {
  type: "json_schema" as const,
  name: "digital_footprint_v2",
  strict: true,
  schema: {
    type: "object",
    properties: {
      known_for: {
        type: "array",
        items: {
          type: "object",
          properties: {
            theme: { type: "string" },
            confidence: { type: "number" },
            sources: { type: "array", items: sourceSchema },
          },
          required: ["theme", "confidence", "sources"],
          additionalProperties: false,
        },
      },
      industry_context: {
        type: "object",
        properties: {
          primary: { type: "string" },
          secondary: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                confidence: { type: "number" },
                sources: { type: "array", items: sourceSchema },
              },
              required: ["label", "confidence", "sources"],
              additionalProperties: false,
            },
          },
        },
        required: ["primary", "secondary"],
        additionalProperties: false,
      },
      competitors: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            confidence: { type: "number" },
            sources: { type: "array", items: sourceSchema },
          },
          required: ["name", "confidence", "sources"],
          additionalProperties: false,
        },
      },
      partnerships_or_associations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            entity: { type: "string" },
            type: {
              type: "string",
              enum: ["company", "organization", "technology", "other"],
            },
            confidence: { type: "number" },
            sources: { type: "array", items: sourceSchema },
          },
          required: ["entity", "type", "confidence", "sources"],
          additionalProperties: false,
        },
      },
      common_criticisms: {
        type: "array",
        items: {
          type: "object",
          properties: {
            theme: { type: "string" },
            confidence: { type: "number" },
            sources: { type: "array", items: sourceSchema },
          },
          required: ["theme", "confidence", "sources"],
          additionalProperties: false,
        },
      },
      overall_authority_assessment: {
        type: "object",
        properties: {
          strength: {
            type: "string",
            enum: ["low", "medium", "high"],
          },
          justification: { type: "string" },
          sources: { type: "array", items: sourceSchema },
        },
        required: ["strength", "justification", "sources"],
        additionalProperties: false,
      },
    },
    required: [
      "known_for",
      "industry_context",
      "competitors",
      "partnerships_or_associations",
      "common_criticisms",
      "overall_authority_assessment",
    ],
    additionalProperties: false,
  },
} as const;
