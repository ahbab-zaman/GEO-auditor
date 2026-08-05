"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";
import type { AuditStatus } from "@/types/audit";

type Phase = { title: string; messages: string[] };

const PHASES: Phase[] = [
  {
    title: "Preparing",
    messages: [
      "Preparing your audit...",
      "Initializing AI agents...",
      "Gathering website information...",
      "Setting up the analysis...",
      "Warming up the audit engine...",
    ],
  },
  {
    title: "Website Analysis",
    messages: [
      "Inspecting your website...",
      "Understanding your content...",
      "Mapping your pages...",
      "Evaluating your online presence...",
      "Looking for important signals...",
    ],
  },
  {
    title: "AI Research",
    messages: [
      "Asking AI what it knows about your brand...",
      "Collecting insights from multiple AI systems...",
      "Searching public knowledge sources...",
      "Checking your digital reputation...",
      "Discovering how AI perceives your business...",
    ],
  },
  {
    title: "Content & SEO",
    messages: [
      "Evaluating content quality...",
      "Reviewing SEO signals...",
      "Measuring visibility...",
      "Checking technical indicators...",
      "Comparing against best practices...",
    ],
  },
  {
    title: "Generating Report",
    messages: [
      "Combining all findings...",
      "Scoring your AI visibility...",
      "Writing actionable recommendations...",
      "Finalizing your audit report...",
      "Almost ready...",
    ],
  },
];

// Where the reel starts for each backend status so the copy stays in sync with the
// real pipeline (pending=prep, scraping=site read, analyzing=research -> report).
const PHASE_BASE_BY_STATUS: Record<AuditStatus, number> = {
  pending: 0,
  scraping: 5,
  analyzing: 10,
  complete: 10,
  failed: 10,
};

const MESSAGES_PER_PHASE = 5;
const TOTAL_MESSAGES = PHASES.length * MESSAGES_PER_PHASE;
const MESSAGE_INTERVAL_MS = 3200;

export function ProgressState({ status }: { status: AuditStatus }) {
  const [cursor, setCursor] = useState(() => PHASE_BASE_BY_STATUS[status]);
  const cursorRef = useRef(cursor);

  useEffect(() => {
    // If the backend advanced (pending -> scraping -> analyzing), fast-forward the reel
    // to match instead of replaying earlier phases.
    const base = PHASE_BASE_BY_STATUS[status];
    if (cursorRef.current < base) {
      cursorRef.current = base;
      setCursor(base);
    }
    const timer = setInterval(() => {
      cursorRef.current = (cursorRef.current + 1) % TOTAL_MESSAGES;
      setCursor(cursorRef.current);
    }, MESSAGE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [status]);

  const phaseIndex = Math.floor(cursor / MESSAGES_PER_PHASE);
  const message = PHASES[phaseIndex].messages[cursor % MESSAGES_PER_PHASE];

  return (
    <div className="flex w-full max-w-md flex-col items-center rounded-xl border border-border bg-surface px-6 py-10 shadow-card">
      <Loader />
      <div className="mt-6 flex h-10 w-full items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p
            key={message}
            initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="whitespace-nowrap text-sm text-text-secondary"
          >
            {message}
          </motion.p>
        </AnimatePresence>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-medium text-accent">
          Stage {phaseIndex + 1} of {PHASES.length}
        </span>
        <span className="text-xs text-text-muted">{PHASES[phaseIndex].title}</span>
      </div>
      <div className="mt-5 h-1 w-full max-w-xs overflow-hidden rounded-full bg-surface-secondary">
        <div className="geo-anim h-full w-1/2 animate-progress-slide rounded-full bg-gradient-to-r from-accent/30 via-accent to-accent/30" />
      </div>
    </div>
  );
}

function Loader() {
  return (
    <div className="relative flex h-28 w-28 items-center justify-center" aria-hidden>
      <div className="geo-anim absolute -inset-2 rounded-full border border-dashed border-border animate-spin-reverse" />
      <div className="geo-anim absolute -inset-4 rounded-full bg-accent/10 blur-xl animate-glow-pulse" />

      <div className="absolute -inset-4 overflow-hidden rounded-full">
        <div
          className="geo-anim h-full w-full animate-radar-sweep rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, color-mix(in srgb, var(--color-accent) 24%, transparent) 0deg, color-mix(in srgb, var(--color-accent) 6%, transparent) 70deg, transparent 160deg)",
          }}
        />
      </div>

      <div className="relative flex items-center justify-center">
        <Search
          className="geo-anim h-9 w-9 animate-glow-pulse text-accent"
          strokeWidth={1.8}
        />
      </div>

      <div className="geo-anim absolute left-0 top-5 h-1.5 w-1.5 animate-particle rounded-full bg-accent/70" />
      <div
        className="geo-anim absolute right-1 top-10 h-2 w-2 animate-particle rounded-full bg-pass/70"
        style={{ animationDelay: "1.2s" }}
      />
      <div
        className="geo-anim absolute bottom-3 left-3 h-1.5 w-1.5 animate-particle rounded-full bg-warning/70"
        style={{ animationDelay: "2.4s" }}
      />
      <div className="geo-anim absolute inset-0 animate-orbit">
        <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" />
      </div>
    </div>
  );
}
