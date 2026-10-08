// pages/api/tiktok/callback.js
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  const { code, state, error, error_description } = req.query;

  if (error) {
    console.error("[TikTok OAuth Error]:", error, error_description);
    return res.status(400).send(`
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #070a10; color: #f8fafc; padding: 40px; text-align: center;">
          <h2 style="color: #ef4444;">TikTok Authorization Failed</h2>
          <p style="color: #94a3b8; max-width: 600px; margin: 10px auto;">${error_description || error}</p>
          <a href="/" style="display:inline-block; margin-top:20px; padding:10px 24px; background:#fe2c55; color:#fff; text-decoration:none; border-radius:8px; font-weight:700;">Back to GabbarInfo AI</a>
        </body>
      </html>
    `);
  }

  if (!code || !state) {
    return res.status(400).send("Missing code or state from TikTok OAuth.");
  }

  let email;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64").toString("utf8"));
    email = decoded.email?.toLowerCase();
  } catch (err) {
    console.error("TIKTOK_STATE_DECODE_ERROR", err);
    return res.status(400).send("Invalid OAuth state received.");
  }

  if (!email) {
    return res.status(400).send("User email missing in OAuth state.");
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY || "awq8sdcr0cy886rc";
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET || "WiNPYfwcKqKgLH4gd9TvH4BKKoNHZDUL";
  const redirectUri = process.env.TIKTOK_REDIRECT_URI || "https://ai.gabbarinfo.com/api/tiktok/callback";

  try {
    // 1. Exchange authorization code for Access Token
    const tokenParams = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });

    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || tokenData.error || !tokenData.data?.access_token) {
      console.error("[TikTok Token Exchange Error]:", tokenData);
      return res.status(400).send(`
        <html>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #070a10; color: #f8fafc; padding: 40px; text-align: center;">
            <h2 style="color: #ef4444;">TikTok Token Exchange Failed</h2>
            <p style="color: #94a3b8; max-width: 600px; margin: 10px auto;">${tokenData.message || tokenData.error_description || "Could not retrieve access token."}</p>
            <a href="/" style="display:inline-block; margin-top:20px; padding:10px 24px; background:#fe2c55; color:#fff; text-decoration:none; border-radius:8px; font-weight:700;">Back to GabbarInfo AI</a>
          </body>
        </html>
      `);
    }

    const {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn,
      open_id: openId,
      scope: approvedScopes,
    } = tokenData.data;

    // 2. Fetch User Profile Info
    let userProfile = { displayName: "TikTok User", openId };
    try {
      const userRes = await fetch(
        "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,bio_description,profile_deep_link,is_verified,follower_count,following_count,likes_count",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      const userData = await userRes.json();
      if (userData.data?.user) {
        const u = userData.data.user;
        userProfile = {
          openId: u.open_id || openId,
          unionId: u.union_id,
          displayName: u.display_name || "TikTok Creator",
          avatarUrl: u.avatar_url,
          bio: u.bio_description,
          profileLink: u.profile_deep_link,
          isVerified: u.is_verified,
          followerCount: u.follower_count || 0,
          followingCount: u.following_count || 0,
          likesCount: u.likes_count || 0,
        };
      }
    } catch (userErr) {
      console.warn("[TikTok User Profile Fetch Warning]:", userErr);
    }

    // 3. Store connection in agent_memory
    const connectionPayload = {
      accessToken,
      refreshToken,
      expiresAt: Date.now() + (expiresIn || 86400) * 1000,
      openId,
      approvedScopes,
      user: userProfile,
      connectedAt: new Date().toISOString(),
    };

    const { error: dbErr } = await supabaseServer.from("agent_memory").upsert(
      {
        email,
        memory_type: "tiktok_connection",
        content: JSON.stringify(connectionPayload),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email,memory_type" }
    );

    if (dbErr) {
      console.error("[TikTok DB Save Error]:", dbErr);
    }

    // 4. Return success popup or redirect
    return res.send(`
      <html>
        <head>
          <title>TikTok Connected — GabbarInfo AI</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #070a10; color: #f8fafc; padding: 40px; text-align: center;">
          <div style="max-width: 500px; margin: 40px auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <div style="font-size: 48px; margin-bottom: 16px;">🎵</div>
            <h2 style="color: #38bdf8; margin: 0 0 10px 0;">TikTok Connected!</h2>
            <p style="color: #94a3b8; font-size: 14px; margin-bottom: 24px;">
              Connected as <strong style="color: #fff;">${userProfile.displayName}</strong>. You can now publish and schedule creative posts directly to your TikTok account.
            </p>
            <button onclick="if(window.opener){window.opener.location.reload(); window.close();}else{window.location.href='/';}" style="display:inline-block; padding:12px 28px; background:#fe2c55; color:#fff; border:none; border-radius:8px; font-weight:700; cursor:pointer;">
              Continue to Dashboard →
            </button>
          </div>
          <script>
            setTimeout(() => {
              if (window.opener) {
                window.opener.location.reload();
                window.close();
              } else {
                window.location.href = '/';
              }
            }, 2500);
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("[TikTok OAuth Fatal Error]:", err);
    return res.status(500).send(`Server error handling TikTok authentication: ${err.message}`);
  }
}
