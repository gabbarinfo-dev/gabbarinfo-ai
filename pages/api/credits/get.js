// pages/api/credits/get.js

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const DEFAULT_CLIENT_CREDITS = 30;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const email = session.user.email.toLowerCase();
    const role = session.user.role || "client";

    // Owners have unlimited credits, we don't even look in DB
    if (role === "owner") {
      return res.status(200).json({
        credits: null,
        unlimited: true,
      });
    }

    // Clients: look up credits row by email
    const { data, error } = await supabase
      .from("credits")
      .select("id, credits_left")
      .eq("email", email)
      .maybeSingle();

    // If no row yet → create one with default credits
    if (!data) {
      const { data: inserted, error: insertError } = await supabase
        .from("credits")
        .insert({
          email,
          credits_left: DEFAULT_CLIENT_CREDITS,
        })
        .select("id, credits_left")
        .single();

      if (insertError) {
        console.error("Error inserting credits row:", insertError);
        return res.status(500).json({ error: "Failed to init credits" });
      }

      return res.status(200).json({
        credits: inserted.credits_left,
        unlimited: false,
      });
    }

    if (error) {
      console.error("Error fetching credits:", error);
      return res.status(500).json({ error: "Failed to fetch credits" });
    }

    return res.status(200).json({
      credits: data.credits_left ?? 0,
      unlimited: false,
    });
  } catch (err) {
    console.error("GET /api/credits/get error:", err);
    return res.status(500).json({
      error: "Server error",
      details: err?.message || String(err),
    });
  }
}
