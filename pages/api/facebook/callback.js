// pages/api/facebook/callback.js

import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.status(400).send("Missing code or state");
  }

  // Decode state (we stored email safely in connect.js)
  let parsedState;
  try {
    parsedState = JSON.parse(Buffer.from(state, "base64").toString());
  } catch {
    return res.status(400).send("Invalid state");
  }

  const { email } = parsedState;

  try {
    // 1️⃣ Exchange code → short-lived user token
    const tokenRes = await axios.get(
      "https://graph.facebook.com/v19.0/oauth/access_token",
      {
        params: {
          client_id: process.env.FB_CLIENT_APP_ID,              // BUSINESS APP
          client_secret: process.env.FB_CLIENT_APP_SECRET,      // BUSINESS APP
          redirect_uri: "https://ai.gabbarinfo.com/api/facebook/callback",
          code,
        },
      }
    );

    const shortLivedToken = tokenRes.data.access_token;

    // 2️⃣ Exchange → long-lived user token
    const longTokenRes = await axios.get(
      "https://graph.facebook.com/v19.0/oauth/access_token",
      {
        params: {
          grant_type: "fb_exchange_token",
          client_id: process.env.FB_CLIENT_APP_ID,
          client_secret: process.env.FB_CLIENT_APP_SECRET,
          fb_exchange_token: shortLivedToken,
        },
      }
    );

    const longLivedToken = longTokenRes.data.access_token;
    const expiresIn = longTokenRes.data.expires_in;

    // 3️⃣ Store token (isolated, business-only)
    await supabase.from("facebook_connections").insert({
      email,
      access_token: longLivedToken,
      expires_in: expiresIn,
      token_type: "USER_LONG_LIVED",
      source: "business_oauth",
    });

    // 4️⃣ Redirect back to app
    return res.redirect("/dashboard?facebook=connected");
  } catch (err) {
    console.error(err.response?.data || err.message);
    return res.status(500).send("Facebook OAuth failed");
  }

