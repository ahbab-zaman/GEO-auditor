# GEO Auditor — Demo Video Script (3–4 minutes)

A simple, spoken-word script to present the project. Each numbered section = one scene. Read slowly, pause between scenes. Aim for 3.5–4 minutes total.

---

## Scene 1 — The Problem (0:00 – 0:35)

**Spoken:**
> "Let me start with a simple question. If I type a business name into ChatGPT or Perplexity and ask, "Where can I find a good plumber?" — will that business appear?
>
> Here's the thing most people don't realize: you can rank #1 on Google and still be totally invisible to AI chatbots. That's because Google gives you back a list of links. But AI doesn't do that. AI reads a handful of sources it trusts, and then writes one paragraph for the user.
>
> Most businesses have no idea why they are inside that answer — or why they're missing from it. And no normal SEO tool can tell you. This project is called GEO Auditor. GEO stands for Generative Engine Optimization. And it exists to make that invisibility visible.

---

## Scene 2 — Show the tool (0:35 – 1:10)

**On screen:** the landing page with the input form.

**Spoken:**
> "So what does it actually do? You come to the landing page. You type in just two things: a business name and its website URL. Then you hit start, and the tool gets to work."
>
> "While it works, you see a live progress screen that walks you through each step — scraping the site, reading the content, asking a real AI engine your questions, checking what others say about you online, and finally building your report."

---

## Scene 3 — What happens behind the scenes (1:10 – 2:00)

**On screen:** show the animated loader, then the report.

**Spoken:**
> "So what does the system actually do? It breaks down into three main checks — I call them three pillars."
>
> "First, a **structural check.** Can an AI even read this website? It looks at things like robots.txt, structured data, clear answers on the page, and FAQ sections. If AI can't parse a site, it definitely can't cite it."
>
> "Second, a **live AI test.** This is the important one. The tool actually asks a real AI chatbot the real questions a customer would type. Then it looks at the raw answer — word for word — and asks: did it mention this business? Did it cite this business's own website?"
>
> "Third, a **trust check.** It goes on the web and asks: does anyone else — besides the business itself — actually vouch for this business? Because AI trusts outsiders way more than it trusts a company's own marketing."

---

## Scene 4 — The report & score (2:00 – 2:40)

**On screen:** scrolling the report — verdict, score, pillar breakdown, fixes.

**Spoken:**
> "All of that comes together into one report. At the top, you get a one-sentence plain-English verdict — something a busy owner can read in five seconds."
>
> "Then you get a clear score out of 100, broken down across those three pillars so you can see exactly where the strength is and where the weakness is."
>
> "And then the best part: a prioritized fix list. It tells you what to fix first, and it gives you copy-and-paste-ready text, so you don't have to be a developer to action it."
>
> "And when you're ready, you click one button to export the whole thing as a professional PDF that you can forward anywhere."

---

## Scene 5 — Under the hood (2:40 – 3:30)

**On screen:** code editor / the tech stack.

**Spoken:**
> "A quick peek under the hood. Because the point shouldn't be magic — it should be build to trust."
>
> "So the scoring is fully deterministic. The AI never gives itself points. It reads the page, produces the facts, and a set of transparent rules turn those facts into a score. That means every number in the report is traceable and checkable."
>
> "For tech, it's Next.js with TypeScript on the front. On the back, it fetches the real sites using Cheerio, it talks to real AI models through OpenRouter, and it uses Tavily to find real online citations."
>
> "And the whole pipeline is built to be resilient. Each stage runs in one step, saves its progress, and moves to the next. If an API somewhere is slow or hits a limit, the tool doesn't crash and doesn't secretly lower your score. It honestly says: "this check couldn't complete — here in why.""

---

## Scene 6 — Wrap up (3:30 – 4:00)

**Spoken:**
> "So to sum it up: this project answers one question that traditional SEO tools simply can't — do artificial intelligence tools actually see and trust your business?"
>
> "It's live, it's evidence-based, it's honest, and it produces a real, actionable, shareable report. You become visible in the age of AI answers."
>
> "Thanks for watching."

---

## Quick tips for recording

**Spoken:**
- Speak slowly and clearly — these are technical ideas, so give the viewer time.
- Use a live demo for scenes 2 and 4 (real business, real run) so the report is real, not mocked.
- For scene 5, keep it high-level; you don't need to read code line by line, just point at the stack.