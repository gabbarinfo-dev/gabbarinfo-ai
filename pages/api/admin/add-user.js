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
    // 1️⃣ Check that the caller is logged in and is an OWNER
    const session = await getServerSession(req, res, authOptions);

    if (!session || session.user?.role !== "owner") {
      return res
        .status(403)
        .json({ error: "Forbidden. Only owner can manage users." });
    }

    const { email, role = "client", creditsToAdd = 0 } = req.body || {};

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanRole = role === "owner" ? "owner" : "client";
    const creditsDelta = Number(creditsToAdd) || 0;

    // 2️⃣ Upsert into allowed_users (controls who can log in + role)
    const { data: allowedUser, error: allowedErr } = await supabase
      .from("allowed_users")
      .upsert(
        {
          email: cleanEmail,
          role: cleanRole,
        },
        { onConflict: "email" }
      )
      .select()
      .maybeSingle();

    if (allowedErr) {
      console.error("allowed_users upsert error:", allowedErr);
      return res.status(500).json({
        error: "Failed to upsert allowed user.",
        details: allowedErr.message || allowedErr,
      });
    }

    let creditsInfo = null;

    // 3️⃣ If creditsToAdd > 0, try to top up credits based on email
    if (creditsDelta > 0) {
      // Find profile by email
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (profileErr) {
        console.error("profiles lookup error:", profileErr);
        // We still consider user added, just report the problem
        creditsInfo = {
          message:
            "User added/updated, but failed to adjust credits (profile lookup error).",
        };
      } else if (!profile) {
        // User has not logged in yet → no profile row
        creditsInfo = {
          message:
            "User added/updated, but they have never logged in, so credits cannot be set yet.",
        };
      } else {
        // We have a profile.id → update or insert credits row
        const userId = profile.id;

        const { data: existing, error: existingErr } = await supabase
          .from("credits")
          .select("id, credits_left")
          .eq("user_id", userId)
          .maybeSingle();

        if (existingErr) {
          console.error("credits lookup error:", existingErr);
          creditsInfo = {
            message:
              "User added/updated, but failed to adjust credits (credits lookup error).",
          };
        } else if (existing) {
          const newAmount = (existing.credits_left || 0) + creditsDelta;
          const { error: updateErr } = await supabase
            .from("credits")
            .update({ credits_left: newAmount })
            .eq("id", existing.id);

          if (updateErr) {
            console.error("credits update error:", updateErr);
            creditsInfo = {
              message:
                "User added/updated, but failed to update credits amount.",
            };
          } else {
            creditsInfo = {
              message: `Credits updated successfully.`,
              credits: newAmount,
            };
          }
        } else {
          // No credits row yet → insert one
          const { data: inserted, error: insertErr } = await supabase
            .from("credits")
            .insert({
              user_id: userId,
              credits_left: creditsDelta,
            })
            .select()
            .maybeSingle();

          if (insertErr) {
            console.error("credits insert error:", insertErr);
            creditsInfo = {
              message:
                "User added/updated, but failed to insert credits row.",
            };
          } else {
            creditsInfo = {
              message: "Credits created successfully.",
              credits: inserted.credits_left,
            };
          }
        }
      }
    }

    return res.status(200).json({
      ok: true,
      user: {
        email: allowedUser?.email || cleanEmail,
        role: allowedUser?.role || cleanRole,
      },
      credits: creditsInfo,
    });
  } catch (err) {
    console.error("admin/add-user error:", err);
    return res.status(500).json({
      error: "Internal server error",
      details: err?.message || String(err),
    });
  }
}
