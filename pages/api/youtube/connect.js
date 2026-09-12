// pages/api/youtube/connect.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email || req.query?.userEmail;

  if (!email) {
    return res.status(401).send(`
      <html>
        <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center; background: #0f172a; color: #fff;">
          <h2>Session Not Detected</h2>
          <p>Please log in before connecting your YouTube channel.</p>
          <a href="/login" style="display:inline-block; margin-top:20px; padding:10px 20px; background:#ef4444; color:#fff; text-decoration:none; border-radius:6px;">Log In</a>
        </body>
      </html>
    `);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const host = req.headers["x-forwarded-host"] || req.headers.host || "ai.gabbarinfo.com";
  const protocol = req.headers["x-forwarded-proto"] || (host.includes("localhost") ? "http" : "https");
  const redirectUri = `${protocol}://${host}/api/youtube/callback`;

  const scopes = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
    "openid",
    "email",
    "profile"
  ].join(" ");

  const state = Buffer.from(
    JSON.stringify({
      email,
      returnUrl: req.query.returnUrl || "/?tab=reels"
    })
  ).toString("base64");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return res.redirect(authUrl);
}
