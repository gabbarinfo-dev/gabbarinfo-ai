// pages/api/facebook/callback.js

import axios from "axios";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.email) {
    return res.status(401).send("Unauthorized");
  }

  const { code } = req.query;
  if (!code) {
    return res.status(400).send("Missing code");
  }

  try {
    /* 1️⃣ Exchange code for access token */
    const tokenRes = await axios.get(
      "https://graph.facebook.com/v19.0/oauth/access_token",
      {
        params: {
          client_id: process.env.FB_CLIENT_APP_ID,
          client_secret: process.env.FB_CLIENT_APP_SECRET,
          redirect_uri:
            "https://ai.gabbarinfo.com/api/facebook/callback",
          code,
        },
      }
    );

    const system_user_token = tokenRes.data.access_token;

    /* 2️⃣ Fetch business */
    const bizRes = await axios.get(
      "https://graph.facebook.com/v19.0/me/businesses",
      { params: { access_token: system_user_token } }
    );

    const fb_business_id = bizRes.data.data?.[0]?.id || null;

    /* 3️⃣ Fetch ad accounts */
    const adRes = await axios.get(
      "https://graph.facebook.com/v19.0/me/adaccounts",
      { params: { access_token: system_user_token } }
    );

    const fb_ad_account_id = adRes.data.data?.[0]?.id || null;

    /* 4️⃣ Fetch pages */
    const pageRes = await axios.get(
      "https://graph.facebook.com/v19.0/me/accounts",
      { params: { access_token: system_user_token } }
    );

    const fb_page_id = pageRes.data.data?.[0]?.id || null;

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
        igRes.data.instagram_business_account?.id || null;
    }

    /* 6️⃣ Save to Supabase */
    await supabase.from("meta_connections").upsert(
      {
        email: session.user.email.toLowerCase(),
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

    /* 7️⃣ Redirect back */
    return res.redirect("/");

  } catch (err) {
    console.error("META CALLBACK ERROR:", err.response?.data || err);
    return res.status(500).send("Meta connection failed");
  }
}
