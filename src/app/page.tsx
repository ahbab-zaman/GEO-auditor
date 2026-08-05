import { Globe, MessageCircle, BarChart3 } from "lucide-react";
import { AuditForm } from "@/components/audit/AuditForm";

const STEPS = [
  { Icon: Globe, text: "We read your website the way an AI search engine would." },
  { Icon: MessageCircle, text: "We ask a real AI engine what it knows about your business." },
  { Icon: BarChart3, text: "We score your AI visibility and give you a fix list." },
];

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
      <div className="mt-8 w-full max-w-md space-y-3">
        {STEPS.map(({ Icon, text }) => (
          <div key={text} className="flex items-start gap-3">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
            <p className="text-sm leading-5 text-text-secondary">{text}</p>
          </div>
        ))}
      </div>
    </main>
  );
}