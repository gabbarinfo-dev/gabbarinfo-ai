// pages/api/credits/get.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  try {
    // 1) Require logged-in user
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user?.email) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const email = session.user.email.toLowerCase();

    // 2) Safety check: env vars
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        error: "Supabase is not configured on the server (missing env vars).",
      });
    }

    // 3) Try to read credits row for this email
    const { data, error } = await supabaseAdmin
      .from("credits")
      .select("credits_left")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("SUPABASE CREDITS GET ERROR:", error);
      return res.status(500).json({ error: "Failed to load credits" });
    }

    // 4) If no row yet, create one with default credits (e.g. 30)
    if (!data) {
      const defaultCredits = 30;
      const { error: insertError } = await supabaseAdmin
        .from("credits")
        .insert({
          email,
          credits_left: defaultCredits,
        });

      if (insertError) {
        console.error("SUPABASE CREDITS INSERT ERROR:", insertError);
        return res.status(500).json({ error: "Failed to init credits" });
      }

      return res.status(200).json({ credits: defaultCredits });
    }

    // 5) Return current credits
    return res.status(200).json({ credits: data.credits_left ?? 0 });
  } catch (err) {
    console.error("CREDITS GET API ERROR:", err);
    return res.status(500).json({
      error: "Internal server error",
      detail: String(err),
    });
  }
}
