// pages/api/credits/consume.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseServer } from "../../lib/supabaseServer";

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

    // Owner: never consume, always unlimited
    if (role === "owner") {
      return res.status(200).json({ credits: null, unlimited: true });
    }

    // Fetch current credits using supabaseServer (service role)
    let { data, error } = await supabaseServer
      .from("credits")
      .select("id, credits_left")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("credits/consume select error:", error);
      return res.status(500).json({ error: "Database error" });
    }

    // If no row exists, auto-provision 30 credits first
    if (!data) {
      try {
        const { data: newRow } = await supabaseServer
          .from("credits")
          .insert({ email, credits_left: 30 })
          .select()
          .single();
        data = newRow;
      } catch (insErr) {
        console.warn("credits/consume auto-provision error:", insErr.message);
      }
    }

    const current = data?.credits_left ?? 30;

    if (current <= 0) {
      return res.status(402).json({
        error: "No credits available. Please contact GabbarInfo to top up.",
        credits: 0,
      });
    }

    const newCredits = current - 1;

    const { error: updateError } = await supabaseServer
      .from("credits")
      .update({ credits_left: newCredits, updated_at: new Date().toISOString() })
      .eq("email", email);

    if (updateError) {
      console.error("credits/consume update error:", updateError);
      return res.status(500).json({ error: "Failed to update credits" });
    }

    return res.status(200).json({ credits: newCredits });
  } catch (err) {
    console.error("credits/consume exception:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
