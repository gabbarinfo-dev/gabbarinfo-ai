// pages/api/youtube/callback.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { code, state, error } = req.query;

  let userEmail = "";
  let returnUrl = "/reels";

  try {
    if (state) {
      const decoded = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
      userEmail = decoded.email || "";
      returnUrl = decoded.returnUrl || "/reels";
    }
  } catch (e) {
    console.warn("[YouTube Callback] Failed to decode state:", e.message);
  }

  if (error || !code) {
    console.error("[YouTube Callback] OAuth error or missing code:", error);
    return res.redirect(`${returnUrl}?youtube_error=${encodeURIComponent(error || "Authorization cancelled")}`);
  }

  if (!userEmail) {
    return res.redirect(`${returnUrl}?youtube_error=No+user+email+detected`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const host = req.headers["x-forwarded-host"] || req.headers.host || "ai.gabbarinfo.com";
  const protocol = req.headers["x-forwarded-proto"] || (host.includes("localhost") ? "http" : "https");
  const redirectUri = `${protocol}://${host}/api/youtube/callback`;

  try {
    // 1. Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("[YouTube Callback] Token exchange failed:", tokenData);
      return res.redirect(`${returnUrl}?youtube_error=${encodeURIComponent(tokenData.error_description || "Token exchange failed")}`);
    }

    // 2. Fetch user's YouTube channel details
    const channelRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: "application/json"
        }
      }
    );

    const channelData = await channelRes.json();
    const channel = channelData.items?.[0];

    const channelInfo = {
      channelId: channel?.id || "unknown",
      title: channel?.snippet?.title || "My YouTube Channel",
      customUrl: channel?.snippet?.customUrl || "",
      thumbnail: channel?.snippet?.thumbnails?.default?.url || "",
      subscriberCount: channel?.statistics?.subscriberCount || "0",
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token, // persistent offline token
      expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
      scope: tokenData.scope,
      connectedAt: new Date().toISOString()
    };

    // If refresh token wasn't returned on this re-auth, try to preserve previous refresh token
    if (!channelInfo.refreshToken) {
      const { data: prevMem } = await supabase
        .from("agent_memory")
        .select("content")
        .eq("email", userEmail)
        .eq("memory_type", "youtube_account")
        .maybeSingle();

      if (prevMem?.content) {
        try {
          const parsed = typeof prevMem.content === "string" ? JSON.parse(prevMem.content) : prevMem.content;
          if (parsed?.refreshToken) {
            channelInfo.refreshToken = parsed.refreshToken;
          }
        } catch (_) {}
      }
    }

    // 3. Store in Supabase agent_memory
    await supabase.from("agent_memory").upsert(
      {
        email: userEmail,
        memory_type: "youtube_account",
        content: JSON.stringify(channelInfo),
        updated_at: new Date().toISOString()
      },
      { onConflict: "email,memory_type" }
    );

    console.log(`[YouTube Callback] Successfully connected YouTube channel "${channelInfo.title}" (${channelInfo.channelId}) for ${userEmail}`);

    return res.redirect(`${returnUrl}?youtube_connected=true&channel=${encodeURIComponent(channelInfo.title)}`);
  } catch (err) {
    console.error("[YouTube Callback] Fatal exception:", err);
    return res.redirect(`${returnUrl}?youtube_error=${encodeURIComponent(err.message)}`);
  }
}
