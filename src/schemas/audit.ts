import { z } from "zod";

export const AuditRequestSchema = z.object({
  url: z.string().url(),
  businessName: z.string().min(1).max(200),
});

export const DirectAnswerExtractionSchema = z.object({
  hasDirectAnswer: z.boolean(),
  extractedSentence: z.string().nullable(),
  reasoning: z.string(),
});

export const QueryGenerationSchema = z.object({
  queries: z
    .array(z.object({ type: z.enum(["category", "direct"]), text: z.string() }))
    .min(1),
});

export const VerdictSchema = z.object({ verdict: z.string().min(1) });

export const DescriptionAccuracySchema = z.object({
  consistent: z.boolean(),
  contradictions: z.array(z.string()),
});

export const GroundedResultSchema = z.object({
  answerText: z.string(),
  citedUrls: z.array(z.string()),
});