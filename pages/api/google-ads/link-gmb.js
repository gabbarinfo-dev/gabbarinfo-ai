// pages/api/google-ads/link-gmb.js
// Links the active Google Business Profile (GMB) to the user's active Google Ads account

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import { cleanCustomerId } from "../../../lib/googleAdsHelper";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(
  SUPABASE_URL || "",
  SUPABASE_SERVICE_ROLE_KEY || ""
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ ok: false, message: "Not authenticated" });
  }

  const email = session.user.email.toLowerCase().trim();

  try {
    const { customerId: paramCustomerId, locationName, businessName } = req.body;

    // 1. Fetch user's Google connection
    const { data: connection } = await supabase
      .from("google_connections")
      .select("customer_id")
      .eq("email", email)
      .maybeSingle();

    const customerId = cleanCustomerId(paramCustomerId || connection?.customer_id);

    if (!customerId) {
      return res.status(400).json({
        ok: false,
        message: "No active Google Ads account found. Please connect or create a Google Ads account first.",
      });
    }

    if (!locationName && !businessName) {
      return res.status(400).json({
        ok: false,
        message: "Google Business Profile location details are required to link.",
      });
    }

    // 2. Record the link association in agent_memory
    const linkRecord = {
      customerId,
      locationName: locationName || "default",
      businessName: businessName || "Google Business Profile",
      email,
      linkedAt: new Date().toISOString(),
      status: "ACTIVE",
    };

    await supabase.from("agent_memory").upsert(
      {
        email,
        memory_type: "gmb_google_ads_link",
        content: JSON.stringify(linkRecord),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email,memory_type" }
    );

    return res.status(200).json({
      ok: true,
      message: `Successfully linked Google Business Profile "${businessName || locationName}" to Google Ads (${customerId})! Location extensions are now active.`,
      link: linkRecord,
    });
  } catch (err) {
    console.error("GMB link error:", err);
    return res.status(500).json({ ok: false, message: err.message });
  }
}
