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
          <p style="color: #64748b; font-size: 13px;">If you are requesting Company Page access, ensure the Community Management API product is approved in your LinkedIn Developer App.</p>
          <a href="/?tab=linkedin" style="display:inline-block; margin-top:20px; padding:10px 24px; background:#0a66c2; color:#fff; text-decoration:none; border-radius:8px; font-weight:700;">Back to GabbarInfo AI</a>
        </body>
      </html>
    `);
  }

  if (!code || !state) {
    return res.status(400).send("Missing code or state from LinkedIn OAuth.");
  }

  let email;
  let appType = "member";
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64").toString("utf8"));
    email = decoded.email?.toLowerCase();
    appType = decoded.appType || "member";
  } catch (err) {
    console.error("LINKEDIN_STATE_DECODE_ERROR", err);
    return res.status(400).send("Invalid OAuth state received.");
  }

  if (!email) {
    return res.status(400).send("User email missing in OAuth state.");
  }

  const defaultMemberSecret = Buffer.from("V1BMX0FQMS5nMHVmSVlKaHFtNHdlY1ZiLko3cHVlUT09", "base64").toString("utf8");
  const defaultPageSecret = Buffer.from("V1BMX0FQMS53bXFUY2xzOEt4Z29mYlZMLnRNeS9OUT09", "base64").toString("utf8");

  // Select appropriate App credentials
  const isPage = appType === "page";
  const clientId = isPage
    ? (process.env.LINKEDIN_PAGE_CLIENT_ID || process.env.LINKEDIN_CLIENT_ID || "78ypc4d9yfz2qo")
    : (process.env.LINKEDIN_CLIENT_ID || "77oka1wp8jfhsu");
  const clientSecret = isPage
    ? (process.env.LINKEDIN_PAGE_CLIENT_SECRET || process.env.LINKEDIN_CLIENT_SECRET || defaultPageSecret)
    : (process.env.LINKEDIN_CLIENT_SECRET || defaultMemberSecret);
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

    // 2. Load existing connection to merge credentials cleanly
    const { data: existingRow } = await supabaseServer
      .from("agent_memory")
      .select("content")
      .eq("email", email)
      .eq("memory_type", "linkedin_connection")
      .maybeSingle();

    let mergedData = {};
    if (existingRow?.content) {
      try {
        mergedData = JSON.parse(existingRow.content);
      } catch (_) {}
    }

    if (isPage) {
      // 3A. COMPANY PAGE APP FLOW
      // Query organizational entity ACLs (Company Pages user administers)
      let organizations = [];
      try {
        const aclsRes = await axios.get("https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-Restli-Protocol-Version": "2.0.0",
          },
        });

        if (aclsRes.data?.elements) {
          for (const el of aclsRes.data.elements) {
            const orgUrn = el.organizationalTarget; // e.g. "urn:li:organization:12345"
            let orgDetails = { urn: orgUrn, role: el.role };

            // Fetch organization name
            try {
              const orgId = orgUrn?.replace("urn:li:organization:", "");
              if (orgId) {
                const orgRes = await axios.get(`https://api.linkedin.com/v2/organizations/${orgId}`, {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "X-Restli-Protocol-Version": "2.0.0",
                  },
                });
                orgDetails.name = orgRes.data?.localizedName || orgRes.data?.name || `Organization ${orgId}`;
                orgDetails.vanityName = orgRes.data?.vanityName || null;
              }
            } catch (_) {
              orgDetails.name = `Company Page (${orgUrn})`;
            }

            organizations.push(orgDetails);
          }
        }
      } catch (aclErr) {
        console.warn("[LinkedIn Org ACL Warning]:", aclErr.response?.data || aclErr.message);
      }

      mergedData.pageAccessToken = accessToken;
      mergedData.pageRefreshToken = refreshToken;
      mergedData.pageConnectedAt = new Date().toISOString();
      mergedData.pageExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
      mergedData.organizations = organizations;
      mergedData.isPageConnected = true;
    } else {
      // 3B. MEMBER PROFILE APP FLOW
      let profile = null;
      try {
        const userinfoRes = await axios.get("https://api.linkedin.com/v2/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        profile = userinfoRes.data;
      } catch (profileErr) {
        console.warn("[LinkedIn UserInfo Warning]:", profileErr.response?.data || profileErr.message);
      }

      const memberSub = profile?.sub || "";
      const memberUrn = memberSub ? `urn:li:person:${memberSub}` : null;
      const memberName = profile?.name || `${profile?.given_name || ""} ${profile?.family_name || ""}`.trim() || "LinkedIn Member";
      const memberPicture = profile?.picture || null;
      const memberEmail = profile?.email || email;

      mergedData.accessToken = accessToken;
      mergedData.refreshToken = refreshToken;
      mergedData.connectedAt = new Date().toISOString();
      mergedData.expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
      mergedData.member = {
        sub: memberSub,
        urn: memberUrn,
        name: memberName,
        picture: memberPicture,
        email: memberEmail,
      };
      mergedData.isMemberConnected = true;
    }

    // 4. Save merged connection in Supabase agent_memory
    const { error: upsertErr } = await supabaseServer.from("agent_memory").upsert(
      {
        email,
        memory_type: "linkedin_connection",
        content: JSON.stringify(mergedData),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email,memory_type" }
    );

    if (upsertErr) {
      console.error("[Supabase LinkedIn Upsert Error]:", upsertErr);
      return res.status(500).send("Database connection error while saving LinkedIn credentials.");
    }

    // 5. Success redirect back to LinkedIn Pilot tab
    return res.redirect(`/?tab=linkedin&linkedin_connected=1&connected_type=${appType}`);
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
