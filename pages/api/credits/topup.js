// pages/api/credits/topup.js
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
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session || session.user?.role !== "owner") {
      return res.status(403).json({ error: "Only owner can top up credits" });
    }

    const { email, amount } = req.body || {};
    const normalizedEmail = email?.toLowerCase().trim();

    if (!normalizedEmail || typeof amount !== "number") {
      return res.status(400).json({ error: "Missing email or amount" });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: "Amount must be > 0" });
    }

    const { data, error } = await supabase
      .from("credits")
      .select("credits_left")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (error) {
      console.error("credits/topup select error:", error);
      return res.status(500).json({ error: "Database error" });
    }

    const current = data?.credits_left ?? 0;
    const newCredits = current + amount;

    let upsertError;
    if (data) {
      const { error: updErr } = await supabase
        .from("credits")
        .update({
          credits_left: newCredits,
          updated_at: new Date().toISOString(),
        })
        .eq("email", normalizedEmail);
      upsertError = updErr;
    } else {
      const { error: insErr } = await supabase.from("credits").insert({
        email: normalizedEmail,
        credits_left: newCredits,
      });
      upsertError = insErr;
    }

    if (upsertError) {
      console.error("credits/topup upsert error:", upsertError);
      return res.status(500).json({ error: "Failed to update credits" });
    }

    return res
      .status(200)
      .json({ ok: true, credits: newCredits, email: normalizedEmail });
  } catch (err) {
    console.error("credits/topup exception:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
