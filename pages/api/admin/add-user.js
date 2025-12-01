// pages/api/admin/user.js

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
    // 1️⃣ Check that caller is logged in and is an OWNER
    const session = await getServerSession(req, res, authOptions);

    if (!session || session.user?.role !== "owner") {
      return res.status(403).json({ error: "Not authorised" });
    }

    const { email, role, creditsToAdd } = req.body || {};

    const normalizedEmail = (email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      return res.status(400).json({ error: "Email is required" });
    }

    const normalizedRole =
      role === "owner" || role === "Owner" ? "owner" : "client";

    const creditsNumber = parseInt(creditsToAdd, 10) || 0;

    // 2️⃣ Upsert into allowed_users (who can sign in + their role)
    const { error: allowErr } = await supabase.from("allowed_users").upsert(
      {
        email: normalizedEmail,
        role: normalizedRole,
      },
      { onConflict: "email" }
    );

    if (allowErr) {
      console.error("Error upserting allowed_users:", allowErr);
      return res
        .status(500)
        .json({ error: "Failed to save allowed user", detail: allowErr.message });
    }

    let finalCredits = null;

    // 3️⃣ Add credits (by email) — even if they have NEVER logged in
    if (creditsNumber > 0) {
      // Check if row exists
      const { data: existing, error: selErr } = await supabase
        .from("credits")
        .select("id, credits_left")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (selErr) {
        console.error("Error selecting credits:", selErr);
        return res.status(500).json({
          error: "Failed to read credits",
          detail: selErr.message,
        });
      }

      if (existing) {
        // Update: add to existing credits
        const newAmount = (existing.credits_left || 0) + creditsNumber;

        const { error: updErr } = await supabase
          .from("credits")
          .update({ credits_left: newAmount })
          .eq("id", existing.id);

        if (updErr) {
          console.error("Error updating credits:", updErr);
          return res.status(500).json({
            error: "Failed to update credits",
            detail: updErr.message,
          });
        }

        finalCredits = newAmount;
      } else {
        // Insert: first-time credits for this email
        const { data: inserted, error: insErr } = await supabase
          .from("credits")
          .insert({
            email: normalizedEmail,
            credits_left: creditsNumber,
          })
          .select("credits_left")
          .single();

        if (insErr) {
          console.error("Error inserting credits:", insErr);
          return res.status(500).json({
            error: "Failed to create credits",
            detail: insErr.message,
          });
        }

        finalCredits = inserted.credits_left;
      }
    }

    return res.status(200).json({
      ok: true,
      email: normalizedEmail,
      role: normalizedRole,
      credits: finalCredits, // may be null if creditsToAdd was 0
      message:
        creditsNumber > 0
          ? `User saved. Total credits for ${normalizedEmail}: ${finalCredits}.`
          : `User saved with role: ${normalizedRole}.`,
    });
  } catch (err) {
    console.error("ADMIN USER ERROR:", err);
    return res.status(500).json({
      error: "Server error",
      detail: err?.message || String(err),
    });
  }
}
