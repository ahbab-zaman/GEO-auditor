import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Audit, CheckResult, Fix, PillarResult } from "@/types/audit";

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 11,
    lineHeight: 1.5,
    color: "#12141c",
  },
  headerTitle: { fontSize: 13, fontWeight: 700, color: "#12141c" },
  scoreHeading: { fontSize: 13, fontWeight: 700, color: "#12141c", marginTop: 16 },
  meta: { fontSize: 10, color: "#9498a8", marginTop: 2 },
  verdict: {
    fontSize: 20,
    fontWeight: 600,
    lineHeight: 28,
    color: "#12141c",
    marginTop: 16,
  },
  sectionHeading: { fontSize: 13, fontWeight: 700, color: "#12141c", marginTop: 20, marginBottom: 4 },
  subHeading: { fontSize: 11, fontWeight: 600, color: "#12141c", marginTop: 12 },
  text: { fontSize: 10, color: "#565b6e", marginTop: 2 },
  finding: { marginTop: 10 },
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
  fix: { marginTop: 10 },
  copyBlock: {
    backgroundColor: "#1f1f1f",
    borderRadius: 6,
    padding: 8,
    marginTop: 6,
  },
  copyText: { fontFamily: "Courier", fontSize: 9, color: "#e5e7f0" },
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
        <Text style={styles.evidenceLabel}>Source: {evidence.source}</Text>
        <Text style={styles.evidenceText}>{evidence.text}</Text>
      </View>
    );
  }
  if (evidence.type === "code") {
    return (
      <View style={styles.evidence}>
        <Text style={styles.evidenceLabel}>Source: {evidence.source}</Text>
        <Text style={styles.codeText}>{evidence.snippet}</Text>
      </View>
    );
  }
  if (evidence.type === "absence") {
    return (
      <View style={styles.evidence}>
        <Text style={styles.evidenceLabel}>Source: {evidence.source}</Text>
        <Text style={styles.evidenceText}>{evidence.note}</Text>
      </View>
    );
  }

  const ownCited = evidence.citedUrls.some(
    (uri) => ownDomain && resolveCitationDomain(uri) === ownDomain,
  );

  return (
    <View style={styles.evidence}>
      <Text style={styles.evidenceLabel}>Query: {evidence.query}</Text>
      <Text style={styles.evidenceText}>{evidence.answerText}</Text>
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
            {finding.unavailableReason ?? "This check could not be completed."}
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
      <Text style={styles.text}>{finding.finding}</Text>
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
            {pillar.unavailableReason ?? "This pillar could not be completed."}
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

function FixSection({ fix }: { fix: Fix }) {
  return (
    <View style={styles.finding}>
      <Text style={styles.findingTitle}>{fix.title}</Text>
      <View style={styles.pillRow}>
        <Text style={styles.pill}>impact: {fix.impact}</Text>
        <Text style={styles.pill}>effort: {fix.effort}</Text>
      </View>
      <Text style={styles.text}>{fix.explanation}</Text>
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

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View>
          <Text style={styles.headerTitle}>GEO Auditor — AI Visibility Report</Text>
          <Text style={styles.meta}>{audit.businessName}</Text>
          <Text style={styles.meta}>{audit.url}</Text>
        </View>

        {audit.verdict && <Text style={styles.verdict}>{audit.verdict}</Text>}

        <View style={{ marginTop: 16 }}>
          <Text style={styles.scoreHeading}>
            Overall score: {audit.score.total} / {audit.score.maxTotal}
          </Text>
        </View>

        <Text style={styles.scoreHeading}>Pillar breakdown</Text>
        {PILLAR_ORDER.map((key) => (
          <PillarSection key={key} pillar={audit.pillars[key]} ownDomain={ownDomain} />
        ))}

        {audit.fixes.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <Text style={styles.scoreHeading}>Prioritized fixes</Text>
            {audit.fixes.map((fix) => (
              <FixSection key={fix.id} fix={fix} />
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}