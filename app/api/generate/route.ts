import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { niche } = await req.json();

    if (!niche) {
      return NextResponse.json({ error: "Ніша не вказана" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY не налаштований на сервері" }, { status: 500 });
    }

    const prompt = `Ти — експерт з TikTok-маркетингу. Створи детальний план на 30 днів для людини з нішею "${niche}". Поділи на 4 тижні. Кожен тиждень — 5–7 конкретних завдань. Кожне завдання — одне речення, конкретна дія. Відповідь ТІЛЬКИ у форматі JSON (без markdown, без \`\`\`json, тільки чистий JSON): { "week1": { "title": "Тиждень 1: ...", "tasks": ["..."] }, "week2": { "title": "Тиждень 2: ...", "tasks": ["..."] }, "week3": { "title": "Тиждень 3: ...", "tasks": ["..."] }, "week4": { "title": "Тиждень 4: ...", "tasks": ["..."] } }. Мова відповіді — українська.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Gemini API error ${res.status}`);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

    let roadmap;
    try {
      roadmap = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) roadmap = JSON.parse(match[0]);
      else throw new Error("Не вдалося розпарсити відповідь від Gemini");
    }

    for (const w of ["week1", "week2", "week3", "week4"]) {
      if (!roadmap[w] || !Array.isArray(roadmap[w].tasks)) {
        throw new Error(`Некоректна структура відповіді (відсутній ${w})`);
      }
    }

    return NextResponse.json({ roadmap });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Невідома помилка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
