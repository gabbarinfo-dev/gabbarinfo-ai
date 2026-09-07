// pages/api/google-ads/attach-pmax-assets.js
// Dedicated endpoint to attach a complete, valid Asset Group (Headlines, Long Headline, Descriptions,
// Business Name, Marketing Images, Logo, and Search Themes) to any existing Performance Max campaign.

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import {
  cleanCustomerId,
  exchangeRefreshToken,
  resolveCampaignImagesAndLogo,
  createPerformanceMaxAssetGroupAndAssets,
} from "../../../lib/googleAdsHelper";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseServer = createClient(
  SUPABASE_URL || "",
  SUPABASE_SERVICE_ROLE_KEY || ""
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Only POST is allowed." });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    const email = session?.user?.email?.toLowerCase()?.trim();
    if (!email) {
      return res.status(401).json({ ok: false, message: "Not authenticated" });
    }

    const body = req.body || {};
    const incomingCustomerId = body.customerId;
    const incomingCampaignId = body.campaignId;

    // Look up connection and last campaign details
    const { data: conn } = await supabaseServer
      .from("google_connections")
      .select("refresh_token, customer_id, manager_id")
      .eq("email", email)
      .maybeSingle();

    const refreshToken = conn?.refresh_token;
    if (!refreshToken) {
      return res.status(400).json({ ok: false, message: "No active Google Ads connection found. Please connect your Google Ads account." });
    }

    const customerId = cleanCustomerId(incomingCustomerId || conn?.customer_id);
    if (!customerId) {
      return res.status(400).json({ ok: false, message: "Missing Google Ads customerId." });
    }

    const managerId = conn?.manager_id || null;

    // Exchange refresh token
    const tokenRes = await exchangeRefreshToken({ refreshToken });
    if (!tokenRes.ok || !tokenRes.accessToken) {
      return res.status(400).json({ ok: false, message: "Could not refresh Google Ads access token." });
    }
    const accessToken = tokenRes.accessToken;

    // Campaign ID
    const campaignId = String(incomingCampaignId || "24223080137").trim();
    const campaignResourceName = `customers/${customerId}/campaigns/${campaignId}`;

    const businessName = body.businessName || "Gabbarinfo";
    const finalUrl = body.finalUrl || "https://www.gabbarinfo.com/";

    // Resolve images and logo
    let resolvedImages = [];
    let resolvedLogo = null;
    try {
      const imgRes = await resolveCampaignImagesAndLogo({
        accessToken,
        customerId,
        landingPageUrl: finalUrl,
        businessName,
        loginCustomerId: managerId,
      });
      resolvedImages = imgRes.images || [];
      resolvedLogo = imgRes.logo || null;
    } catch (imgErr) {
      console.warn("Image resolution warning:", imgErr.message);
    }

    const adGroups = [
      {
        name: body.assetGroupName || `Asset Group - ${businessName.slice(0, 15)}`,
        searchThemes: Array.isArray(body.searchThemes) && body.searchThemes.length > 0
          ? body.searchThemes
          : [
              "digital marketing ahmedabad",
              "seo services ahmedabad",
              "web development ahmedabad",
              "google ads management",
              "social media marketing",
            ],
        ads: [
          {
            headlines: Array.isArray(body.headlines) && body.headlines.length >= 3
              ? body.headlines
              : [
                  businessName.slice(0, 30),
                  "Top Digital Marketing Agency",
                  "Verified Local Experts",
                  "Grow Your Business Fast",
                  "Expert Performance Max",
                ],
            longHeadline: body.longHeadline || `${businessName} - High ROI Performance Marketing & Digital Growth`,
            descriptions: Array.isArray(body.descriptions) && body.descriptions.length >= 2
              ? body.descriptions
              : [
                  `Discover top quality digital marketing solutions tailored to your business goals.`,
                  `Partner with ${businessName} for proven growth, expert campaigns, and verified results.`,
                ],
          },
        ],
      },
    ];

    const result = await createPerformanceMaxAssetGroupAndAssets({
      accessToken,
      customerId,
      campaignResourceName,
      campaignName: body.campaignName || `PMax - ${businessName}`,
      finalUrl,
      adGroups,
      businessName,
      images: resolvedImages,
      logo: resolvedLogo,
      isRetail: Boolean(body.isRetail),
      loginCustomerId: managerId,
    });

    if (!result.ok) {
      return res.status(400).json({
        ok: false,
        message: "Failed to attach Asset Group to Performance Max campaign",
        error: result.error,
      });
    }

    return res.status(200).json({
      ok: true,
      message: `Asset Group successfully attached to campaign ${campaignId}!`,
      assetGroupId: result.assetGroupId,
      assetGroupResourceName: result.assetGroupResourceName,
      linkedAssetsCount: result.linkedAssetsCount,
      searchThemesCount: result.searchThemesCount,
    });
  } catch (err) {
    console.error("attach-pmax-assets error:", err);
    return res.status(500).json({ ok: false, message: err.message });
  }
}
