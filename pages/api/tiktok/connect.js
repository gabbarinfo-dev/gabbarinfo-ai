// pages/api/tiktok/connect.js
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
          <p>Please log in to GabbarInfo AI before connecting your TikTok account.</p>
          <a href="/" style="display:inline-block; margin-top:20px; padding:10px 24px; background:#fe2c55; color:#fff; text-decoration:none; border-radius:8px; font-weight:700;">Back to Dashboard</a>
        </body>
      </html>
    `);
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY || "awq8sdcr0cy886rc";
  const redirectUri = process.env.TIKTOK_REDIRECT_URI || "https://ai.gabbarinfo.com/api/tiktok/callback";

  // Standard scopes for Login Kit & Content Posting API
  const scopes = [
    "user.info.basic",
    "user.info.profile",
    "user.info.stats",
    "video.upload",
    "video.publish",
    "video.list",
  ].join(",");

  const statePayload = Buffer.from(
    JSON.stringify({
      email,
      ts: Date.now(),
      source: "social_planner",
    })
  ).toString("base64");

  const authUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
  authUrl.searchParams.set("client_key", clientKey);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", statePayload);

  return res.redirect(authUrl.toString());
}
