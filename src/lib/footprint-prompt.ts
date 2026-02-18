export function buildFootprintPrompt(
  companyName: string,
  productionUrl: string
): string {
  return `Perform a thorough digital footprint and authority analysis for the following company.

Company: ${companyName}
Website: ${productionUrl}

Instructions:

1. Browse the company's production website at ${productionUrl}. Examine the homepage, about page, and any key product/service pages to understand what the company does, how it positions itself, and what claims it makes.

2. Search the web for "${companyName}" to find third-party references: press coverage, industry directories, review sites, social media presence, partnership announcements, and any notable mentions or criticisms.

3. Cross-reference what the company says about itself on its website with what independent sources say. Prioritize verifiable, third-party information over self-reported claims.

4. For each field in your response:
   - "known_for": List the primary themes, products, or services this company is publicly recognized for. Base this on both website content and external mentions.
   - "industry_context": Identify the primary industry and any secondary verticals based on the website content and how third parties categorize the company.
   - "competitors": Name direct competitors found through industry comparisons, review sites, or "alternatives to" searches. Only include competitors you can verify exist.
   - "partnerships_or_associations": List verified partnerships, integrations, or organizational memberships found on the website or in press releases.
   - "common_criticisms": Note recurring negative themes from reviews, forums, or press. If none are found, return an empty array.
   - "overall_authority_assessment": Rate the company's digital authority as "low", "medium", or "high" based on the totality of evidence — website quality, third-party coverage, backlink presence, social proof, and industry recognition. Provide a specific justification citing what you found.

5. Confidence scoring:
   - 0.9-1.0: Verified by multiple independent sources
   - 0.7-0.8: Found in at least one credible third-party source
   - 0.5-0.6: Mentioned on the company's own website but not independently verified
   - 0.3-0.4: Inferred from indirect evidence
   - Below 0.3: Do not include — the information is too uncertain

6. Quality rules:
   - Never fabricate information. If you cannot find data for a field, return an empty array or state "Insufficient data" in the justification.
   - Do not speculate beyond what is publicly verifiable.
   - Prefer specificity over vagueness (e.g., "enterprise cloud security" over "technology").`;
}

export type FootprintResponse = {
  known_for: { theme: string; confidence: number }[];
  industry_context: {
    primary: string;
    secondary: string[];
  };
  competitors: { name: string; confidence: number }[];
  partnerships_or_associations: {
    entity: string;
    type: "company" | "organization" | "technology" | "other";
    confidence: number;
  }[];
  common_criticisms: { theme: string; confidence: number }[];
  overall_authority_assessment: {
    strength: "low" | "medium" | "high";
    justification: string;
  };
};

export const FOOTPRINT_JSON_SCHEMA = {
  type: "json_schema" as const,
  name: "digital_footprint",
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
          },
          required: ["theme", "confidence"],
          additionalProperties: false,
        },
      },
      industry_context: {
        type: "object",
        properties: {
          primary: { type: "string" },
          secondary: {
            type: "array",
            items: { type: "string" },
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
          },
          required: ["name", "confidence"],
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
          },
          required: ["entity", "type", "confidence"],
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
          },
          required: ["theme", "confidence"],
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
        },
        required: ["strength", "justification"],
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
