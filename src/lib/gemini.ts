const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = "gemini-2.0-flash";

export type GroundedResult = {
  answerText: string;
  citedUrls: string[];
};

export async function geminiJson<T>(
  prompt: string,
  temperature = 0,
): Promise<T> {
  const response = await fetch(
    `${GEMINI_BASE}/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature },
      }),
    },
  );
  if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
  const data = await response.json();
  const text: string | undefined = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content");
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  return JSON.parse(cleaned) as T;
}

export async function geminiGroundedQuery(prompt: string): Promise<GroundedResult> {
  const response = await fetch(
    `${GEMINI_BASE}/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
      }),
    },
  );
  if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
  const data = await response.json();
  const candidate = data.candidates?.[0];
  const answerText: string =
    candidate?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  const chunks = candidate?.groundingMetadata?.groundingChunks ?? [];
  const citedUrls: string[] = chunks
    .map((c: { web?: { uri?: string } }) => c.web?.uri)
    .filter((u: string | undefined): u is string => Boolean(u));
  return { answerText, citedUrls };
}