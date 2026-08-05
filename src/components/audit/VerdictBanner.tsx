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
            Report JSON
          </p>
          <p className="mt-1 text-lg font-semibold text-text-primary">
            Structured audit summary
          </p>
        </div>
        <span className="rounded-full bg-surface px-3 py-1 text-xs text-text-secondary ring-1 ring-inset ring-border">
          no generic verdict prose
        </span>
      </div>
      <ul className="mt-5 space-y-3 text-sm text-text-secondary">
        <li>
          <span className="font-mono text-text-primary">&quot;businessName&quot;</span>:{" "}
          {audit.businessName}
        </li>
        <li>
          <span className="font-mono text-text-primary">&quot;url&quot;</span>: {audit.url}
        </li>
        <li>
          <span className="font-mono text-text-primary">&quot;score&quot;</span>: {audit.score.total} /{" "}
          {audit.score.maxTotal}
        </li>
        <li>
          <span className="font-mono text-text-primary">&quot;status&quot;</span>: {audit.status}
        </li>
        <li>
          <span className="font-mono text-text-primary">&quot;pillarScores&quot;</span>
          <ul className="mt-2 space-y-2 pl-5">
            {pillars.map((pillar) => (
              <li key={pillar.key} className="list-disc">
                <span className="font-mono text-text-primary">
                  &quot;{pillar.label}&quot;
                </span>
                :{" "}
                {pillar.score}
                {pillar.status === "unavailable" && pillar.unavailableReason ? (
                  <span className="block pt-1 text-xs text-text-muted">
                    note: {pillar.unavailableReason}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </li>
        {fixes.length > 0 && (
          <li>
            <span className="font-mono text-text-primary">&quot;topFixes&quot;</span>
            <ul className="mt-2 space-y-2 pl-5">
              {fixes.map((fix) => (
                <li key={fix.title} className="list-disc">
                  <span className="font-mono text-text-primary">
                    &quot;{fix.title}&quot;
                  </span>
                  : impact{" "}
                  {fix.impact}, effort {fix.effort}
                </li>
              ))}
            </ul>
          </li>
        )}
      </ul>
    </section>
  );
}
