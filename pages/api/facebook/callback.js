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

    const system_user_token = tokenRes.data.access_token;
    if (!system_user_token) {
      throw new Error("No system_user_token returned by Meta");
    }

    // -----------------------------
    // 3. Fetch business assets
    // -----------------------------
    const businessesRes = await axios.get(
      "https://graph.facebook.com/v19.0/me/businesses",
      { params: { access_token: system_user_token } }
    );
    const fb_business_id = businessesRes.data?.data?.[0]?.id || null;

    const adAccountsRes = await axios.get(
      "https://graph.facebook.com/v19.0/me/adaccounts",
      { params: { access_token: system_user_token } }
    );
    const fb_ad_account_id =
      adAccountsRes.data?.data?.[0]?.id || null;

    const pagesRes = await axios.get(
      "https://graph.facebook.com/v19.0/me/accounts",
      { params: { access_token: system_user_token } }
    );
    const fb_page_id = pagesRes.data?.data?.[0]?.id || null;

    let ig_business_id = null;
    if (fb_page_id) {
      const igRes = await axios.get(
        `https://graph.facebook.com/v19.0/${fb_page_id}`,
        {
          params: {
            fields: "instagram_business_account",
            access_token: system_user_token,
          },
        }
      );
      ig_business_id =
        igRes.data?.instagram_business_account?.id || null;
    }

    // -----------------------------
    // 4. UPSERT (FAIL-LOUD)
    // -----------------------------
    const { error: upsertError } = await supabase
      .from("meta_connections")
      .upsert(
        {
          email,
          system_user_token,
          fb_business_id,
          fb_page_id,
          ig_business_id,
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
