import type { Audit } from "@/types/audit";
import { summarizeFixes, summarizePillars } from "@/lib/pipeline/reportPresentation";

export function VerdictBanner({ audit }: { audit: Audit }) {
  const pillars = summarizePillars(audit.pillars);
  const fixes = summarizeFixes(audit);
  return (
    <section className="rounded-2xl border border-border bg-surface-secondary px-6 py-6 shadow-card">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
            Requirement Summary
          </p>
          <p className="mt-1 text-lg font-semibold text-text-primary">
            What the site currently meets and what it still needs to satisfy
          </p>
        </div>
      </div>
      <ul className="mt-5 space-y-3 text-sm text-text-secondary">
        <li>
          <span className="font-semibold text-text-primary">Business:</span>{" "}
          {audit.businessName}
        </li>
        <li>
          <span className="font-semibold text-text-primary">Website:</span> {audit.url}
        </li>
        <li>
          <span className="font-semibold text-text-primary">Score:</span> {audit.score.total} /{" "}
          {audit.score.maxTotal}
        </li>
        <li>
          <span className="font-semibold text-text-primary">Status:</span> {audit.status}
        </li>
        <li>
          <span className="font-semibold text-text-primary">Pillar scores:</span>
          <ul className="mt-2 space-y-2 pl-5">
            {pillars.map((pillar) => (
              <li key={pillar.key} className="list-disc">
                <span className="font-semibold text-text-primary">{pillar.label}:</span>{" "}
                {pillar.score}
                {pillar.status === "unavailable" && pillar.unavailableReason ? (
                  <span className="block pt-1 text-xs text-text-muted">
                    Note: {pillar.unavailableReason}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </li>
        {fixes.length > 0 && (
          <li>
            <span className="font-semibold text-text-primary">Requirements not yet met:</span>
            <ul className="mt-2 space-y-2 pl-5">
              {fixes.map((fix) => (
                <li key={fix.title} className="list-disc">
                  <span className="font-semibold text-text-primary">{fix.title}</span>
                  <span className="text-text-secondary">
                    {" "}
                    - impact {fix.impact}, effort {fix.effort}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        )}
      </ul>
    </section>
  );
}
