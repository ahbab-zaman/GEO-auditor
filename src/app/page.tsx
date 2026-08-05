import { AuditForm } from "@/components/audit/AuditForm";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-[840px] flex-col items-center justify-center px-8 py-16">
      <h1 className="text-2xl font-bold leading-8 text-text-primary">
        GEO Auditor
      </h1>
      <p className="mt-2 max-w-md text-center text-sm leading-6 text-text-secondary">
        Find out whether AI search engines actually know your business exists —
        and what to do about it.
      </p>
      <div className="mt-8 w-full max-w-md">
        <AuditForm />
      </div>
      <p className="mt-8 max-w-md text-center text-xs leading-4 text-text-muted">
        GEO Auditor reads your website, asks a real AI engine what it knows
        about you, then checks who else vouches for you online — and turns that
        into a scored report with a prioritized fix list.
      </p>
    </main>
  );
}