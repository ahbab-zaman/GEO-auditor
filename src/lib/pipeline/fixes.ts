import type { CheckResult, Fix } from "@/types/audit";
import { EFFORT_BY_CHECK_ID, priorityScore } from "@/lib/utils";

export const COPY_PASTE_CONTENT_BY_CHECK_ID: Partial<Record<string, string>> = {
  "ai-crawler-access": [
    "# geo-auditor: allow AI search engines to read your site",
    "User-agent: GPTBot",
    "Allow: /",
    "",
    "User-agent: ClaudeBot",
    "Allow: /",
    "",
    "User-agent: PerplexityBot",
    "Allow: /",
    "",
    "User-agent: Google-Extended",
    "Allow: /",
  ].join("\n"),
  "schema-presence": [
    "<script type=\"application/ld+json\">",
    "{",
    "  \"@context\": \"https://schema.org\",",
    "  \"@type\": \"LocalBusiness\",",
    "  \"name\": \"YOUR BUSINESS NAME\",",
    "  \"description\": \"What you do and who it is for\",",
    "  \"url\": \"https://your-site.example\",",
    "  \"telephone\": \"+1-555-555-5555\"",
    "}",
    "</script>",
  ].join("\n"),
};

export const TITLE_BY_CHECK_ID: Partial<Record<string, string>> = {
  "ai-crawler-access": "Let AI search engines read your site",
  "schema-presence": "Add structured data about your business",
  "direct-answer-clarity": "Say what you do in one sentence up front",
  "faq-presence": "Add a question-and-answer section",
  "brand-recall": "Make it easier for AI to recall your name",
  "domain-citation-rate": "Give AI engines reasons to cite your website",
  "description-accuracy": "Make your site accurately describe your business",
  "external-presence": "Get mentioned by independent websites",
};

export const EXPLANATION_BY_CHECK_ID: Partial<Record<string, string>> = {
  "ai-crawler-access":
    "Your robots.txt blocks one or more AI search engines from reading your site, so they can never mention or cite you. Add the ready-to-paste block below to allow the major AI crawlers — then your content is eligible to be read and cited.",
  "schema-presence":
    "Structured data tells AI assistants who you are, what you do, and where you are, in a format they can read reliably. Paste the JSON-LD block below into your homepage HTML and replace the placeholder name, description, URL, and phone with your real details.",
  "direct-answer-clarity":
    "AI assistants quote and summarize the opening of a page. Right after your headline, add one plain sentence stating what your business does and who it is for, so the AI can extract it directly instead of guessing.",
  "faq-presence":
    "AI assistants look for explicit question-and-answer content when summarizing a business. Add a short FAQ with real questions customers ask — it gives AI ready-made, accurate answers to pull from.",
  "brand-recall":
    "When people asked an AI for recommendations in your category, it did not name your business. Keep your business name and category language consistent across your site, local listings, reviews, and directories so your name surfaces wherever your type of business is discussed.",
  "domain-citation-rate":
    "When AI answered questions about you, it did not cite your own website. Publish clear, up-to-date pages describing what you do, keep your business name and address consistent across the web, and add structured data — this gives AI a trustworthy page to cite.",
  "description-accuracy":
    "The AI described your business inconsistently with your own site. Check that your homepage accurately reflects what you actually do — wrong products, services, location, or audience cause AI to describe you incorrectly.",
  "external-presence":
    "No independent websites — reviews, directories, news, or local listings — mention your business, and AI relies on those third-party sources to corroborate you. Get listed on review platforms, local directories, and industry sites so credible external sources exist.",
};

export function deriveFixes(checks: CheckResult[]): Fix[] {
  const fixes: Fix[] = [];
  for (const check of checks) {
    if (check.severity === "pass") continue;
    const effort = EFFORT_BY_CHECK_ID[check.id] ?? "medium";
    const impact = check.pointsPossible >= 15 ? "high" : "medium";
    fixes.push({
      id: `${check.id}-fix`,
      relatedCheckId: check.id,
      title: TITLE_BY_CHECK_ID[check.id] ?? `Fix ${check.label.toLowerCase()}`,
      explanation:
        EXPLANATION_BY_CHECK_ID[check.id] ??
        "This fix needs to be written per-business.",
      impact,
      effort,
      priorityScore: priorityScore(impact, effort),
      copyPasteContent: COPY_PASTE_CONTENT_BY_CHECK_ID[check.id] ?? null,
    });
  }
  return fixes.sort((a, b) => b.priorityScore - a.priorityScore);
}