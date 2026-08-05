"use client";

import { useEffect, useRef, useState } from "react";
import type { PillarResult } from "@/types/audit";
import { getSeverityColor } from "@/lib/utils";

const RING_STYLES: Record<"pass" | "warning" | "critical", string> = {
  pass: "text-pass",
  warning: "text-warning",
  critical: "text-critical",
};

const BAR_STYLES: Record<"pass" | "warning" | "critical", string> = {
  pass: "bg-pass",
  warning: "bg-warning",
  critical: "bg-critical",
};

const RING_SIZE = 180;
const RING_STROKE = 10;
const RADIUS = (RING_SIZE - RING_STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function useCountUp(target: number, durationMs: number): number {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, durationMs]);

  return value;
}

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
  const animatedScore = useCountUp(score, 450);

  return (
    <section>
      <h2 className="text-2xl font-bold leading-8 text-text-primary">{businessName}</h2>
      <p className="mt-1 text-sm text-text-muted">{url}</p>
      <div className="mt-8 flex items-center gap-8">
        <div className="relative h-[180px] w-[180px] shrink-0">
          <svg
            width={RING_SIZE}
            height={RING_SIZE}
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            className="-rotate-90"
          >
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              fill="none"
              strokeWidth={RING_STROKE}
              className="stroke-border-light"
            />
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              fill="none"
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - Math.min(score / 100, 1))}
              className={`${ringColor} stroke-current`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[68px] font-bold leading-[72px] text-text-primary">
              {animatedScore}
            </span>
            <span className="text-sm text-text-muted">/ 100</span>
          </div>
        </div>
        <div className="flex-1 space-y-4">
          {pillars.map((pillar) => {
            const barSeverity = getSeverityColor(
              pillar.pointsPossible
                ? Math.round((pillar.pointsEarned / pillar.pointsPossible) * 100)
                : 0,
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