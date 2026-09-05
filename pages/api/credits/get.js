// pages/api/credits/get.js

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const role = session.user?.role || "client";
    const rawEmail = session.user?.email;
    const email = rawEmail ? rawEmail.toLowerCase().trim() : null;

    // Owners have unlimited credits
    if (role === "owner") {
      return res.status(200).json({ credits: null, unlimited: true });
    }

    // 🔹 If email exists, check DB via supabaseServer (bypasses RLS)
    if (email) {
      const { data, error } = await supabaseServer
        .from("credits")
        .select("credits_left")
        .eq("email", email)
        .maybeSingle();

      if (error) {
        console.error("credits/get error:", error);
      }

      // If user has no credits row in DB, auto-provision 30 free starter credits
      if (!data) {
        try {
          await supabaseServer
            .from("credits")
            .insert({ email, credits_left: 30 });
        } catch (insErr) {
          console.warn("credits/get auto-provision insert warning:", insErr.message);
        }

        return res.status(200).json({
          credits: 30,
          unlimited: false,
        });
      }

      return res.status(200).json({
        credits: data.credits_left ?? 30,
        unlimited: false,
      });
    }

    // 🔹 Fallback for session without email (e.g. initial provisional state)
    return res.status(200).json({
      credits: 30,
      unlimited: false,
      provisional: true,
    });

  } catch (err) {
    console.error("credits/get exception:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
