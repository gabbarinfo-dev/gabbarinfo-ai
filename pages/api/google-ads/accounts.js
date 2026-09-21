// pages/api/google-ads/accounts.js
// Lists accessible Google Ads client accounts for the logged-in user
// and handles selecting/saving the active Google Ads Customer ID + Manager ID.
//
// Uses getAccountHierarchy() which:
//   - Calls listAccessibleCustomers with NO global login-customer-id (per-user)
//   - Traverses each user's own MCC hierarchy dynamically
//   - Returns managerId per account for correct campaign creation login path

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth].js";
import { createClient } from "@supabase/supabase-js";
import {
  cleanCustomerId,
  getAccountHierarchy,
  getLinkedMerchantCenterAccount,
  getAccountVideoAssets,
  matchAccountToYouTubeChannel,
  fetchYouTubeChannelVideos,
  pickBestYouTubeChannelVideo,
} from "../../../lib/googleAdsHelper.js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(
  SUPABASE_URL || "",
  SUPABASE_SERVICE_ROLE_KEY || ""
);

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.email) {
    return res.status(401).json({ ok: false, message: "Not authenticated" });
  }

  const email = session.user.email.toLowerCase().trim();

  // ----------------------------------------------------
  // GET: List accessible Google Ads accounts & selected ID
  // ----------------------------------------------------
  if (req.method === "GET") {
    try {
      // 1. Fetch user's Google connection from Supabase
      const { data: connection, error: connErr } = await supabase
        .from("google_connections")
        .select("refresh_token, customer_id, updated_at")
        .eq("email", email)
        .maybeSingle();

      if (connErr) {
        console.error("Error fetching google_connections:", connErr);
      }

      const refreshToken =
        connection?.refresh_token || session.refreshToken || null;

      if (!refreshToken) {
        return res.status(200).json({
          ok: true,
          connected: false,
          hasAdsScope: false,
          message:
            "No Google Ads authorization found. Please sign in with Google to connect your account.",
          accounts: [],
          selectedCustomerId: null,
        });
      }

      // 2. Discover THIS user's account hierarchy dynamically
      //    - No global login-customer-id used here
      //    - Each user's MCC is discovered from their own OAuth token
      const hierarchyResp = await getAccountHierarchy({ refreshToken });

      if (!hierarchyResp.ok) {
        const apiError =
          hierarchyResp.json?.error?.message ||
          hierarchyResp.json?.error?.details?.[0]?.errors?.[0]?.message ||
          JSON.stringify(hierarchyResp.json || {});

        console.error("getAccountHierarchy failed:", hierarchyResp.json);

        return res.status(200).json({
          ok: false,
          connected: true,
          hasAdsScope: hierarchyResp.hasAdsScope ?? false,
          error: "failed_to_list_accounts",
          message: `Failed to retrieve Google Ads accounts: ${apiError}`,
          details: hierarchyResp.json,
          accounts: [],
          selectedCustomerId: connection?.customer_id || null,
        });
      }

      const accountDetails = hierarchyResp.accounts || [];

      // Fetch connected Shopify store details for user, if any
      let connectedShopify = null;
      try {
        const { data: sMem } = await supabase
          .from("agent_memory")
          .select("content")
          .eq("email", email)
          .eq("memory_type", "shopify_connection")
          .maybeSingle();
        if (sMem?.content) {
          connectedShopify = typeof sMem.content === "string" ? JSON.parse(sMem.content) : sMem.content;
        }
      } catch (_) {}

      // Fetch user's YouTube channels from agent_memory if available
      let userYouTubeChannels = [];
      try {
        const { data: ytMem } = await supabase
          .from("agent_memory")
          .select("content")
          .eq("email", email)
          .eq("memory_type", "youtube_channels")
          .maybeSingle();
        if (ytMem?.content) {
          userYouTubeChannels =
            typeof ytMem.content === "string" ? JSON.parse(ytMem.content) : ytMem.content;
        }
      } catch (_) {}

      // Enrich accounts with linked Google Merchant Center ID, paired ecommerce store & matched YouTube assets
      const enrichedAccounts = await Promise.all(
        accountDetails.map(async (acc) => {
          try {
            // 1. Evaluate if any user YouTube channel matches this account
            const matchedChannel = matchAccountToYouTubeChannel({
              accountName: acc.descriptiveName,
              storeName: connectedShopify?.shopName || null,
              services: null,
              channels: userYouTubeChannels,
            });

            const [linkedGmc, channelVideos, videoRes] = await Promise.all([
              Promise.race([
                getLinkedMerchantCenterAccount({
                  refreshToken,
                  customerId: acc.customerId,
                  loginCustomerId: acc.managerId || null,
                }),
                new Promise((resolve) => setTimeout(() => resolve(null), 3500)),
              ]),
              matchedChannel
                ? Promise.race([
                    fetchYouTubeChannelVideos({
                      channel: matchedChannel,
                      clientId: process.env.GOOGLE_CLIENT_ID,
                      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                    }),
                    new Promise((resolve) => setTimeout(() => resolve([]), 3500)),
                  ])
                : Promise.resolve([]),
              !matchedChannel
                ? Promise.race([
                    getAccountVideoAssets({
                      refreshToken,
                      customerId: acc.customerId,
                      businessName: acc.descriptiveName,
                      storeName: connectedShopify?.shopName || null,
                      loginCustomerId: acc.managerId || null,
                    }),
                    new Promise((resolve) => setTimeout(() => resolve(null), 3500)),
                  ])
                : Promise.resolve(null),
            ]);

            const merchantId = linkedGmc?.merchantId || null;
            const isEcom = Boolean(merchantId);

            let youtubeConnected = false;
            let youtubeVideoCount = 0;
            let matchedChannelTitle = null;
            let sampleVideo = null;

            if (matchedChannel) {
              const bestVid = pickBestYouTubeChannelVideo(channelVideos);
              youtubeConnected = true;
              youtubeVideoCount = matchedChannel.videoCount || channelVideos.length;
              matchedChannelTitle = matchedChannel.title;
              sampleVideo = bestVid;
            } else {
              const verifiedVideos = (videoRes?.verifiedVideos || []).filter(
                (v) => (v.score || 0) >= 20
              );
              if (verifiedVideos.length > 0 && videoRes?.bestVideo) {
                youtubeConnected = true;
                youtubeVideoCount = verifiedVideos.length;
                sampleVideo = videoRes.bestVideo;
              }
            }

            return {
              ...acc,
              merchantId,
              feedLabel: linkedGmc?.feedLabel || null,
              linkedStoreName: isEcom && connectedShopify?.shopName ? connectedShopify.shopName : null,
              linkedStoreDomain:
                isEcom && (connectedShopify?.primary_domain || connectedShopify?.domain || connectedShopify?.shop)
                  ? connectedShopify.primary_domain || connectedShopify.domain || connectedShopify.shop
                  : null,
              youtubeConnected,
              youtubeVideoCount,
              matchedChannelTitle,
              sampleYoutubeVideo: sampleVideo
                ? {
                    title: sampleVideo.title,
                    videoId: sampleVideo.videoId,
                    url: sampleVideo.url || `https://www.youtube.com/watch?v=${sampleVideo.videoId}`,
                  }
                : null,
            };
          } catch (_) {
            return acc;
          }
        })
      );

      // 3. Determine selected Customer ID
      let selectedCustomerId = connection?.customer_id || null;

      // Auto-select if only one account and none selected yet
      if (!selectedCustomerId && enrichedAccounts.length === 1) {
        selectedCustomerId = enrichedAccounts[0].customerId;

        try {
          await supabase
            .from("google_connections")
            .upsert(
              {
                email,
                customer_id: selectedCustomerId,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "email" }
            );
        } catch (_) {}
      }

      return res.status(200).json({
        ok: true,
        connected: true,
        hasAdsScope: hierarchyResp.hasAdsScope !== false,
        accounts: enrichedAccounts, // Each account includes managerId and auto-discovered merchantId/store
        selectedCustomerId,
      });
    } catch (err) {
      console.error("GET /api/google-ads/accounts error:", err);
      return res.status(500).json({
        ok: false,
        message: "Internal server error fetching Google Ads accounts",
        error: String(err.message || err),
      });
    }
  }

  // ----------------------------------------------------
  // POST: Select / Switch Active Google Ads Customer ID
  // Expects: { customerId, managerId }
  // ----------------------------------------------------
  if (req.method === "POST") {
    try {
      const { customerId, managerId } = req.body || {};
      const cleanId = cleanCustomerId(customerId);
      const cleanManagerId = managerId ? cleanCustomerId(managerId) : null;

      if (!cleanId) {
        return res
          .status(400)
          .json({ ok: false, message: "Valid customerId is required" });
      }

      // Build the upsert object — try with manager_id first
      const upsertObj = {
        email,
        customer_id: cleanId,
        updated_at: new Date().toISOString(),
      };

      if (cleanManagerId) {
        upsertObj.manager_id = cleanManagerId;
      }

      let updateErr = null;

      const { error: err1 } = await supabase
        .from("google_connections")
        .upsert(upsertObj, { onConflict: "email" });

      updateErr = err1;

      // If manager_id column doesn't exist yet, retry without it
      if (updateErr && cleanManagerId) {
        console.warn("manager_id column may not exist, retrying without it:", updateErr.message);
        const { error: err2 } = await supabase
          .from("google_connections")
          .upsert(
            { email, customer_id: cleanId, updated_at: new Date().toISOString() },
            { onConflict: "email" }
          );
        updateErr = err2;
      }

      if (updateErr) {
        console.error("Error updating selected customer_id:", updateErr);
        return res.status(500).json({
          ok: false,
          message: "Failed to save selected Google Ads customer ID.",
          error: updateErr.message,
        });
      }

      // Sync agent_memory so switching the account immediately clears any prior account's draft intake
      try {
        await supabase
          .from("agent_memory")
          .upsert(
            {
              email,
              memory_type: "google_ads_state",
              content: JSON.stringify({
                stage: "INTAKE_PENDING",
                customerId: cleanId,
                managerId: cleanManagerId || null,
                intake: {},
                updated_at: new Date().toISOString(),
              }),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "email,memory_type" }
          );
      } catch (memErr) {
        console.warn("Failed to reset google_ads_state on account switch:", memErr.message);
      }

      return res.status(200).json({
        ok: true,
        message: "Active Google Ads account updated successfully.",
        selectedCustomerId: cleanId,
        selectedManagerId: cleanManagerId,
      });
    } catch (err) {
      console.error("POST /api/google-ads/accounts error:", err);
      return res.status(500).json({
        ok: false,
        message: "Internal server error updating selected Google Ads account",
        error: String(err.message || err),
      });
    }
  }

  return res.status(405).json({ ok: false, message: "Method not allowed" });
}

