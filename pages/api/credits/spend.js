// pages/api/credits/spend.js
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
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const email = session.user?.email?.toLowerCase();
    const role = session.user?.role || "client";

    if (!email) {
      return res.status(400).json({ error: "Missing email" });
    }

    // 🔓 Owners never spend credits
    if (role === "owner") {
      return res.status(200).json({
        ok: true,
        credits: null,
        unlimited: true,
      });
    }

    // 👇 Clients: fetch credits row by EMAIL
    const { data, error } = await supabase
      .from("credits")
      .select("id, credits_left")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("SUPABASE use credits select error:", error);
      return res.status(500).json({ error: "Database error" });
    }

    // No row or zero credits → block
    if (!data || data.credits_left <= 0) {
      return res.status(402).json({
        error: "No credits left",
      });
    }

    const newCredits = data.credits_left - 1;

    const { error: updateError } = await supabase
      .from("credits")
      .update({ credits_left: newCredits })
      .eq("id", data.id);

    if (updateError) {
      console.error("SUPABASE use credits update error:", updateError);
      return res.status(500).json({ error: "Database error" });
    }

    return res.status(200).json({
      ok: true,
      credits: newCredits,
      unlimited: false,
    });
  } catch (err) {
    console.error("CREDITS USE ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
