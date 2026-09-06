export interface DecisionPreset {
  id: string;
  title: string;
  category: string;
  rawInput: string;
  contextHint?: string;
}

export const DECISION_PRESETS: DecisionPreset[] = [
  {
    id: "pricing-shift",
    title: "Usage-Based DevTool Pricing",
    category: "Pricing & Monetization",
    rawInput:
      "Shift from seat-based pricing to pure usage-based metering for developer tools.",
    contextHint: "Targets developer tooling and API infrastructure.",
  },
  {
    id: "gtm-sandbox",
    title: "Enterprise Sandbox vs Free Tier",
    category: "Go-To-Market",
    rawInput:
      "Eliminate the free tier entirely in favor of an interactive enterprise sandbox to stop CAC bleeding.",
    contextHint: "Targets high-touch B2B SaaS buyers with security compliance requirements.",
  },
  {
    id: "oss-adoption",
    title: "Open-Source Platform Core",
    category: "Product Architecture",
    rawInput:
      "Migrate our core platform to open-source to drive grassroots developer adoption before enterprise monetization.",
    contextHint: "Grassroots developer expansion paired with proprietary enterprise management plane.",
  },
  {
    id: "college-ai",
    title: "College Admissions AI Agent",
    category: "EdTech / Consumer",
    rawInput:
      "I want to build an AI that helps students apply to college, including submitting applications on their behalf.",
    contextHint: "Targets high school seniors in the US, covers Common App and direct school portals.",
  },
  {
    id: "unlimited-saas",
    title: "Unlimited Free-Tier AI SaaS",
    category: "B2B SaaS / DevTools",
    rawInput:
      "We should offer an unlimited free tier for our AI coding assistant to acquire developers at zero CAC, monetizing only on enterprise teams.",
    contextHint: "Assumes $0.002 per request inference costs will be offset by top 1% conversions.",
  },
  {
    id: "dentist-seo",
    title: "Micro-SaaS SEO Agent for Dentists",
    category: "Vertical AI / SMB",
    rawInput:
      "A niche vertical AI agent that crawls local dental clinic websites, auto-generates localized patient education blogs, and posts them via WordPress.",
    contextHint: "Targeting $99/mo per clinic, self-serve onboarding with automated schema markup.",
  },
];
