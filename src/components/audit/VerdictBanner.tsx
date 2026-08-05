export function VerdictBanner({ verdict }: { verdict: string | null }) {
  if (!verdict) return null;
  return (
    <section className="bg-surface-secondary px-6 py-8">
      <p className="text-[30px] font-semibold leading-[42px] text-text-primary">{verdict}</p>
    </section>
  );
}