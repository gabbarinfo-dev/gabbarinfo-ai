// pages/api/agent/smart-questions.js

import { GoogleGenerativeAI } from "@google/generative-ai";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "POST only" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }

  const {
    instruction,
    known_context = {},
    platform = "meta",
  } = req.body;

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
You are GabbarInfo AI — a senior digital marketing consultant.

Your task:
Ask ONLY the missing questions required to prepare an ad campaign.
DO NOT repeat questions if answers already exist.

KNOWN CONTEXT (already confirmed):
${JSON.stringify(known_context, null, 2)}

RULES:
- Ask questions one-by-one in logical order
- Be concise
- If everything required is known, respond exactly with:
  "ALL_REQUIRED_INFORMATION_COLLECTED"

REQUIRED FIELDS FOR ${platform.toUpperCase()} ADS:
- Business/Page selection
- Campaign objective
- Product/service
- Daily budget
- Duration (days)
- Target location
- Final approval (YES)

USER INSTRUCTION:
${instruction}

Respond ONLY with questions (no explanations).
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  return res.status(200).json({
    ok: true,
    questions: text,
  });
}
