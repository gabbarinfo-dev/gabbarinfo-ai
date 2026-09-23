// pages/api/facebook/callback.js

import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.status(400).send("Missing code or state from Meta");
  }

  // -----------------------------
  // 1. Decode identity from state
  // -----------------------------
  let email;
  try {
    const decoded = JSON.parse(
      Buffer.from(state, "base64").toString("utf8")
    );
    email = decoded.email?.toLowerCase();
  } catch (err) {
    console.error("STATE_DECODE_ERROR", err);
    return res.status(400).send("Invalid OAuth state");
  }

  if (!email) {
    return res.status(400).send("Email missing in OAuth state");
  }

  try {
    // -----------------------------------
    // 2. Exchange code for system user token
    // -----------------------------------
    const tokenRes = await axios.post(
      "https://graph.facebook.com/v19.0/oauth/access_token",
      null,
      {
        params: {
          client_id: process.env.FB_CLIENT_APP_ID,
          client_secret: process.env.FB_CLIENT_APP_SECRET,
          redirect_uri: "https://ai.gabbarinfo.com/api/facebook/callback",
          code,
        },
      }
    );

    const fb_user_access_token = tokenRes.data.access_token;
    if (!fb_user_access_token) {
      throw new Error("No access_token returned by Meta");
    }

    // -----------------------------
    // 3. Fetch comprehensive business assets
    // -----------------------------
    const [businessesRes, adAccountsRes, pagesRes] = await Promise.all([
      axios.get("https://graph.facebook.com/v19.0/me/businesses", {
        params: { fields: "id,name", access_token: fb_user_access_token },
      }).catch(() => ({ data: { data: [] } })),
      axios.get("https://graph.facebook.com/v19.0/me/adaccounts", {
        params: { fields: "id,name,account_id,currency,business{id,name}", access_token: fb_user_access_token },
      }).catch(() => ({ data: { data: [] } })),
      axios.get("https://graph.facebook.com/v19.0/me/accounts", {
        params: {
          fields: "id,name,access_token,category,instagram_business_account{id,username},connected_instagram_account{id,username}",
          access_token: fb_user_access_token,
        },
      }).catch(() => ({ data: { data: [] } })),
    ]);

    const allBusinesses = businessesRes.data?.data || [];
    const allAdAccounts = adAccountsRes.data?.data || [];
    const allPages = pagesRes.data?.data || [];

    // Fallback single-asset resolution
    const fb_business_id = allBusinesses[0]?.id || null;
    const fb_ad_account_id = allAdAccounts[0]?.id || null;
    const fb_page_id = allPages[0]?.id || null;
    const fb_page_token = allPages[0]?.access_token || null;
    const primaryIg = allPages[0]?.instagram_business_account || allPages[0]?.connected_instagram_account || null;
    const ig_business_id = primaryIg?.id || null;
    const instagram_actor_id = ig_business_id;

    // -------------------------------------------------------------
    // 3.2. MULTI-BRAND ISOLATION: Save each distinct Page/Brand Bundle
    // -------------------------------------------------------------
    for (let i = 0; i < allPages.length; i++) {
      const page = allPages[i];
      const pageName = page.name || `Brand_${page.id}`;
      const normName = pageName.toLowerCase().trim().replace(/[^a-z0-9]/g, "_");

      // Match closest Ad Account (by business or index)
      const matchingAd = allAdAccounts.find((a) =>
        a.business?.name && pageName.toLowerCase().includes(a.business.name.toLowerCase())
      ) || allAdAccounts[i] || allAdAccounts[0] || null;

      // Match closest Business Manager
      const matchingBiz = allBusinesses.find((b) =>
        pageName.toLowerCase().includes(b.name.toLowerCase())
      ) || allBusinesses[i] || allBusinesses[0] || null;

      const pageIg = page.instagram_business_account || page.connected_instagram_account || null;
      const brandPayload = {
        businessName: pageName,
        pageId: page.id,
        pageName: pageName,
        pageToken: page.access_token,
        igId: pageIg?.id || null,
        igUsername: pageIg?.username || null,
        instagramActorId: pageIg?.id || null,
        businessId: matchingBiz?.id || fb_business_id,
        businessTitle: matchingBiz?.name || pageName,
        adAccountId: matchingAd?.id || fb_ad_account_id,
        adAccountName: matchingAd?.name || null,
        userToken: fb_user_access_token,
        connectedAt: new Date().toISOString(),
      };

      await supabase.from("agent_memory").upsert(
        {
          email,
          memory_type: `meta_conn_${normName}`,
          content: JSON.stringify(brandPayload),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email,memory_type" }
      );
    }

    // -----------------------------
    // 3.5. Anti-Abuse Asset Shield & Plan Limits
    // -----------------------------
    const { getBusinessSubscriptionState } = await import("../../../lib/billing/quota-service");
    const { checkAssetTrialEligibility, registerAssetClaim } = await import("../../../lib/billing/asset-registry");

    const subState = await getBusinessSubscriptionState(`biz_${email.replace(/[^a-zA-Z0-9]/g, "_")}`, email);
    const plan = subState?.plan || {};
    const isTrial = plan.category === "trial" || plan.id === "trial_99" || plan.id === "none" || plan.id === "try";

    if (fb_page_id) {
      const eligibility = await checkAssetTrialEligibility({
        assetType: "facebook_page",
        identifier: fb_page_id,
        userEmail: email,
      });

      if (!eligibility.eligible && isTrial && !subState.isUnlimited) {
        console.warn("DUPLICATE_FB_PAGE_TRIAL", eligibility.error);
        return res.redirect(`/?error=DUPLICATE_TRIAL_ASSET&message=${encodeURIComponent(eligibility.error)}`);
      }
    }

    // -----------------------------
    // 4. UPSERT PRIMARY (FAIL-LOUD)
    // -----------------------------
    const { error: upsertError } = await supabase
      .from("meta_connections")
      .upsert(
        {
          email,
          fb_user_access_token,
          fb_page_access_token: fb_page_token,
          fb_business_id,
          fb_page_id,
          ig_business_id,
          instagram_actor_id,
          fb_ad_account_id,
          scopes: ["ads", "pages", "instagram"],
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      );

    if (upsertError) {
      console.error("SUPABASE_UPSERT_ERROR", upsertError);
      return res.status(500).send("Failed to save Meta connection");
    }

    if (fb_page_id) {
      await registerAssetClaim({
        assetType: "facebook_page",
        identifier: fb_page_id,
        userEmail: email,
        planId: plan.id || "none",
        isTrial,
      });
    }

    // -----------------------------------
    // 5. HARD VERIFY ROW EXISTS
    // -----------------------------------
    const { data: row, error: verifyError } = await supabase
      .from("meta_connections")
      .select("email")
      .eq("email", email)
      .single();

    if (verifyError || !row) {
      console.error("META_VERIFY_FAILED", verifyError);
      return res
        .status(500)
        .send("Meta connection verification failed");
    }

    // -----------------------------
    // 6. SUCCESS → redirect
    // -----------------------------
    return res.redirect("/");

  } catch (err) {
    console.error(
      "META_CALLBACK_FATAL",
      err?.response?.data || err
    );
    return res.status(500).send("Meta connection failed");
  }
}
