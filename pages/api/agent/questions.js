import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "POST only" });
  }

  const { platform, objective, missing, context } = req.body || {};

  if (!platform || !objective || !Array.isArray(missing)) {
    return res.status(400).json({
      ok: false,
      message: "platform, objective and missing[] are required",
    });
  }

  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
  });

  const prompt = `
You are a senior digital marketing strategist.

Platform: ${platform}
Objective: ${objective}
Business context: ${JSON.stringify(context || {}, null, 2)}

The following required details are missing:
${missing.join(", ")}

Generate ONE clear, beginner-friendly question per missing item.
Rules:
- No explanations
- No assumptions
- Questions only
- Ask confirmation explicitly if required
- Use INR if budget is asked
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const questions = text
      .split("\n")
      .map(q => q.replace(/^[-•\d.]+/, "").trim())
      .filter(Boolean);

    return res.status(200).json({
      ok: true,
      questions,
    });
  } catch (err) {
    console.error("Gemini question error:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to generate questions",
    });
  }
}
