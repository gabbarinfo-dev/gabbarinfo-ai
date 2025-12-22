// pages/api/agent/intake-business.js

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "POST only" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ ok: false, message: "Not authenticated" });
    }

    const email = session.user.email.toLowerCase();

    // 1️⃣ Fetch connected Meta assets (already stored by callback.js)
    const { data: meta } = await supabase
      .from("meta_connections")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (!meta) {
      return res.status(200).json({
        ok: true,
        status: "no_meta_connection",
        message: "No Meta business connected yet",
      });
    }

    // 2️⃣ Build SAFE business summary (NO GRAPH API CALLS)
    const businessProfile = {
      source: "meta_connection",
      business_id: meta.fb_business_id || null,
      ad_account_id: meta.fb_ad_account_id || null,
      page_id: meta.fb_page_id || null,
      instagram_id: meta.ig_business_id || null,
      inferred_location: "India", // default-safe
      inferred_services: [],
      confidence: "partial",
      note:
        "Profile inferred from connected Meta assets only. No Graph reads performed.",
      updated_at: new Date().toISOString(),
    };

    // 3️⃣ Save as agent memory (RAG-safe)
    await supabase.from("agent_memory").upsert(
      {
        email,
        memory_type: "client",
        content: JSON.stringify({
          business_profile: businessProfile,
        }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email,memory_type" }
    );

    return res.status(200).json({
      ok: true,
      status: "business_intake_complete",
      business_profile: businessProfile,
    });
  } catch (err) {
    console.error("Business intake error:", err);
    return res.status(500).json({
      ok: false,
      message: "Business intake failed",
      error: err.message,
    });
  }
}
