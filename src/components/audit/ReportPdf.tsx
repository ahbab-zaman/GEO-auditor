import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Audit, CheckResult, Fix, PillarResult } from "@/types/audit";
import { getSeverityColor } from "@/lib/utils";
import {
  formatPublicUnavailableReason,
  summarizeFixes,
  summarizePillars,
} from "@/lib/pipeline/reportPresentation";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    lineHeight: 1.5,
    color: "#12141c",
  },
  docTitle: { fontSize: 12, fontWeight: 700, color: "#9498a8" },
  summaryCard: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: "#e5e7f0",
    borderRadius: 8,
    backgroundColor: "#f7f8fc",
    padding: 12,
  },
  summaryTitle: { fontSize: 12, fontWeight: 700, color: "#12141c" },
  summaryNote: { fontSize: 10, color: "#565b6e", marginTop: 4 },
  summaryList: { marginTop: 8 },
  summaryItem: { fontSize: 10, color: "#565b6e", marginTop: 3 },
  summaryNested: { marginTop: 4, marginLeft: 14 },
  businessTitle: { fontSize: 24, fontWeight: 700, color: "#12141c", marginTop: 12 },
  businessUrl: { fontSize: 11, color: "#9498a8", marginTop: 2 },
  verdict: {
    fontSize: 20,
    fontWeight: 600,
    lineHeight: 28,
    color: "#12141c",
    marginTop: 20,
  },
  scoreBlock: { flexDirection: "row", marginTop: 20 },
  scoreNumber: { fontSize: 40, fontWeight: 700, color: "#12141c" },
  scoreMeta: { fontSize: 12, color: "#9498a8", marginTop: 26, marginLeft: 6 },
  scoreBars: { flex: 1, marginLeft: 28, justifyContent: "center" },
  scoreBarRow: { marginBottom: 10 },
  scoreBarLabel: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 10,
    color: "#9498a8",
  },
  barTrack: {
    marginTop: 3,
    height: 8,
    backgroundColor: "#eef0f6",
    borderRadius: 999,
  },
  barFill: { height: 8, borderRadius: 999 },
  sectionHeading: { fontSize: 14, fontWeight: 700, color: "#12141c", marginTop: 24, marginBottom: 4 },
  subHeading: { fontSize: 12, fontWeight: 600, color: "#12141c", marginTop: 14 },
  text: { fontSize: 10, color: "#565b6e", marginTop: 2 },
  bulletText: { fontSize: 10, color: "#565b6e", marginTop: 2 },
  finding: { marginTop: 12 },
  findingRow: { flexDirection: "row", alignItems: "center" },
  findingTitle: { fontSize: 11, fontWeight: 600, color: "#12141c" },
  evidence: {
    backgroundColor: "#f4f5f9",
    borderRadius: 6,
    padding: 8,
    marginTop: 6,
  },
  evidenceLabel: { fontSize: 9, color: "#9498a8", marginBottom: 2 },
  evidenceText: { fontSize: 10, color: "#12141c" },
  codeText: { fontFamily: "Courier", fontSize: 9, color: "#12141c" },
  pillRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  pill: {
    fontSize: 9,
    color: "#565b6e",
    borderWidth: 1,
    borderColor: "#e5e7f0",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 4,
    marginTop: 2,
  },
  absentPill: {
    fontSize: 9,
    color: "#991b1b",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 4,
    marginTop: 2,
  },
  unavailable: {
    backgroundColor: "#f4f5f9",
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
  },
  fix: { marginTop: 12 },
  copyBlock: {
    backgroundColor: "#1f1f1f",
    borderRadius: 6,
    padding: 8,
    marginTop: 6,
  },
  copyText: { fontFamily: "Courier", fontSize: 9, color: "#e5e7f0" },
  sectionLabel: { fontSize: 10, fontWeight: 700, color: "#12141c" },
  sectionValue: { fontSize: 10, color: "#565b6e" },
});

const SEVERITY_LABEL: Record<CheckResult["severity"], string> = {
  pass: "Pass",
  warning: "Needs work",
  critical: "Critical",
};

const SEVERITY_COLOR: Record<CheckResult["severity"], string> = {
  pass: "#0e9f6e",
  warning: "#d97706",
  critical: "#dc2626",
};

function resolveCitationDomain(uri: string): string {
  try {
    return new URL(uri).hostname.replace(/^www\./, "");
  } catch {
    return uri;
  }
}

