// pages/api/gmb/create-location.js
// Provisions a new Google Business Profile Location via the My Business Business Information API

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import { getGmbAccessToken, listGmbAccounts, createGmbLocation } from "../../../lib/gmbHelper";

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
    const {
      businessName,
      categoryName,
      address,
      addressLines,
      city,
      state,
      postalCode,
      regionCode,
      phone,
      website,
      accountName: preferredAccountName,
    } = req.body;

    if (!businessName) {
      return res.status(400).json({ ok: false, message: "Business name is required." });
    }

    // 1. Fetch user's Google connection
    const { data: connection } = await supabase
      .from("google_connections")
      .select("refresh_token")
      .eq("email", email)
      .maybeSingle();

    const refreshToken = connection?.refresh_token || session.refreshToken || null;

    if (!refreshToken) {
      return res.status(400).json({
        ok: false,
        message: "No Google authorization found. Please sign in with Google first.",
      });
    }

    // 2. Exchange token
    const tokenResult = await getGmbAccessToken({ refreshToken });
    if (!tokenResult.ok) {
      return res.status(400).json({ ok: false, message: "Failed to exchange Google OAuth token." });
    }

    const { accessToken, scope } = tokenResult;
    if (!(scope || "").includes("business.manage")) {
      return res.status(403).json({
        ok: false,
        needsReauth: true,
        message: "Missing Google Business Profile permission. Please re-authenticate.",
      });
    }

    // 3. Determine GMB account
    let accountName = preferredAccountName;
    if (!accountName) {
      const accountsRes = await listGmbAccounts({ accessToken });
      if (!accountsRes.ok || !accountsRes.accounts?.length) {
        return res.status(400).json({
          ok: false,
          message: "No Google Business Profile account found to create the location under.",
        });
      }
      accountName = accountsRes.accounts[0].name;
    }

    // 4. Create Location
    const creationRes = await createGmbLocation({
      accessToken,
      accountName,
      locationData: {
        title: businessName,
        categoryName: categoryName || "categories/gcid:digital_marketing_agency",
        addressLines: addressLines || (address ? [address] : []),
        locality: city || "",
        administrativeArea: state || "",
        postalCode: postalCode || "",
        regionCode: regionCode || "IN",
        phone: phone || "",
        website: website || "",
      },
    });

    if (!creationRes.ok) {
      return res.status(400).json({
        ok: false,
        message: creationRes.error || "Failed to create Google Business Profile listing.",
        details: creationRes.json,
      });
    }

    const newLocation = creationRes.location;

    // 5. Store created location in agent_memory as selected location
    await supabase.from("agent_memory").upsert(
      {
        email,
        memory_type: "selected_gmb_location",
        content: JSON.stringify(newLocation),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email,memory_type" }
    );

    return res.status(200).json({
      ok: true,
      message: `Google Business Profile "${businessName}" created successfully!`,
      location: newLocation,
    });
  } catch (err) {
    console.error("GMB location creation error:", err);
    return res.status(500).json({ ok: false, message: err.message });
  }
}
