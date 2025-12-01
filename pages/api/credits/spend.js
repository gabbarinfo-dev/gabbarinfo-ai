// pages/api/credits/spend.js

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const DEFAULT_CREDITS = 30;

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

    // Owners have unlimited credits, never decremented
    if (role === "owner") {
      return res.status(200).json({
        ok: true,
        creditsLeft: null,
        unlimited: true,
      });
    }

    // Fetch credits row by email
    const { data: creditRow, error } = await supabase
      .from("credits")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("Supabase error in /credits/spend:", error);
      return res.status(500).json({ error: "Database error" });
    }

    let currentCredits;
    let rowId;

    if (!creditRow) {
      // No row yet → create one with DEFAULT_CREDITS first
      currentCredits = DEFAULT_CREDITS;
      const { data: inserted, error: insertError } = await supabase
        .from("credits")
        .insert({
          email,
          credits_left: DEFAULT_CREDITS,
        })
        .select()
        .single();

      if (insertError) {
        console.error(
          "Supabase insert error in /credits/spend (auto-create):",
          insertError
        );
        return res.status(500).json({ error: "Failed to create credits row" });
      }

      rowId = inserted.id;
    } else {
      currentCredits = creditRow.credits_left ?? 0;
      rowId = creditRow.id;
    }

    if (currentCredits < amount) {
      // Not enough credits
      return res.status(402).json({
        error: "Not enough credits",
        creditsLeft: currentCredits,
      });
    }

    const newCredits = currentCredits - amount;

    const { error: updateError } = await supabase
      .from("credits")
      .update({ credits_left: newCredits })
      .eq("id", rowId);

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
