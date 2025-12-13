// pages/api/rag/query.js

import { supabaseServer } from "../../../lib/supabaseServer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";

// Initialize Gemini client (text + embeddings)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const textModel = genAI.getGenerativeModel({ model: "gemini-pro" });
const embedModel = genAI.getGenerativeModel({ model: "models/text-embedding-004" });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "POST only" });
  }

  try {
    let { user_input, client_email, mode } = req.body;

    if (!user_input || user_input.trim().length === 0) {
      return res.status(400).json({ ok: false, message: "Missing user_input" });
    }

    // Get session email (if user logged in)
    const session = await getServerSession(req, res, authOptions);
    const sessionEmail = session?.user?.email || null;

    // Determine final client_email priority:
    // 1) Provided in request → highest priority
    // 2) Session email → second priority
    // 3) No email → global-only mode
    const finalClientEmail = client_email || sessionEmail || null;
    // --- PART 2: Embed the user query ---
const embedResponse = await embedModel.embedContent(user_input);
const userEmbedding = embedResponse.embedding.values;
// --- PART 3: Client-first memory search ---
let clientResults = [];

if (finalClientEmail) {
  const { data: clientRows, error: clientErr } = await supabaseServer
    .from("client_memory")
    .select("content, embedding")
    .eq("client_email", finalClientEmail);

  if (!clientErr && clientRows && clientRows.length > 0) {
    clientResults = clientRows
      .map((row) => {
        // Compute cosine similarity manually
        let dot = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < row.embedding.length; i++) {
          dot += userEmbedding[i] * row.embedding[i];
          normA += userEmbedding[i] ** 2;
          normB += row.embedding[i] ** 2;
        }

        const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB));

        return {
          content: row.content,
          similarity,
        };
      })
      .sort((a, b) => b.similarity - a.similarity) // sort by highest similarity
      .slice(0, 5); // Take top 5 relevant chunks
  }
}
// --- PART 4: Global memory fallback search ---
let globalResults = [];

const { data: globalRows, error: globalErr } = await supabaseServer
  .from("global_memory")
  .select("content, embedding");

if (!globalErr && globalRows && globalRows.length > 0) {
  globalResults = globalRows
    .map((row) => {
      let dot = 0;
      let normA = 0;
      let normB = 0;

      for (let i = 0; i < row.embedding.length; i++) {
        dot += userEmbedding[i] * row.embedding[i];
        normA += userEmbedding[i] ** 2;
        normB += row.embedding[i] ** 2;
      }

      const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB));

      return {
        content: row.content,
        similarity,
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5); // top 5 global matches
}
// --- PART 5: Merge memory results with priority rules ---

let finalMemory = [];

// 🥇 Priority 1: Client memory
if (clientResults.length > 0) {
  finalMemory = clientResults;
} 
// 🥈 Priority 2: fallback to global if client empty
else if (globalResults.length > 0) {
  finalMemory = globalResults;
} 
// 🥉 If no memory found at all
else {
  finalMemory = [];
}
// --- PART 6: Build final prompt for Gemini ---

// Convert memory rows into readable text
let memoryText = "";
if (finalMemory.length > 0) {
  memoryText = finalMemory
    .map((m, idx) => `Memory #${idx + 1}:\n${m.content}`)
    .join("\n\n");
} else {
  memoryText = "No memory available.";
}

// SYSTEM INSTRUCTIONS FOR YOUR AI
const systemInstructions = `
You are GabbarInfo AI — a professional digital marketing strategist.

YOUR RULES:
- Think like Nishant (owner of GabbarInfo Digital Solutions) 
- Always follow Indian + Ahmedabad business mindset  
- Be practical, not theoretical  
- Use simple Indian-English, not fancy western English  
- Give direct strategies, steps, numbers, target audience, budgets  
- If user provided memory exists, YOU MUST use it  
- If memory is not relevant, mention better practical advice  
- Never say “I am AI”, “I am a language model”, etc.  
- If user asks about ads, give performance-driven strategies  
- If user asks for copy, give the BEST ad copy possible  
- If question is unclear, ask 1 clarification question  
- If memory contradicts user input → prefer the latest memory  
`;

// BUILD THE FINAL PROMPT
const finalPrompt = `
${systemInstructions}

USER QUESTION:
${user_input}

RELEVANT MEMORY:
${memoryText}

TASK:
Using the above memory + your intelligence, give the best possible marketing answer with clear steps and examples.
Provide:
- Strategy
- Targeting
- Ad copy (if relevant)
- Budget suggestions
- 1–2 optimisation ideas
`;
// --- PART 7: Generate answer using Gemini ---

let aiResponse = "";

try {
  const result = await genModel.generateContent(finalPrompt);
  aiResponse = result.response.text();
} catch (err) {
  console.error("Gemini error:", err);
  aiResponse = "Sorry, I couldn't generate the answer due to a system issue.";
}

// FINAL RETURN TO FRONTEND
return res.status(200).json({
  success: true,
  answer: aiResponse,
  used_client_email: finalClientEmail || null,
  memory_used: finalMemory.length,
});

    // Placeholder (we fill in Parts 2–7)
    return res.status(200).json({
      ok: true,
      message: "RAG engine base is working.",
      client_email: finalClientEmail,
      });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: "Server error in RAG query engine",
      error: err.message,
    });
  }
}

