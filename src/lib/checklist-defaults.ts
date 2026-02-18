export const GROUP_ORDER = [
  "Content & Links",
  "Media & Accessibility",
  "SEO & Analytics",
  "Performance & Compatibility",
] as const;

export const DEFAULT_CHECKLIST_ITEMS: Array<{
  group_name: string;
  label: string;
  position: number;
  irrelevant: boolean;
}> = [
  { group_name: "Content & Links", label: "Check for broken links", position: 0, irrelevant: false },
  { group_name: "Content & Links", label: "Check social media links", position: 1, irrelevant: false },
  { group_name: "Content & Links", label: "Verify contact forms work", position: 2, irrelevant: false },
  { group_name: "Content & Links", label: "Review content for spelling and grammar", position: 3, irrelevant: false },
  { group_name: "Content & Links", label: "Verify legal pages (Privacy Policy, Terms)", position: 4, irrelevant: false },

  { group_name: "Media & Accessibility", label: "Optimize images (compression, correct sizing)", position: 0, irrelevant: false },
  { group_name: "Media & Accessibility", label: "Add alt text to all images", position: 1, irrelevant: false },
  { group_name: "Media & Accessibility", label: "Check favicon and webclip setup", position: 2, irrelevant: false },
  { group_name: "Media & Accessibility", label: "Develop a 404 page", position: 3, irrelevant: false },

  { group_name: "SEO & Analytics", label: "Set up Google Analytics", position: 0, irrelevant: true },
  { group_name: "SEO & Analytics", label: "Configure SEO meta tags (Title, Description, OG image)", position: 1, irrelevant: false },
  { group_name: "SEO & Analytics", label: "Implement schema markup", position: 2, irrelevant: false },

  { group_name: "Performance & Compatibility", label: "Check mobile responsiveness", position: 0, irrelevant: false },
  { group_name: "Performance & Compatibility", label: "Test loading speed", position: 1, irrelevant: false },
  { group_name: "Performance & Compatibility", label: "Check browser compatibility", position: 2, irrelevant: false },
];
