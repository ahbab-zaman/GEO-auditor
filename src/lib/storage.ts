import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Audit } from "@/types/audit";

const AUDITS_DIR = path.join(process.cwd(), "src", "data", "audits");

export function auditPath(id: string): string {
  return path.join(AUDITS_DIR, `${id}.json`);
}

export async function saveAudit(audit: Audit): Promise<void> {
  if (!existsSync(AUDITS_DIR)) {
    await mkdir(AUDITS_DIR, { recursive: true });
  }
  await writeFile(auditPath(audit.id), JSON.stringify(audit, null, 2), "utf8");
}

export async function getAudit(id: string): Promise<Audit | null> {
  try {
    const raw = await readFile(auditPath(id), "utf8");
    return JSON.parse(raw) as Audit;
  } catch {
    return null;
  }
}