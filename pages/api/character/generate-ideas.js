// pages/api/character/generate-ideas.js
import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const {
    characterName = "Hero",
    characterArchetype = "photoreal_human",
    characterTraits = "confident, expressive, charismatic",
    companionName,
    companionTraits,
    audience = "family", // "kids" | "teens" | "family" | "adult"
    duration = 2, // in minutes
    language = "hindi", // "hindi" | "en_us" | "en_uk"
    genre = "adventure",
  } = req.body;

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    let audienceGuide = "Target Audience: All Ages & Family (heartfelt, inspiring, emotionally resonant).";
    if (audience === "kids") {
      audienceGuide = "Target Audience: Children / Kids (Ages 3-10) — Whimsical, innocent, playful moral lesson, educational and gentle pacing.";
    } else if (audience === "teens") {
      audienceGuide = "Target Audience: Teens & Young Adults — High-energy, suspenseful, witty dialogues, mystery or anime/sci-fi thrills.";
    } else if (audience === "adult") {
      audienceGuide = "Target Audience: Adults & Mature Viewers — Deep psychological drama, realistic business/documentary, sophisticated suspense.";
    }

    let langGuide = "Language: Hindi (Devanagari script for titles and hooks, with English summary).";
    if (language === "en_us") {
      langGuide = "Language: American English (catchy modern US titles and hooks).";
    } else if (language === "en_uk") {
      langGuide = "Language: British English (eloquent phrasing and narrative flair).";
    }

    const companionText = companionName ? `Co-Star / Companion: "${companionName}" (${companionTraits || "loyal friend/rival"})` : "Single Protagonist";

    const prompt = `You are a visionary Hollywood screenwriter and viral video director.
Generate exactly 4 UNIQUE, HIGH-IMPACT story pitches for a ${duration}-minute cinematic video.

Lead Character: "${characterName}"
Archetype / Style: ${characterArchetype}
Visual Traits: ${characterTraits}
${companionText}
${audienceGuide}
${langGuide}

For each story pitch, provide:
1. "id": 1, 2, 3, 4
2. "title": Catchy title
3. "genre": e.g. "Emotional Drama", "Mystery Quest", "Kids Moral Adventure", "Sci-Fi Discovery", "Inspiring True Journey"
4. "hook": A 1-line viral opening hook that grabs attention immediately
5. "premise": A concise 2-3 sentence storyline summary explaining the conflict, journey, and resolution
6. "moralOrTakeaway": The core emotional takeaway or punchline

Return ONLY valid JSON matching this schema:
{
  "ideas": [
    {
      "id": 1,
      "title": "...",
      "genre": "...",
      "hook": "...",
      "premise": "...",
      "moralOrTakeaway": "..."
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a master storyteller providing creative story pitches in structured JSON." },
        { role: "user", content: prompt },
      ],
    });

    const parsed = JSON.parse(completion.choices[0].message.content);
    return res.status(200).json({ ok: true, ideas: parsed.ideas || [] });
  } catch (err) {
    console.error("[generate-ideas] Error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
