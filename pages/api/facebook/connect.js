// pages/api/facebook/connect.js

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  // Safety: user must be logged in via Login app
  if (!session?.user?.email) {
    return res.status(401).send(`
      <html>
        <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
          <h1>Not Logged In</h1>
          <p>We couldn't detect your login session in this request.</p>
          <p>Please try refreshing the page or signing in again.</p>
          <a href="/" style="display:inline-block; margin-top:20px; padding:10px 20px; background:#1877F2; color:#fff; text-decoration:none; border-radius:6px;">Back to Dashboard</a>
        </body>
      </html>
    `);
  }

  const params = new URLSearchParams({
    client_id: process.env.FB_CLIENT_APP_ID,
    redirect_uri: "https://ai.gabbarinfo.com/api/facebook/callback",
    response_type: "code",
    scope: [
      "business_management",
      "ads_management",
      "ads_read",
      "pages_show_list",
      "pages_read_engagement",
      "instagram_basic",
      "instagram_content_publish",
      "pages_manage_ads"
    ].join(","),
    state: Buffer.from(
      JSON.stringify({
        email: session.user.email,
        source: "business_connect"
      })
    ).toString("base64"),
    auth_type: "reauthenticate" // Forces standard permissions dialog
  });

  res.redirect(
    `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`
  );
}
