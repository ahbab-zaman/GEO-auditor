import type { PillarResult } from "@/types/audit";

export function getMockLiveAiCitation(
  businessName: string,
  url: string,
): PillarResult {
  return {
    key: "liveAiCitation",
    label: "Live AI Citation Test",
    status: "complete",
    pointsEarned: 15,
    pointsPossible: 45,
    checks: [
      {
        id: "brand-recall",
        label: "Brand recall",
        pointsEarned: 10,
        pointsPossible: 15,
        finding: `${businessName} appeared in some AI answers to category questions, but not all.`,
        evidence: {
          type: "citations",
          query: "best local service provider near me",
          answerText: "This is a placeholder AI answer. It may or may not mention the business.",
          citedUrls: [url, "https://example.com/review"],
          businessCited: true,
        },
        severity: "warning",
        status: "complete",
      },
      {
        id: "domain-citation-rate",
        label: "Own-domain citation rate",
        pointsEarned: 0,
        pointsPossible: 20,
        finding: `The AI did not cite ${businessName}'s own website in any answer.`,
        evidence: {
          type: "citations",
          query: "is this business any good",
          answerText: "This is a placeholder AI answer that does not cite the business's own site.",
          citedUrls: ["https://example.com/other-review"],
          businessCited: false,
        },
        severity: "critical",
        status: "complete",
      },
      {
        id: "description-accuracy",
        label: "AI description accuracy",
        pointsEarned: 5,
        pointsPossible: 10,
        finding: "AI descriptions of the business are partially accurate.",
        evidence: {
          type: "quote",
          source: url,
          text: "Placeholder homepage excerpt used to compare against the AI's description.",
        },
        severity: "warning",
        status: "complete",
      },
    ],
  };
}

export function getMockThirdPartyCorroboration(): PillarResult {
  return {
    key: "thirdPartyCorroboration",
    label: "Third-Party Corroboration",
    status: "complete",
    pointsEarned: 10,
    pointsPossible: 20,
    checks: [
      {
        id: "external-presence",
        label: "External mentions",
        pointsEarned: 10,
        pointsPossible: 20,
        finding: "A couple of other websites mention this business, but not many.",
        evidence: {
          type: "citations",
          query: "what do people say about this business",
          answerText: "This is a placeholder AI answer listing external sources.",
          citedUrls: ["https://example.com/listing", "https://example.com/review"],
          businessCited: false,
        },
        severity: "warning",
        status: "complete",
      },
    ],
  };
}
