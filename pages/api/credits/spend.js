// pages/api/credits/spend.js

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const DEFAULT_CLIENT_CREDITS = 30;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const email = session.user.email.toLowerCase();
    const role = session.user.role || "client";

    // Owners never spend credits
    if (role === "owner") {
      return res.status(200).json({
        ok: true,
        credits: null,
        unlimited: true,
      });
    }

    let cost = 1;
    if (typeof req.body?.cost === "number" && req.body.cost > 0) {
      cost = Math.floor(req.body.cost);
    }

    // 1) Fetch existing credits row
    let { data, error } = await supabase
      .from("credits")
      .select("id, credits_left")
      .eq("email", email)
      .maybeSingle();

    // If no row → create one with default credits
    if (!data) {
      const { data: inserted, error: insertError } = await supabase
        .from("credits")
        .insert({
          email,
          credits_left: DEFAULT_CLIENT_CREDITS,
        })
        .select("id, credits_left")
        .single();

      if (insertError) {
        console.error("Error inserting credits row:", insertError);
        return res.status(500).json({ error: "Failed to init credits" });
      }

      data = inserted;
    } else if (error) {
      console.error("Error fetching credits:", error);
      return res.status(500).json({ error: "Failed to fetch credits" });
    }

    const current = data.credits_left ?? 0;

    if (current <= 0) {
      return res.status(200).json({
        ok: false,
        reason: "NO_CREDITS",
        credits: 0,
        unlimited: false,
      });
    }

    const newValue = Math.max(0, current - cost);

    const { error: updateError } = await supabase
      .from("credits")
      .update({ credits_left: newValue })
      .eq("id", data.id);

    if (updateError) {
      console.error("Error updating credits:", updateError);
      return res.status(500).json({ error: "Failed to update credits" });
    }

    return res.status(200).json({
      ok: true,
      credits: newValue,
      unlimited: false,
    });
  } catch (err) {
    console.error("POST /api/credits/spend error:", err);
    return res.status(500).json({
      error: "Server error",
      details: err?.message || String(err),
    });
  }
}
