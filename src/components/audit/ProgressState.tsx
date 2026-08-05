import type { AuditStatus } from "@/types/audit";

const STAGE_LABELS: Record<Exclude<AuditStatus, "complete" | "failed">, string> = {
  pending: "Preparing your audit",
  scraping: "Reading your website",
  analyzing: "Asking AI what it knows about you",
};

export function ProgressState({ status }: { status: AuditStatus }) {
  const label =
    status === "analyzing"
      ? STAGE_LABELS.analyzing
      : status === "scraping"
        ? STAGE_LABELS.scraping
        : STAGE_LABELS.pending;

  return (
    <div className="flex w-full max-w-md flex-col items-center rounded-xl border border-border bg-surface p-6 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
      <p className="mt-4 text-sm font-medium text-text-primary">{label}</p>
      <p className="mt-1 text-xs text-text-muted">This usually takes under a minute.</p>
    </div>
  );
}