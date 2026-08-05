import type { PillarResult } from "@/types/audit";
import { FindingCard } from "@/components/audit/FindingCard";

export function PillarBreakdown({
  pillar,
  ownDomain,
}: {
  pillar: PillarResult;
  ownDomain?: string;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-base font-semibold leading-6 text-text-primary">{pillar.label}</h3>
        <span className="text-sm text-text-muted">
          {pillar.pointsEarned} / {pillar.pointsPossible} pts
        </span>
      </div>
      {pillar.status === "unavailable" ? (
        <div className="rounded-xl border border-border bg-surface p-6">
          <p className="text-sm text-text-secondary">
            {pillar.unavailableReason ?? "This pillar could not be completed."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pillar.checks.map((check) => (
            <FindingCard key={check.id} finding={check} ownDomain={ownDomain} />
          ))}
        </div>
      )}
    </section>
  );
}