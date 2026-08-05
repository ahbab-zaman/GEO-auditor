import { Globe, Search } from "lucide-react";
import type { AuditStatus } from "@/types/audit";

const STAGE: Record<
  Exclude<AuditStatus, "complete" | "failed">,
  { label: string; Icon: typeof Globe }
> = {
  pending: { label: "Preparing your audit", Icon: Globe },
  scraping: { label: "Reading your website", Icon: Globe },
  analyzing: { label: "Asking a real AI what it knows about you", Icon: Search },
};

export function ProgressState({ status }: { status: AuditStatus }) {
  const stage =
    status === "analyzing" ? STAGE.analyzing : status === "scraping" ? STAGE.scraping : STAGE.pending;
  const { label, Icon } = stage;

  return (
    <div className="flex w-full max-w-md flex-col items-center rounded-xl border border-border bg-surface p-6 text-center">
      <Icon className="h-8 w-8 animate-breathe text-text-muted" aria-hidden />
      <p className="mt-4 text-sm text-text-secondary">{label}</p>
    </div>
  );
}