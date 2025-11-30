// pages/api/generate.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "../../lib/supabaseClient";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  try {
    // 1) Ensure user is signed in
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const email = session.user?.email;
    const role = session.user?.role || "client";

    if (!email) {
      return res.status(400).json({ error: "Missing user email" });
    }

    // 2) Credits logic (skip for owners)
    let creditsLeft = null;
    let creditsRow = null;

    if (role !== "owner") {
      // Fetch existing credits row by email
      const { data, error } = await supabase
        .from("credits")
        .select("id, credits_left, email")
        .eq("email", email)
        .maybeSingle();

      if (error) {
        console.error("Supabase select credits error:", error);
        return res.status(500).json({ error: "Credits lookup failed" });
      }

      if (!data) {
        // First time user → give default credits (e.g. 30)
        const { data: inserted, error: insertError } = await supabase
          .from("credits")
          .insert({
            email,
            credits_left: 30,
          })
          .select("id, credits_left, email")
          .single();

        if (insertError) {
          console.error("Supabase insert credits error:", insertError);
          return res.status(500).json({ error: "Credits setup failed" });
        }

        creditsRow = inserted;
      } else {
        creditsRow = data;
      }

      creditsLeft = creditsRow.credits_left;

      if (creditsLeft <= 0) {
        return res.status(403).json({
          error: "No AI credits left. Please contact GabbarInfo to top up.",
        });
      }
    }

    // 3) Read prompt
    const { prompt, temperature = 0.5 } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing prompt" });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-flash-latest",
    });

    let fullText = "";
    let round = 0;
    const maxRounds = 3; // auto-continue internally if needed

    let requestPrompt = prompt;

    while (round < maxRounds) {
      round++;

      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [{ text: requestPrompt }],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens: 1024,
        },
      });

      const response = await result.response;

      const text =
        response.text() ||
        response.candidates?.[0]?.content?.parts
          ?.map((p) => p.text || "")
          .join("") ||
        "";

      if (!text.trim()) break;

      fullText += text;

      const finishReason = response.candidates?.[0]?.finishReason;

      if (
        finishReason === "STOP" ||
        finishReason === "STOPPING" ||
        finishReason === "EOF"
      ) {
        break;
      }

      requestPrompt =
        "Continue the previous answer WITHOUT repeating anything. Only continue from where you stopped.";
    }

    // 4) Deduct 1 credit for non-owners
    let newCreditsLeft = creditsLeft;

    if (role !== "owner" && creditsRow) {
      const updated = creditsLeft - 1;

      const { error: updateError } = await supabase
        .from("credits")
        .update({
          credits_left: updated,
          updated_at: new Date().toISOString(),
        })
        .eq("id", creditsRow.id);

      if (updateError) {
        console.error("Supabase update credits error:", updateError);
        // we won't fail the whole request, just log it
      }

      newCreditsLeft = updated;
    }

    return res.status(200).json({
      text: fullText.trim(),
      creditsLeft: role === "owner" ? null : newCreditsLeft,
      role,
    });
  } catch (err) {
    console.error("GENERATION ERROR:", err);
    return res.status(500).json({
      error: "Server error",
      details: err?.message || err,
    });
  }
}
