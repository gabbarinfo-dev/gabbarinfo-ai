// pages/api/admin/add-user.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
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

    const { email, role, creditsToAdd, addCredits } = req.body;

    if (!email || !role) {
      return res
        .status(400)
        .json({ error: "Email and role are required fields." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const rawCredits = creditsToAdd ?? addCredits ?? 0;
    const creditsNum = Number(rawCredits) || 0;

    // 2️⃣ Insert/update allowed_users table
    const { error: upsertErr } = await supabase
      .from("allowed_users")
      .upsert({ email: cleanEmail, role }, { onConflict: "email" });

    if (upsertErr) {
      console.error("Allowed users error:", upsertErr);
      return res.status(500).json({
        error: "Failed to update allowed users",
        details: upsertErr.message,
      });
    }

    // 3️⃣ Check if they already logged in (profile exists)
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (profileErr) {
      console.error("Profile lookup error:", profileErr);
      return res.status(500).json({
        error: "Failed to lookup profile",
        details: profileErr.message,
      });
    }

    if (!profile) {
      // They haven't logged in yet; just save allowed_users
      return res.status(200).json({
        ok: true,
        email: cleanEmail,
        role,
        credits: 0,
        message:
          "User added/updated, but they have never logged in yet. Credits will be set after first login.",
      });
    }

    // 4️⃣ Add credits if profile exists and creditsNum > 0
    let finalCredits = null;

    if (creditsNum > 0) {
      const { data: creditsRow, error: creditsLookupErr } = await supabase
        .from("credits")
        .select("credits_left")
        .eq("user_id", profile.id)
        .maybeSingle();

      if (creditsLookupErr) {
        console.error("Credits lookup error:", creditsLookupErr);
        return res.status(500).json({
          error: "Failed to lookup credits",
          details: creditsLookupErr.message,
        });
      }

      if (!creditsRow) {
        const { error: creditsInsertErr } = await supabase
          .from("credits")
          .insert({
            user_id: profile.id,
            credits_left: creditsNum,
            email: cleanEmail,
          });

        if (creditsInsertErr) {
          console.error("Credits insert error:", creditsInsertErr);
          return res.status(500).json({
            error: "Failed to create credits row",
            details: creditsInsertErr.message,
          });
        }
        finalCredits = creditsNum;
      } else {
        const newCredits = creditsRow.credits_left + creditsNum;

        const { error: creditsUpdateErr } = await supabase
          .from("credits")
          .update({ credits_left: newCredits })
          .eq("user_id", profile.id);

        if (creditsUpdateErr) {
          console.error("Credits update error:", creditsUpdateErr);
          return res.status(500).json({
            error: "Failed to update credits",
            details: creditsUpdateErr.message,
          });
        }
        finalCredits = newCredits;
      }
    }

    return res.status(200).json({
      ok: true,
      email: cleanEmail,
      role,
      credits: finalCredits,
      message: `User ${cleanEmail} saved. Role=${role}${
        finalCredits !== null ? ` · Credits now: ${finalCredits}` : ""
      }.`,
    });
  } catch (err) {
    console.error("ADD-USER ERROR:", err);
    return res.status(500).json({
      error: "Server error",
      details: err?.message || String(err),
    });
  }
}
