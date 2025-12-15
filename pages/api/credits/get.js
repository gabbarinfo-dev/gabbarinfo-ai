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

    const email = session.user?.email?.toLowerCase().trim();
    const role = session.user?.role || "client";

    // Owner: treat as unlimited
    if (role === "owner") {
      return res.status(200).json({ credits: null, unlimited: true });
    }

    const { data, error } = await supabase
      .from("credits")
      .select("credits_left")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("credits/get error:", error);
      return res.status(500).json({ error: "Database error" });
    }

    const credits = data?.credits_left ?? 0;

    return res.status(200).json({
      credits,
      unlimited: false,
    });
  } catch (err) {
    console.error("credits/get exception:", err);

