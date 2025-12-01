// pages/api/credits/spend.js

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const email = session.user?.email?.toLowerCase();
    const role = session.user?.role || "client";

    if (!email) {
      return res.status(400).json({ error: "Missing email in session" });
    }

    const amount = Number(req.body?.amount || 1);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    // 🔓 Owners never pay credits
    if (role === "owner") {
      return res.status(200).json({
        ok: true,
        creditsLeft: null,
        unlimited: true,
      });
    }

    // 🔍 Get credit row by email
    const { data: creditRow, error } = await supabase
      .from("credits")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("Supabase error in /credits/spend:", error);
      return res.status(500).json({ error: "Database error" });
    }

    if (!creditRow) {
      // No row for this user – treat as 0 credits
      return res.status(402).json({
        error: "No credits for this user",
        creditsLeft: 0,
      });
    }

    const current = creditRow.credits_left ?? 0;

    if (current < amount) {
      // Not enough credits
      return res.status(402).json({
        error: "Not enough credits",
        creditsLeft: current,
      });
    }

    const newCredits = current - amount;

    const { error: updateError } = await supabase
      .from("credits")
      .update({ credits_left: newCredits })
      .eq("id", creditRow.id);

    if (updateError) {
      console.error("Supabase update error in /credits/spend:", updateError);
      return res.status(500).json({ error: "Failed to update credits" });
    }

    return res.status(200).json({
      ok: true,
      creditsLeft: newCredits,
      unlimited: false,
    });
  } catch (err) {
    console.error("CREDITS SPEND ERROR:", err);
    return res.status(500).json({
      error: "Server error",
      details: err?.message || String(err),
    });
  }
}
