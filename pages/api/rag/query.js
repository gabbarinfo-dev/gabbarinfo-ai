// pages/api/rag/query.js

import { supabaseServer } from "../../../lib/supabaseServer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";

// Initialize Gemini client (text + embeddings)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const textModel = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL });
const embedModel = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL });

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

