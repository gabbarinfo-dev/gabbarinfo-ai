// pages/api/credits/get.js

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Default starting credits for a new client
const DEFAULT_CREDITS = 30;

export default async function handler(req, res) {
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

    // Owners: unlimited
    if (role === "owner") {
      return res.status(200).json({
        credits: null,
        unlimited: true,
      });
    }

    // Look for credits row by email
    const { data: creditRow, error } = await supabase
      .from("credits")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("Supabase error in /credits/get:", error);
      return res.status(500).json({ error: "Database error" });
    }

    // If no row, auto-create one with DEFAULT_CREDITS
    if (!creditRow) {
      const { data: inserted, error: insertError } = await supabase
        .from("credits")
        .insert({
          email,
          credits_left: DEFAULT_CREDITS,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Supabase insert error in /credits/get:", insertError);
        return res.status(500).json({ error: "Failed to create credits row" });
      }

      return res.status(200).json({
        credits: inserted.credits_left ?? 0,
        unlimited: false,
      });
    }

    // Row exists
    return res.status(200).json({
      credits: creditRow.credits_left ?? 0,
      unlimited: false,
    });
  } catch (err) {
    console.error("CREDITS GET ERROR:", err);
    return res.status(500).json({
      error: "Server error",
      details: err?.message || String(err),
    });
  }
}
