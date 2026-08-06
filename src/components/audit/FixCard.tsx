"use client";

import { useState } from "react";
import type { Fix } from "@/types/audit";

const IMPACT_STYLES: Record<Fix["impact"], string> = {
  high: "bg-accent-light text-accent",
  medium: "bg-surface-secondary text-text-secondary",
  low: "bg-surface-secondary text-text-secondary",
};

const EFFORT_STYLES: Record<Fix["effort"], string> = {
  low: "bg-pass-light text-pass-foreground",
  medium: "bg-warning-light text-warning-foreground",
  high: "bg-critical-light text-critical-foreground",
};

export function FixCard({
  fix,
  finding,
}: {
  fix: Fix;
  finding?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!fix.copyPasteContent) return;
    try {
      await navigator.clipboard.writeText(fix.copyPasteContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-card transition-shadow hover:shadow-card-hover">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold text-text-primary">{fix.title}</h4>
        <span className={`rounded-full px-2 py-0.5 text-xs ${IMPACT_STYLES[fix.impact]}`}>
          impact: {fix.impact}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs ${EFFORT_STYLES[fix.effort]}`}>
          effort: {fix.effort}
        </span>
      </div>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-text-secondary">
        {finding && (
          <li>
            <span className="font-semibold text-text-primary">Why it matters here:</span>{" "}
            {finding}
          </li>
        )}
        <li>
          <span className="font-semibold text-text-primary">Explanation:</span> {fix.explanation}
        </li>
      </ul>
      {fix.copyPasteContent && (
        <div className="mt-3 rounded-lg bg-code-bg px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
            Copy-paste block
          </p>
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-sm text-code-text">
            {fix.copyPasteContent}
          </pre>
          <button
            onClick={copy}
            className="mt-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}
