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
      <blockquote className="border-l-4 border-border bg-quote-bg px-4 py-3 text-sm italic text-text-secondary">
        <p className="text-xs text-text-muted">Source: {evidence.source}</p>
        <p className="mt-1">{evidence.text}</p>
      </blockquote>
    );
  }

  if (evidence.type === "code") {
    return (
      <div className="rounded-lg bg-code-bg px-4 py-3">
        <p className="text-xs text-text-muted">Source: {evidence.source}</p>
        <pre className="mt-1 overflow-x-auto font-mono text-sm text-code-text">{evidence.snippet}</pre>
      </div>
    );
  }

  if (evidence.type === "absence") {
    return (
      <div className="rounded-lg bg-surface-secondary px-4 py-3">
        <p className="text-xs text-text-muted">Source: {evidence.source}</p>
        <p className="mt-1 text-sm italic text-text-secondary">{evidence.note}</p>
      </div>
    );
  }

  const ownCited = evidence.citedUrls.some((uri) => resolveCitationDomain(uri) === ownDomain);

  return (
    <div className="rounded-lg bg-surface-secondary px-4 py-3">
      <p className="text-xs text-text-muted">Query: {evidence.query}</p>
      <p className="mt-2 border-l-2 border-border pl-3 text-[13px] italic leading-5 text-text-secondary">
        {evidence.answerText}
      </p>
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