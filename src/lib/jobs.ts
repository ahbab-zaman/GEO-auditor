// Shared helpers for starting/resuming audit work as self-triggered serverless invocations.
// The audit runs one stage per invocation (see /api/jobs/run); this module builds the URL to
// call to kick off the next stage.

export function jobSecret(): string | null {
  return process.env.AUDIT_JOB_SECRET ?? null;
}

export function appBaseUrl(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return process.env.APP_URL ?? "http://localhost:3000";
}

export async function triggerAuditStep(id: string): Promise<void> {
  const response = await fetch(`${appBaseUrl()}/api/jobs/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-audit-secret": jobSecret() ?? "",
    },
    body: JSON.stringify({ id }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Audit job trigger failed: ${response.status} ${body.slice(0, 200)}`);
  }
}