function EvidenceBlock({
  evidence,
  ownDomain,
}: {
  evidence: CheckResult["evidence"];
  ownDomain?: string;
}) {
  if (evidence.type === "quote") {
    return (
      <View style={styles.evidence}>
        <Text style={styles.evidenceLabel}>- Source: {evidence.source}</Text>
        <Text style={styles.evidenceText}>- Quote: {evidence.text}</Text>
      </View>
    );
  }
  if (evidence.type === "code") {
    return (
      <View style={styles.evidence}>
        <Text style={styles.evidenceLabel}>- Source: {evidence.source}</Text>
        <Text style={styles.codeText}>- Snippet:</Text>
        <Text style={styles.codeText}>{evidence.snippet}</Text>
      </View>
    );
  }
  if (evidence.type === "absence") {
    return (
      <View style={styles.evidence}>
        <Text style={styles.evidenceLabel}>- Source: {evidence.source}</Text>
        <Text style={styles.evidenceText}>- Note: {evidence.note}</Text>
      </View>
    );
  }

  const ownCited = evidence.citedUrls.some(
    (uri) => ownDomain && resolveCitationDomain(uri) === ownDomain,
  );

  return (
    <View style={styles.evidence}>
      <Text style={styles.evidenceLabel}>- Query: {evidence.query}</Text>
      <Text style={styles.evidenceText}>- Answer: {evidence.answerText}</Text>
      <View style={styles.pillRow}>
        {ownDomain && !ownCited && (
          <Text style={styles.absentPill}>Your site: not cited</Text>
        )}
        {evidence.citedUrls.map((uri) => (
          <Text key={uri} style={styles.pill}>
            {resolveCitationDomain(uri)}
            {ownDomain && resolveCitationDomain(uri) === ownDomain ? " (your site)" : ""}
          </Text>
        ))}
      </View>
    </View>
  );
}

function Finding({
  finding,
  ownDomain,
}: {
  finding: CheckResult;
  ownDomain?: string;
}) {
  if (finding.status === "unavailable") {
    return (
      <View style={styles.finding}>
        <Text style={styles.findingTitle}>{finding.label}</Text>
        <View style={styles.unavailable}>
          <Text style={styles.evidenceText}>
            {formatPublicUnavailableReason(
              finding.unavailableReason ?? "This check could not be completed.",
            )}
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.finding}>
      <View style={styles.findingRow}>
        <Text style={[styles.findingTitle, { color: SEVERITY_COLOR[finding.severity] }]}>
          {SEVERITY_LABEL[finding.severity]}
        </Text>
        <Text style={[styles.findingTitle, { marginLeft: 6 }]}>{finding.label}</Text>
      </View>
      <Text style={styles.bulletText}>- Finding: {finding.finding}</Text>
      <EvidenceBlock evidence={finding.evidence} ownDomain={ownDomain} />
    </View>
  );
}

function PillarSection({
  pillar,
  ownDomain,
}: {
  pillar: PillarResult;
  ownDomain?: string;
}) {
  return (
    <View style={{ marginTop: 16 }}>
      <View style={styles.findingRow}>
        <Text style={styles.subHeading}>{pillar.label}</Text>
        <Text style={[styles.evidenceLabel, { marginLeft: 8 }]}>
          {pillar.pointsEarned} / {pillar.pointsPossible} pts
        </Text>
      </View>
      {pillar.status === "unavailable" ? (
        <View style={styles.unavailable}>
          <Text style={styles.evidenceText}>
            {formatPublicUnavailableReason(
              pillar.unavailableReason ?? "This pillar could not be completed.",
            )}
          </Text>
        </View>
      ) : (
        pillar.checks.map((check) => (
          <Finding key={check.id} finding={check} ownDomain={ownDomain} />
        ))
      )}
    </View>
  );
}

