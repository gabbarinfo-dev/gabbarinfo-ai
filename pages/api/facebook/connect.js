import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.email) {
    return res.redirect("/api/auth/signin");
  }

  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_CLIENT_ID,
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/facebook/callback`,
    response_type: "code",
    scope: [
      "business_management",
      "ads_management",
      "ads_read",
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_metadata",
      "pages_manage_ads",
      "instagram_basic",
      "instagram_content_publish"
    ].join(","),
    state: Buffer.from(
      JSON.stringify({ email: session.user.email })
    ).toString("base64"),
  });

  res.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params}`);
}
