// pages/api/credits/check-campaign-publish.js
// Pre-flight check before a Meta Ads campaign publish.
// Returns whether the user has enough credits to cover the
// remaining top-up needed to reach CAMPAIGN_TOTAL_CREDITS (24).
//
// Body: { stepsSpent: number }
// Response: { ok: true, sufficient: bool, currentCredits: N, needed: N, shortBy: N }

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

    // Owners have unlimited credits — always sufficient
    if (role === "owner") {
      return res.status(200).json({ ok: true, sufficient: true, unlimited: true });
    }

    const stepsSpent = Number(req.body?.stepsSpent ?? 0);
    if (!Number.isFinite(stepsSpent) || stepsSpent < 0) {
      return res.status(400).json({ error: "Invalid stepsSpent value" });
    }

    // How many more credits will be deducted at publish time
    const needed = Math.max(0, CAMPAIGN_TOTAL_CREDITS - stepsSpent);

    // If steps already cover the total, no more credits needed → always sufficient
    if (needed === 0) {
      return res.status(200).json({ ok: true, sufficient: true, needed: 0, shortBy: 0 });
    }

    // Fetch current credits
    const { data: creditRow, error } = await supabase
      .from("credits")
      .select("credits_left")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("check-campaign-publish select error:", error);
      return res.status(500).json({ error: "Database error" });
    }

    const currentCredits = creditRow?.credits_left ?? 0;
    const sufficient = currentCredits >= needed;
    const shortBy = sufficient ? 0 : needed - currentCredits;

    return res.status(200).json({
      ok: true,
      sufficient,
      currentCredits,
      needed,
      shortBy,
    });
  } catch (err) {
    console.error("check-campaign-publish exception:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
