// pages/api/credits/get.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user?.email) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const email = session.user.email.toLowerCase();
    const role = session.user.role || "client";

    // Owner has unlimited usage, no need to hit DB
    if (role === "owner") {
      return res.status(200).json({
        credits: null,
        unlimited: true,
      });
    }

    // Get profile by email
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();

    if (profileError) {
      console.error("profileError in /api/credits/get:", profileError);
      return res.status(500).json({ error: "Profile lookup failed" });
    }

    if (!profile) {
      // No profile yet → treat as 0 credits
      return res.status(200).json({
        credits: 0,
        unlimited: false,
      });
    }

    const userId = profile.id;

    // Get credits row for this user
    const { data: creditsRow, error: creditsError } = await supabase
      .from("credits")
      .select("credits_left")
      .eq("user_id", userId)
      .maybeSingle();

    if (creditsError) {
      console.error("creditsError in /api/credits/get:", creditsError);
      return res.status(500).json({ error: "Credits lookup failed" });
    }

    if (!creditsRow) {
      // No credits row yet → treat as 0
      return res.status(200).json({
        credits: 0,
        unlimited: false,
      });
    }

    return res.status(200).json({
      credits: creditsRow.credits_left ?? 0,
      unlimited: false,
    });
  } catch (err) {
    console.error("Unexpected error in /api/credits/get:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
