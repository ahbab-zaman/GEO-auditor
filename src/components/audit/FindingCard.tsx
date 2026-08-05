import { CircleSlash } from "lucide-react";
import type { CheckResult } from "@/types/audit";
import { EvidenceBlock } from "@/components/audit/EvidenceBlock";

const SEVERITY_STYLES: Record<CheckResult["severity"], string> = {
  pass: "bg-pass-light text-pass-foreground",
  warning: "bg-warning-light text-warning-foreground",
  critical: "bg-critical-light text-critical-foreground",
};

const SEVERITY_LABELS: Record<CheckResult["severity"], string> = {
  pass: "Pass",
  warning: "Needs work",
  critical: "Critical",
};

export function FindingCard({
  finding,
  ownDomain,
}: {
  finding: CheckResult;
  ownDomain?: string;
}) {
  if (finding.status === "unavailable") {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
        <div className="flex items-center gap-2 text-text-muted">
          <CircleSlash className="h-4 w-4" aria-hidden />
          <h4 className="text-sm font-semibold">{finding.label}</h4>
        </div>
        <p className="mt-2 text-sm text-text-secondary">
          {finding.unavailableReason ?? "This check could not be completed."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-card transition-shadow hover:shadow-card-hover">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs ${SEVERITY_STYLES[finding.severity]}`}>
          {SEVERITY_LABELS[finding.severity]}
        </span>
        <h4 className="text-sm font-semibold text-text-primary">{finding.label}</h4>
      </div>
      <p className="mt-3 text-sm leading-6 text-text-secondary">{finding.finding}</p>
      <div className="mt-3">
        <EvidenceBlock evidence={finding.evidence} ownDomain={ownDomain} />
      </div>
    </div>
  );
}