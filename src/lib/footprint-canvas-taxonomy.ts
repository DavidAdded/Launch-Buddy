export type SuperCategory = {
  id: string;
  title: string;
  description: string;
  groupIds: string[];
};

export type LensDefinition = {
  id: string;
  title: string;
  description: string;
  pattern: RegExp;
};

// High-level test taxonomy for progressive drill-down in the canvas explorer.
export const FOOTPRINT_SUPER_CATEGORIES: SuperCategory[] = [
  {
    id: "core_brand_view",
    title: "Core Brand View",
    description: "Identity, associations, and positioning",
    groupIds: ["core_brand_image", "associations_positioning"],
  },
  {
    id: "voice_and_personality",
    title: "Voice & Personality",
    description: "How the brand voice is framed",
    groupIds: ["tone_brand_personality"],
  },
  {
    id: "risk_tension",
    title: "Risk & Tension",
    description: "Criticism and trust tensions",
    groupIds: ["tensions_criticism"],
  },
  {
    id: "decision_framing",
    title: "Decision Framing",
    description: "Reasons to choose or avoid",
    groupIds: ["reasons_choose_avoid"],
  },
];

export const FOOTPRINT_LENS_DEFINITIONS: LensDefinition[] = [
  {
    id: "identity",
    title: "Identity Signals",
    description: "What Oatly is and stands for",
    pattern: /what is|described|core brand|stand for|brand image|recurring signals/i,
  },
  {
    id: "associations",
    title: "Association Signals",
    description: "Values, positioning, and audience links",
    pattern: /values|lifestyle|positioned|segments|associated|symbolic|emotional/i,
  },
  {
    id: "tone",
    title: "Tone Signals",
    description: "Brand voice and personality traits",
    pattern: /tone|personality|traits|distinctive|polarizing/i,
  },
  {
    id: "criticism",
    title: "Criticism Signals",
    description: "Skepticism and contradiction narratives",
    pattern: /criticism|skeptical|tension|contradictions|risks|trust|avoid/i,
  },
  {
    id: "decision",
    title: "Decision Signals",
    description: "Reasons to choose or avoid by context",
    pattern: /reasons to choose|reasons to avoid|use-cases|trade-offs|recommended|not recommended/i,
  },
];
