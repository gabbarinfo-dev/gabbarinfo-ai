// pages/api/facebook/callback.js

import axios from "axios";
import { createClient } from "@supabase/supabase-js";

/**
 * IMPORTANT:
 * - This callback DOES NOT use getServerSession
 * - User identity comes ONLY from OAuth `state`
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // already confirmed by you
);

export default async function handler(req, res) {
  const { code, state } = req.query;

  /**
   * state MUST contain user email
   * Example during auth start:
   * state = encodeURIComponent(JSON.stringify({ email }))
   */
  if (!code || !state) {
    return res.status(400).send("Missing code or state");
  }

  let email;
  try {
    const parsedState = JSON.parse(decodeURIComponent(state));
    email = parsedState.email?.toLowerCase();
  } catch (e) {
    return res.status(400).send("Invalid state");
  }

  if (!email) {
    return res.status(400).send("Email missing in state");
  }

  try {
    /* 1️⃣ Exchange code for system user access token */
    const tokenRes = await axios.get(
      "https://graph.facebook.com/v19.0/oauth/access_token",
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

    /* 2️⃣ Fetch businesses */
    const bizRes = await axios.get(
      "https://graph.facebook.com/v19.0/me/businesses",
      { params: { access_token: system_user_token } }
    );
    const fb_business_id = bizRes.data?.data?.[0]?.id || null;

    /* 3️⃣ Fetch ad accounts */
    const adRes = await axios.get(
      "https://graph.facebook.com/v19.0/me/adaccounts",
      { params: { access_token: system_user_token } }
    );
    const fb_ad_account_id = adRes.data?.data?.[0]?.id || null;

    /* 4️⃣ Fetch pages */
    const pageRes = await axios.get(
      "https://graph.facebook.com/v19.0/me/accounts",
      { params: { access_token: system_user_token } }
    );
    const fb_page_id = pageRes.data?.data?.[0]?.id || null;

    /* 5️⃣ Fetch Instagram business */
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

    /* 6️⃣ INSERT / UPSERT — THIS WAS FAILING EARLIER */
    const { error } = await supabase
      .from("meta_connections")
      .upsert(
        {
          email,
          system_user_token,
          fb_business_id,
          fb_ad_account_id,
          fb_page_id,
          ig_business_id,
          scopes: ["ads", "pages", "instagram"],
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      );

    if (error) {
      console.error("SUPABASE UPSERT ERROR:", error);
      return res.status(500).send("Failed to save Meta connection");
    }

    /* 7️⃣ Redirect back to dashboard */
    return res.redirect("/");

  } catch (err) {
    console.error("META CALLBACK ERROR:", err?.response?.data || err);
    return res.status(500).send("Meta connection failed");
  }
}
