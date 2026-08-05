"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AuditForm() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, businessName }),
      });
      const json = await response.json();
      if (!json.success || !json.data?.id) {
        setError(json.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      router.push(`/audit/${json.data.id}`);
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-surface p-6 shadow-card">
      <label className="block">
        <span className="text-sm font-medium text-text-primary">Business name</span>
        <input
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          required
          placeholder="Acme Plumbing"
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-text-primary">Website URL</span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          type="url"
          placeholder="https://acmeplumbing.com"
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent"
        />
      </label>
      {error && <p className="text-sm text-critical">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-60"
      >
        {loading ? "Running audit…" : "Run Audit"}
      </button>
    </form>
  );
}