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

    // Placeholder (we fill in Parts 2–7)
    return res.status(200).json({
      ok: true,
      message: "RAG engine base is working.",
      client_email: finalClientEmail,
 
