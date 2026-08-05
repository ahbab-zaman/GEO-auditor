export function VerdictBanner({ verdict }: { verdict: string | null }) {
  if (!verdict) return null;
  return (
    <section className="rounded-xl border border-border bg-accent-light px-6 py-5">
      <p className="text-lg font-semibold leading-7 text-accent-dark">{verdict}</p>
    </section>
  );
}