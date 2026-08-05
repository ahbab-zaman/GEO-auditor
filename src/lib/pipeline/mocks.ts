import type { PillarResult } from "@/types/audit";

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
