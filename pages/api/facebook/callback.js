import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.redirect("/?error=facebook_auth_failed");
  }

  const { email } = JSON.parse(
    Buffer.from(state, "base64").toString("utf8")
  );

  // 1️⃣ Exchange code → access token
  const tokenRes = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?` +
      new URLSearchParams({
        client_id: process.env.FACEBOOK_CLIENT_ID,
        client_secret: process.env.FACEBOOK_CLIENT_SECRET,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/facebook/callback`,
        code,
      })
  );

  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    return res.redirect("/?error=token_exchange_failed");
  }

  // 2️⃣ Save token in Supabase
  await supabase
    .from("meta_connections")
    .upsert({
      user_email: email,
      access_token: tokenData.access_token,
      token_type: "facebook",
      connected_at: new Date().toISOString(),
    });

  // 3️⃣ Redirect back to app
  res.redirect("/?facebook=connected");
}
