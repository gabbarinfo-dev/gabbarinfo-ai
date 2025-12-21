// pages/api/facebook/connect.js

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  // Safety: user must be logged in via Login app
  if (!session?.user?.email) {
    return res.redirect("/api/auth/signin");
  }

  const params = new URLSearchParams({
    client_id: process.env.FB_APP_ID,
    redirect_uri: "https://ai.gabbarinfo.com/api/facebook/business-callback",
    response_type: "code",
    scope: [
      "business_management",
      "ads_management",
      "ads_read",
      "pages_show_list",
      "pages_read_engagement",
      "instagram_basic"
    ].join(","),
    state: Buffer.from(
      JSON.stringify({
        email: session.user.email,
        source: "business_connect"
      })
    ).toString("base64"),
  });

  res.redirect(
    `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`
  );
}
