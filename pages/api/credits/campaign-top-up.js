// pages/api/credits/campaign-top-up.js
// Deducts the remaining credits to ensure a completed Meta Ads campaign
// costs a total of CAMPAIGN_TOTAL_CREDITS (24), regardless of how many
// step-by-step credits were already spent during the conversation.

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const CAMPAIGN_TOTAL_CREDITS = 24;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const email = session.user?.email?.toLowerCase().trim();
    const role = session.user?.role || "client";

    if (!email) {
      return res.status(400).json({ error: "Missing email" });
    }

    // Owners have unlimited credits — skip deduction
    if (role === "owner") {
      return res.status(200).json({ ok: true, creditsLeft: null, unlimited: true });
    }

    // stepsSpent = credits already deducted during this campaign conversation
    const stepsSpent = Number(req.body?.stepsSpent ?? 0);
    if (!Number.isFinite(stepsSpent) || stepsSpent < 0) {
      return res.status(400).json({ error: "Invalid stepsSpent value" });
    }

    const remaining = Math.max(0, CAMPAIGN_TOTAL_CREDITS - stepsSpent);

    // If the user already exhausted or exceeded 24 credits, nothing more to deduct
    if (remaining === 0) {
      const { data } = await supabase
        .from("credits")
        .select("credits_left")
        .eq("email", email)
        .maybeSingle();
      return res.status(200).json({ ok: true, creditsLeft: data?.credits_left ?? 0, extraDeducted: 0 });
    }

    // Fetch user's current credits
    const { data: creditRow, error } = await supabase
      .from("credits")
      .select("id, credits_left")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("campaign-top-up select error:", error);
      return res.status(500).json({ error: "Database error" });
    }

    if (!creditRow) {
      return res.status(402).json({ error: "No credits record found." });
    }

    const currentCredits = creditRow.credits_left ?? 0;

    // Clamp so we never go below 0
    const newCredits = Math.max(0, currentCredits - remaining);
    const actualDeducted = currentCredits - newCredits;

    const { error: updateError } = await supabase
      .from("credits")
      .update({ credits_left: newCredits, updated_at: new Date().toISOString() })
      .eq("id", creditRow.id);

    if (updateError) {
      console.error("campaign-top-up update error:", updateError);
      return res.status(500).json({ error: "Failed to update credits" });
    }

    return res.status(200).json({
      ok: true,
      creditsLeft: newCredits,
      extraDeducted: actualDeducted,
    });
  } catch (err) {
    console.error("campaign-top-up exception:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
