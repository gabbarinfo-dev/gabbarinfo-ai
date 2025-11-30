// pages/api/credits/consume.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user?.email) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const email = session.user.email.toLowerCase();
    const role = session.user.role || "client";

    // Owner / unlimited → don't touch DB, just return unlimited
    if (role === "owner") {
      return res.status(200).json({
        credits: null,
        unlimited: true,
      });
    }

    // 1) Get profile by email
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();

    if (profileError) {
      console.error("profileError in /api/credits/consume:", profileError);
      return res.status(500).json({ error: "Profile lookup failed" });
    }

    if (!profile) {
      // No profile → no credits
      return res.status(402).json({
        error: "No credits available. Please contact GabbarInfo to top up.",
      });
    }

    const userId = profile.id;

    // 2) Read current credits
    const { data: creditsRow, error: creditsError } = await supabase
      .from("credits")
      .select("id, credits_left")
      .eq("user_id", userId)
      .maybeSingle();

    if (creditsError) {
      console.error("creditsError in /api/credits/consume:", creditsError);
      return res.status(500).json({ error: "Credits lookup failed" });
    }

    if (!creditsRow || typeof creditsRow.credits_left !== "number") {
      // No credits row or invalid value
      return res.status(402).json({
        error: "You’ve run out of credits. Please contact GabbarInfo to top up.",
      });
    }

    const current = creditsRow.credits_left;

    if (current <= 0) {
      return res.status(402).json({
        error: "You’ve run out of credits. Please contact GabbarInfo to top up.",
      });
    }

    // 3) Decrement by 1
    const newValue = current - 1;

    const { error: updateError } = await supabase
      .from("credits")
      .update({ credits_left: newValue })
      .eq("id", creditsRow.id);

    if (updateError) {
      console.error("updateError in /api/credits/consume:", updateError);
      return res.status(500).json({ error: "Failed to update credits" });
    }

    return res.status(200).json({
      credits: newValue,
      unlimited: false,
    });
  } catch (err) {
    console.error("Unexpected error in /api/credits/consume:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
