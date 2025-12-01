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
    const session = await getServerSession(req, res, authOptions);
    if (!session || session.user?.role !== "owner") {
      return res
        .status(403)
        .json({ error: "Forbidden. Only owner can manage users." });
    }

    const { email, role, creditsToAdd } = req.body || {};
    const normalizedEmail = email?.toLowerCase().trim();

    if (!normalizedEmail) {
      return res.status(400).json({ error: "Email is required." });
    }

    const normalizedRole =
      (role || "").toLowerCase() === "owner" ? "Owner" : "client";

    // 1) Upsert into allowed_users
    const { error: upsertError } = await supabase.from("allowed_users").upsert(
      {
        email: normalizedEmail,
        role: normalizedRole,
      },
      { onConflict: "email" }
    );

    if (upsertError) {
      console.error("add-user allowed_users upsert error:", upsertError);
      return res
        .status(500)
        .json({ error: "Failed to upsert allowed_users entry." });
    }

    let creditsInfo = null;

    // 2) If creditsToAdd > 0 → call topup logic directly
    if (typeof creditsToAdd === "number" && creditsToAdd > 0) {
      const { data, error: selErr } = await supabase
        .from("credits")
        .select("credits_left")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (selErr) {
        console.error("add-user credits select error:", selErr);
        return res
          .status(500)
          .json({ error: "User saved, but failed to read credits." });
      }

      const current = data?.credits_left ?? 0;
      const newCredits = current + creditsToAdd;

      let upErr;
      if (data) {
        const { error } = await supabase
          .from("credits")
          .update({
            credits_left: newCredits,
            updated_at: new Date().toISOString(),
          })
          .eq("email", normalizedEmail);
        upErr = error;
      } else {
        const { error } = await supabase.from("credits").insert({
          email: normalizedEmail,
          credits_left: newCredits,
        });
        upErr = error;
      }

      if (upErr) {
        console.error("add-user credits upsert error:", upErr);
        return res.status(500).json({
          error: "User saved, but failed to update credits.",
        });
      }

      creditsInfo = { credits: newCredits };
    }

    return res.status(200).json({
      ok: true,
      email: normalizedEmail,
      role: normalizedRole,
      credits: creditsInfo?.credits ?? null,
      message:
        creditsInfo?.credits != null
          ? `User saved. Credits now: ${creditsInfo.credits}.`
          : "User saved/updated.",
    });
  } catch (err) {
    console.error("add-user exception:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
