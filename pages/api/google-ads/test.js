// pages/api/google-ads/test.js

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Only GET is allowed" });
  }

  try {
    const {
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_ADS_REFRESH_TOKEN,
      GOOGLE_ADS_DEVELOPER_TOKEN,
    } = process.env;

    // 1) Check that all env vars are present
    const missing = [];
    if (!GOOGLE_CLIENT_ID) missing.push("GOOGLE_CLIENT_ID");
    if (!GOOGLE_CLIENT_SECRET) missing.push("GOOGLE_CLIENT_SECRET");
    if (!GOOGLE_ADS_REFRESH_TOKEN) missing.push("GOOGLE_ADS_REFRESH_TOKEN");
    if (!GOOGLE_ADS_DEVELOPER_TOKEN) missing.push("GOOGLE_ADS_DEVELOPER_TOKEN");

    if (missing.length > 0) {
      return res.status(200).json({
        ok: false,
        step: "env_check",
        message: "Some required env vars are missing.",
        missing,
      });
    }

    // 2) Try to exchange the refresh token for an access token
    const body = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
      grant_type: "refresh_token",
    });

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const tokenJson = await tokenRes.json();

    if (!tokenRes.ok) {
      // Google returned an OAuth error
      return res.status(200).json({
        ok: false,
        step: "oauth_exchange",
        httpStatus: tokenRes.status,
        googleResponse: tokenJson,
      });
    }

    // 3) Success – we got an access token using your refresh token
    return res.status(200).json({
      ok: true,
      step: "oauth_exchange",
      message: "Successfully exchanged refresh token for access token.",
      hasDeveloperToken: !!GOOGLE_ADS_DEVELOPER_TOKEN,
      accessTokenSnippet: tokenJson.access_token
        ? tokenJson.access_token.slice(0, 15) + "... (hidden)"
        : null,
      expiresInSeconds: tokenJson.expires_in,
      tokenType: tokenJson.token_type,
    });
  } catch (err) {
    console.error("Google Ads test error:", err);
    return res.status(200).json({
      ok: false,
      step: "unexpected_error",
      errorName: err.name,
      errorMessage: err.message,
      // stack is useful for debugging but harmless here
      errorStack: err.stack,
    });
  }
}
