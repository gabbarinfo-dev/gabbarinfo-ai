// pages/api/admin/add-user.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

// Use service key on server-side for secure writes
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

    // Accept both "creditsToAdd" (from UI) and "addCredits" (older name)
    const { email, role, creditsToAdd, addCredits } = req.body;

    if (!email || !role) {
      return res
        .status(400)
        .json({ error: "Email and role are required fields." });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Normalize credits value to a number
    const rawCredits = creditsToAdd ?? addCredits ?? 0;
    const creditsNum = Number(rawCredits) || 0;

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

    // If profile doesn't exist yet, we just save allowed_users and exit
    if (!profile) {
      return res.status(200).json({
        ok: true,
        email: cleanEmail,
        role,
        credits: 0,
        message:
          "User added/updated, but they have never logged in yet. Credits will be set only after their first login.",
      });
    }

    // 4️⃣ Add credits if profile exists and creditsNum > 0
    if (creditsNum > 0) {
      // Check if credits row exists
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
        // Create credits row
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
      } else {
        // Update credits
        const { error: creditsUpdateErr } = await supabase
          .from("credits")
          .update({
            credits_left: creditsRow.credits_left + creditsNum,
          })
          .eq("user_id", profile.id);

        if (creditsUpdateErr) {
          console.error("Credits update error:", creditsUpdateErr);
          return res.status(500).json({
            error: "Failed to update credits",
            details: creditsUpdateErr.message,
          });
        }
      }
    }

    return res.status(200).json({
      ok: true,
      email: cleanEmail,
      role,
      credits: creditsNum,
      message: `User ${cleanEmail} saved. Role=${role}${
        creditsNum > 0 ? ` · Added credits: ${creditsNum}` : ""
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
