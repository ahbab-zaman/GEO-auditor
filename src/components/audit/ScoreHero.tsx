import type { PillarResult } from "@/types/audit";
import { getSeverityColor } from "@/lib/utils";

const BAR_STYLES: Record<"pass" | "warning" | "critical", string> = {
  pass: "bg-pass",
  warning: "bg-warning",
  critical: "bg-critical",
};

const RING_STYLES: Record<"pass" | "warning" | "critical", string> = {
  pass: "bg-pass",
  warning: "bg-warning",
  critical: "bg-critical",
};

export function ScoreHero({
  score,
  businessName,
  url,
  pillars,
}: {
  score: number;
  businessName: string;
  url: string;
  pillars: PillarResult[];
}) {
  const severity = getSeverityColor(score);
  const ringColor = RING_STYLES[severity];

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-xl font-bold text-text-primary">{businessName}</h2>
      <p className="text-sm text-text-muted">{url}</p>
      <div className="mt-6 flex items-center gap-6">
        <div
          className={`flex h-[140px] w-[140px] flex-col items-center justify-center rounded-full ${ringColor} p-1`}
        >
          <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-surface">
            <span className="text-[48px] font-bold leading-[52px] text-text-primary">{score}</span>
            <span className="text-sm text-text-muted">/ 100</span>
          </div>
        </div>
        <div className="flex-1 space-y-3">
          {pillars.map((pillar) => {
            const barSeverity = getSeverityColor(
              pillar.pointsPossible ? Math.round((pillar.pointsEarned / pillar.pointsPossible) * 100) : 0,
            );
            const width = pillar.pointsPossible
              ? Math.round((pillar.pointsEarned / pillar.pointsPossible) * 100)
              : 0;
            return (
              <div key={pillar.key}>
                <div className="flex justify-between text-xs text-text-muted">
                  <span>{pillar.label}</span>
                  <span>
                    {pillar.pointsEarned} / {pillar.pointsPossible}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-border-light">
                  <div
                    className={`h-2 rounded-full ${BAR_STYLES[barSeverity]}`}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}