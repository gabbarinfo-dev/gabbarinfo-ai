// pages/api/admin/add-user.js
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
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    // 1️⃣ Must be owner
    const session = await getServerSession(req, res, authOptions);
    if (!session || session.user?.role !== "owner") {
      return res.status(403).json({
        error: "Forbidden. Only owner can manage users.",
      });
    }

    const { email, role, addCredits } = req.body;

    if (!email || !role) {
      return res
        .status(400)
        .json({ error: "Email and role are required fields." });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 2️⃣ Insert/update allowed_users table
    const { error: upsertErr } = await supabase
      .from("allowed_users")
      .upsert(
        { email: cleanEmail, role },
        { onConflict: "email" }
      );

    if (upsertErr) {
      console.error("Allowed users error:", upsertErr);
      return res.status(500).json({
        error: "Failed to update allowed users",
        details: upsertErr.message,
      });
    }

    // 3️⃣ Check if they already logged in (profile exists)
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (!profile) {
      return res.status(200).json({
        ok: true,
        message:
          "User added/updated, but they have never logged in yet. Credits will be set only after their first login.",
      });
    }

    // 4️⃣ Add credits if profile exists
    if (typeof addCredits === "number" && addCredits > 0) {
      // Check if credits row exists
      const { data: creditsRow } = await supabase
        .from("credits")
        .select("credits_left")
        .eq("user_id", profile.id)
        .maybeSingle();

      if (!creditsRow) {
        // Create credits row
        await supabase.from("credits").insert({
          user_id: profile.id,
          credits_left: addCredits,
          email: cleanEmail,
        });
      } else {
        // Update credits
        await supabase
          .from("credits")
          .update({
            credits_left: creditsRow.credits_left + addCredits,
          })
          .eq("user_id", profile.id);
      }
    }

    return res.status(200).json({
      ok: true,
      message: `User ${cleanEmail} saved. Role=${role}.`,
    });
  } catch (err) {
    console.error("ADD-USER ERROR:", err);
    return res.status(500).json({
      error: "Server error",
      details: err?.message || String(err),
    });
  }
}
