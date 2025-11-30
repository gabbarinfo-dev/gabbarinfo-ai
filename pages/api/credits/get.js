// pages/api/credits/get.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
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

    // 🔓 Owners = unlimited, no DB checks
    if (role === "owner") {
      return res.status(200).json({
        credits: null,
        unlimited: true,
      });
    }

    // 👇 Clients: look up by EMAIL (matches your table structure)
    let { data, error } = await supabase
      .from("credits")
      .select("credits_left")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("SUPABASE get credits error:", error);
      return res.status(500).json({ error: "Database error" });
    }

    // If no row yet → create with 30 default credits
    if (!data) {
      const { data: inserted, error: insertError } = await supabase
        .from("credits")
        .insert({
          email,
          credits_left: 30,
        })
        .select("credits_left")
        .single();

      if (insertError) {
        console.error("SUPABASE insert credits error:", insertError);
        return res.status(500).json({ error: "Database error" });
      }

      data = inserted;
    }

    return res.status(200).json({
      credits: data.credits_left ?? 0,
      unlimited: false,
    });
  } catch (err) {
    console.error("CREDITS GET ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
