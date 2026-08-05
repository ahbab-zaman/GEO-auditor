import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Audit } from "@/types/audit";

// Audit persistence has two backends:
//  - Supabase Postgres when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set (used in
//    production on Vercel, where the filesystem is read-only and ephemeral).
//  - The local filesystem as a fallback (so `next dev` works without a database, and the
//    checked-in sample audits under src/data/audits remain readable).
const AUDITS_DIR = path.join(process.cwd(), "src", "data", "audits");

let client: SupabaseClient | null | undefined;

function supabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    client = null;
    return client;
  }
  client = createClient(url, key, {
    auth: { persistSession: false },
  });
  return client;
}

export function usingSupabase(): boolean {
  return supabase() !== null;
}

export function auditPath(id: string): string {
  return path.join(AUDITS_DIR, `${id}.json`);
}

export async function saveAudit(audit: Audit): Promise<void> {
  const db = supabase();
  if (db) {
    const { error } = await db
      .from("audits")
      .upsert({ id: audit.id, data: audit }, { onConflict: "id" });
    if (error) {
      throw new Error(`Failed to save audit to database: ${error.message}`);
    }
    return;
  }

  if (!existsSync(AUDITS_DIR)) {
    await mkdir(AUDITS_DIR, { recursive: true });
  }
  await writeFile(auditPath(audit.id), JSON.stringify(audit, null, 2), "utf8");
}

export async function getAudit(id: string): Promise<Audit | null> {
  const db = supabase();
  if (db) {
    const { data, error } = await db
      .from("audits")
      .select("data")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to load audit from database: ${error.message}`);
    }
    const row = data as { data?: Audit } | null;
    return row?.data ?? null;
  }

  try {
    const raw = await readFile(auditPath(id), "utf8");
    return JSON.parse(raw) as Audit;
  } catch {
    return null;
  }
}
