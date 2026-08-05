import type { Evidence } from "@/types/audit";

function resolveCitationDomain(uri: string): string {
  try {
    return new URL(uri).hostname.replace(/^www\./, "");
  } catch {
    return uri;
  }
}

export function EvidenceBlock({
  evidence,
  ownDomain,
}: {
  evidence: Evidence;
  ownDomain?: string;
}) {
  if (evidence.type === "quote") {
    return (
      <div className="rounded-lg bg-quote-bg px-4 py-3 text-sm text-text-secondary">
        <ul className="space-y-2">
          <li>
            <span className="font-semibold text-text-primary">Source:</span> {evidence.source}
          </li>
          <li>
            <span className="font-semibold text-text-primary">Quote:</span> {evidence.text}
          </li>
        </ul>
      </div>
    );
  }

  if (evidence.type === "code") {
    return (
      <div className="rounded-lg bg-code-bg px-4 py-3">
        <ul className="space-y-2 text-sm text-code-text">
          <li>
            <span className="font-semibold text-text-primary">Source:</span> {evidence.source}
          </li>
          <li>
            <span className="font-semibold text-text-primary">Snippet:</span>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-sm text-code-text">
              {evidence.snippet}
            </pre>
          </li>
        </ul>
      </div>
    );
  }

  if (evidence.type === "absence") {
    return (
      <div className="rounded-lg bg-surface-secondary px-4 py-3">
        <ul className="space-y-2 text-sm text-text-secondary">
          <li>
            <span className="font-semibold text-text-primary">Source:</span> {evidence.source}
          </li>
          <li>
            <span className="font-semibold text-text-primary">Note:</span> {evidence.note}
          </li>
        </ul>
      </div>
    );
  }

  const ownCited = evidence.citedUrls.some((uri) => resolveCitationDomain(uri) === ownDomain);

  return (
    <div className="rounded-lg bg-surface-secondary px-4 py-3">
      <ul className="space-y-2 text-sm text-text-secondary">
        <li>
          <span className="font-semibold text-text-primary">Query:</span> {evidence.query}
        </li>
        <li>
          <span className="font-semibold text-text-primary">Answer:</span> {evidence.answerText}
        </li>
        <li>
          <span className="font-semibold text-text-primary">Cited domains:</span>{" "}
          {evidence.citedUrls.map((uri) => resolveCitationDomain(uri)).join(", ") || "none"}
        </li>
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {ownDomain &&
          (ownCited ? null : (
            <span className="rounded-full bg-critical-light px-2.5 py-0.5 text-xs text-critical-foreground">
              Your site: not cited
            </span>
          ))}
        {evidence.citedUrls.map((uri) => {
          const domain = resolveCitationDomain(uri);
          const isOwn = Boolean(ownDomain) && domain === ownDomain;
          return (
            <span
              key={uri}
              className={`rounded-full px-2.5 py-0.5 text-xs ${
                isOwn
                  ? "bg-accent-light text-accent"
                  : "bg-surface text-text-secondary ring-1 ring-inset ring-border"
              }`}
            >
              {domain}
            </span>
          );
        })}
      </div>
    </div>
  );
}
