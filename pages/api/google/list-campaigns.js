// pages/api/google/list-campaigns.js
// NOTE: This endpoint is not yet implemented.
// Google Ads campaign listing is handled via the Google Ads API directly
// in the main ads workstation components.
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { getAccessToken } from "../../../lib/googleAdsClient";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.email) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    // Get access token for Google Ads API
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return res.status(500).json({ ok: false, error: "Failed to obtain Google Ads access token." });
    }

    // Campaign listing is handled via the Google Ads workstation UI.
    // This endpoint is reserved for future direct API integration.
    return res.status(501).json({
      ok: false,
      error: "Campaign listing via this endpoint is not yet implemented. Use the Google Ads workstation.",
    });
  } catch (err) {
    console.error("Error in list-campaigns:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
