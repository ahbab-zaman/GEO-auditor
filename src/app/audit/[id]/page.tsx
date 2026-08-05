"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Audit } from "@/types/audit";
import { ProgressState } from "@/components/audit/ProgressState";
import { VerdictBanner } from "@/components/audit/VerdictBanner";
import { ScoreHero } from "@/components/audit/ScoreHero";
import { PillarBreakdown } from "@/components/audit/PillarBreakdown";
import { FixCard } from "@/components/audit/FixCard";

const PILLAR_ORDER = [
  "structuralAnswerability",
  "liveAiCitation",
  "thirdPartyCorroboration",
] as const;

export default function AuditReportPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [audit, setAudit] = useState<Audit | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const response = await fetch(`/api/audit/${id}`);
        let json: { success?: boolean; data?: Audit; error?: string };
        try {
          json = await response.json();
        } catch {
          if (!cancelled) setError("Could not read the audit response.");
          return;
        }
        if (!json.success) {
          if (!cancelled) setError(json.error ?? "Could not load audit");
          return;
        }
        const data = json.data as Audit;
        if (cancelled) return;
        setAudit(data);
        if (data.status === "complete" || data.status === "failed") return;
      } catch {
        if (!cancelled) setError("Could not reach the server.");
        return;
      }
      setTimeout(poll, 1500);
    }
    poll();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error && !audit) {
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-[840px] flex-col items-center justify-center px-8 py-16">
        <p className="text-sm text-critical">{error}</p>
        <Link href="/" className="mt-4 text-sm font-medium text-accent">
          Try again
        </Link>
      </main>
    );
  }

  if (!audit || (audit.status !== "complete" && audit.status !== "failed")) {
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-[840px] flex-col items-center justify-center px-8 py-16">
        <ProgressState status={audit?.status ?? "pending"} />
      </main>
    );
  }

  if (audit.status === "failed") {
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-[840px] flex-col items-center justify-center px-8 py-16">
        <p className="text-sm text-critical">{audit.error ?? "The audit failed."}</p>
        <Link href="/" className="mt-4 text-sm font-medium text-accent">
          Try again
        </Link>
      </main>
    );
  }

  const pillars = PILLAR_ORDER.map((key) => audit.pillars[key]);

  const ownDomain = (() => {
    try {
      return new URL(audit.url).hostname.replace(/^www\./, "");
    } catch {
      return undefined;
    }
  })();

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-[840px] flex-col px-8 py-10">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm font-medium text-accent">
          GEO Auditor
        </Link>
        <a
          href={`/api/audit/${id}/pdf`}
          className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground"
        >
          Download PDF
        </a>
      </div>
      <div className="mt-10 space-y-8">
        <VerdictBanner verdict={audit.verdict} />
        <ScoreHero
          score={audit.score.total}
          businessName={audit.businessName}
          url={audit.url}
          pillars={pillars}
        />
        {pillars.map((pillar) => (
          <PillarBreakdown key={pillar.key} pillar={pillar} ownDomain={ownDomain} />
        ))}
        {audit.fixes.length > 0 && (
          <section className="space-y-4">
            <h3 className="text-base font-semibold leading-6 text-text-primary">
              Prioritized fixes
            </h3>
            <div className="space-y-4">
              {audit.fixes.map((fix) => (
                <FixCard key={fix.id} fix={fix} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}