// pages/api/linkedin/connect.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;

  if (!email) {
    return res.status(401).send(`
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #070a10; color: #f8fafc; padding: 40px; text-align: center;">
          <h1 style="color: #60a5fa;">Not Authenticated</h1>
          <p>Please log in to GabbarInfo AI before connecting your LinkedIn account.</p>
          <a href="/" style="display:inline-block; margin-top:20px; padding:10px 24px; background:#0a66c2; color:#fff; text-decoration:none; border-radius:8px; font-weight:700;">Back to Dashboard</a>
        </body>
      </html>
    `);
  }

  const { type = "member" } = req.query; // 'member' or 'page'

  let clientId;
  let scopes;

  if (type === "page") {
    clientId = process.env.LINKEDIN_PAGE_CLIENT_ID || process.env.LINKEDIN_CLIENT_ID;
    // Scopes for Community Management API (LinkedIn Pages / B2B Organizations)
    scopes = ["w_organization_social", "r_organization_social", "rw_organization_admin"].join(" ");
  } else {
    clientId = process.env.LINKEDIN_CLIENT_ID;
    // Scopes for Member Profile (Sign In + Share on LinkedIn)
    scopes = ["openid", "profile", "email", "w_member_social"].join(" ");
  }

  if (!clientId) {
    return res.status(500).send(`LinkedIn ${type === "page" ? "Company Page" : "Member"} Client ID is not configured.`);
  }

  const redirectUri = process.env.LINKEDIN_REDIRECT_URI || "https://ai.gabbarinfo.com/api/linkedin/callback";

  const statePayload = Buffer.from(
    JSON.stringify({
      email,
      appType: type, // 'member' or 'page'
      ts: Date.now(),
      source: "linkedin_pilot",
    })
  ).toString("base64");

  const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", statePayload);
  authUrl.searchParams.set("scope", scopes);

  return res.redirect(authUrl.toString());
}