// Mirrors the on-screen ScoreHero: score on a 100 scale + one progress bar per pillar.
function ScoreSection({ score, maxTotal, pillars }: { score: number; maxTotal: number; pillars: PillarResult[] }) {
  const barColor = SEVERITY_COLOR[getSeverityColor(score)];
  return (
    <View style={styles.scoreBlock}>
      <View>
        <Text style={styles.scoreNumber}>{score}</Text>
        <Text style={styles.scoreMeta}>/ {maxTotal}</Text>
      </View>
      <View style={styles.scoreBars}>
        {pillars.map((pillar) => {
          const percent = pillar.pointsPossible
            ? Math.round((pillar.pointsEarned / pillar.pointsPossible) * 100)
            : 0;
          return (
            <View key={pillar.key} style={styles.scoreBarRow}>
              <View style={styles.scoreBarLabel}>
                <Text>{pillar.label}</Text>
                <Text>
                  {pillar.pointsEarned} / {pillar.pointsPossible}
                </Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${percent}%`, backgroundColor: barColor }]} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function FixSection({
  fix,
  finding,
}: {
  fix: Fix;
  finding?: string;
}) {
  return (
    <View style={styles.finding}>
      <Text style={styles.findingTitle}>{fix.title}</Text>
      <View style={styles.pillRow}>
        <Text style={styles.pill}>impact: {fix.impact}</Text>
        <Text style={styles.pill}>effort: {fix.effort}</Text>
      </View>
      {finding && <Text style={styles.bulletText}>- Why it matters here: {finding}</Text>}
      <Text style={styles.bulletText}>- Explanation: {fix.explanation}</Text>
      {fix.copyPasteContent && (
        <View style={styles.copyBlock}>
          <Text style={styles.copyText}>{fix.copyPasteContent}</Text>
        </View>
      )}
    </View>
  );
}

const PILLAR_ORDER = [
  "structuralAnswerability",
  "liveAiCitation",
  "thirdPartyCorroboration",
] as const;

export function ReportPdf({ audit }: { audit: Audit }) {
  const ownDomain = (() => {
    try {
      return new URL(audit.url).hostname.replace(/^www\./, "");
    } catch {
      return undefined;
    }
  })();

  const pillars = PILLAR_ORDER.map((key) => audit.pillars[key]);
  const checksById = new Map(pillars.flatMap((pillar) => pillar.checks).map((check) => [check.id, check]));
  const summaryPillars = summarizePillars(audit.pillars);
  const summaryFixes = summarizeFixes(audit);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.docTitle}>GEO Auditor - AI Visibility Report</Text>
        <Text style={styles.businessTitle}>{audit.businessName}</Text>
        <Text style={styles.businessUrl}>{audit.url}</Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Requirement Summary</Text>
          <Text style={styles.summaryNote}>
            This report lists the checks the site passed, the requirements it still misses, and
            the evidence behind each result.
          </Text>
          <View style={styles.summaryList}>
            <Text style={styles.summaryItem}>
              <Text style={styles.sectionLabel}>Business: </Text>
              <Text style={styles.sectionValue}>{audit.businessName}</Text>
            </Text>
            <Text style={styles.summaryItem}>
              <Text style={styles.sectionLabel}>Website: </Text>
              <Text style={styles.sectionValue}>{audit.url}</Text>
            </Text>
            <Text style={styles.summaryItem}>
              <Text style={styles.sectionLabel}>Score: </Text>
              <Text style={styles.sectionValue}>
                {audit.score.total} / {audit.score.maxTotal}
              </Text>
            </Text>
            <Text style={styles.summaryItem}>
              <Text style={styles.sectionLabel}>Status: </Text>
              <Text style={styles.sectionValue}>{audit.status}</Text>
            </Text>
            <Text style={styles.summaryItem}>
              <Text style={styles.sectionLabel}>Pillar scores:</Text>
            </Text>
            <View style={styles.summaryNested}>
              {summaryPillars.map((pillar) => (
                <Text key={pillar.key} style={styles.summaryItem}>
                  - {pillar.label}: {pillar.score}
                  {pillar.status === "unavailable" && pillar.unavailableReason
                    ? ` | Note: ${pillar.unavailableReason}`
                    : ""}
                </Text>
              ))}
            </View>
            {summaryFixes.length > 0 && (
              <>
                <Text style={styles.summaryItem}>
                  <Text style={styles.sectionLabel}>Requirements not yet met:</Text>
                </Text>
                <View style={styles.summaryNested}>
                  {summaryFixes.map((fix) => (
                    <Text key={fix.title} style={styles.summaryItem}>
                      - {fix.title} (impact {fix.impact}, effort {fix.effort})
                    </Text>
                  ))}
                </View>
              </>
            )}
          </View>
        </View>

        <ScoreSection
          score={audit.score.total}
          maxTotal={audit.score.maxTotal}
          pillars={pillars}
        />

        <Text style={styles.sectionHeading}>Pillar breakdown</Text>
        {pillars.map((pillar) => (
          <PillarSection key={pillar.key} pillar={pillar} ownDomain={ownDomain} />
        ))}

        {audit.fixes.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <Text style={styles.sectionHeading}>Requirements not yet met</Text>
            {audit.fixes.map((fix) => (
              <FixSection
                key={fix.id}
                fix={fix}
                finding={checksById.get(fix.relatedCheckId)?.finding}
              />
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}
