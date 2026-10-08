// pages/api/linkedin/callback.js
import axios from "axios";
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  const { code, state, error, error_description } = req.query;

  if (error) {
    console.error("[LinkedIn OAuth Error]:", error, error_description);
    return res.status(400).send(`
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #070a10; color: #f8fafc; padding: 40px; text-align: center;">
          <h2 style="color: #ef4444;">LinkedIn Authorization Failed</h2>
          <p style="color: #94a3b8; max-width: 600px; margin: 10px auto;">${error_description || error}</p>
          <p style="color: #64748b; font-size: 13px;">Make sure you have approved the permissions dialog or requested access to the products in your LinkedIn Developer portal.</p>
          <a href="/?tab=linkedin" style="display:inline-block; margin-top:20px; padding:10px 24px; background:#0a66c2; color:#fff; text-decoration:none; border-radius:8px; font-weight:700;">Back to GabbarInfo AI</a>
        </body>
      </html>
    `);
  }

  if (!code || !state) {
    return res.status(400).send("Missing code or state from LinkedIn OAuth.");
  }

  let email;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64").toString("utf8"));
    email = decoded.email?.toLowerCase();
  } catch (err) {
    console.error("LINKEDIN_STATE_DECODE_ERROR", err);
    return res.status(400).send("Invalid OAuth state received.");
  }

  if (!email) {
    return res.status(400).send("User email missing in OAuth state.");
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI || "https://ai.gabbarinfo.com/api/linkedin/callback";

  try {
    // 1. Exchange authorization code for Access Token
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    });

    const tokenRes = await axios.post(
      "https://www.linkedin.com/oauth/v2/accessToken",
      tokenParams.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const accessToken = tokenRes.data?.access_token;
    const expiresIn = tokenRes.data?.expires_in;
    const refreshToken = tokenRes.data?.refresh_token || null;

    if (!accessToken) {
      throw new Error("No access_token returned by LinkedIn OAuth.");
    }

    // 2. Fetch authenticated member profile via OpenID UserInfo
    let profile = null;
    try {
      const userinfoRes = await axios.get("https://api.linkedin.com/v2/userinfo", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      profile = userinfoRes.data;
    } catch (profileErr) {
      console.warn("[LinkedIn UserInfo Fetch Warning]:", profileErr.response?.data || profileErr.message);
    }

    const memberSub = profile?.sub || "";
    const memberUrn = memberSub ? `urn:li:person:${memberSub}` : null;
    const memberName = profile?.name || `${profile?.given_name || ""} ${profile?.family_name || ""}`.trim() || "LinkedIn Member";
    const memberPicture = profile?.picture || null;
    const memberEmail = profile?.email || email;

    // 3. Try to discover any administered organizations/pages (if organization permissions are enabled)
    let organizations = [];
    try {
      const aclsRes = await axios.get("https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Restli-Protocol-Version": "2.0.0",
        },
      });
      if (aclsRes.data?.elements) {
        organizations = aclsRes.data.elements.map((el) => ({
          role: el.role,
          organizationalTarget: el.organizationalTarget,
          state: el.state,
        }));
      }
    } catch (_) {
      // Organization ACLs will 403 gracefully if Community Management API access isn't active yet
    }

    const linkedinData = {
      accessToken,
      refreshToken,
      expiresIn,
      connectedAt: new Date().toISOString(),
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
      member: {
        sub: memberSub,
        urn: memberUrn,
        name: memberName,
        picture: memberPicture,
        email: memberEmail,
      },
      organizations,
    };

    // 4. Save to Supabase agent_memory
    const { error: upsertErr } = await supabaseServer.from("agent_memory").upsert(
      {
        email,
        memory_type: "linkedin_connection",
        content: JSON.stringify(linkedinData),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email,memory_type" }
    );

    if (upsertErr) {
      console.error("[Supabase LinkedIn Upsert Error]:", upsertErr);
      return res.status(500).send("Database connection error while saving LinkedIn credentials.");
    }

    // 5. Success redirect to LinkedIn Pilot tab
    return res.redirect("/?tab=linkedin&linkedin_connected=1");
  } catch (err) {
    console.error("LINKEDIN_CALLBACK_FATAL", err?.response?.data || err.message);
    const detail = err?.response?.data?.error_description || err?.response?.data?.message || err.message;
    return res.status(500).send(`
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #070a10; color: #f8fafc; padding: 40px; text-align: center;">
          <h2 style="color: #ef4444;">LinkedIn Connection Error</h2>
          <p style="color: #94a3b8; max-width: 600px; margin: 10px auto;">${detail}</p>
          <a href="/?tab=linkedin" style="display:inline-block; margin-top:20px; padding:10px 24px; background:#0a66c2; color:#fff; text-decoration:none; border-radius:8px; font-weight:700;">Back to GabbarInfo AI</a>
        </body>
      </html>
    `);
  }
}
