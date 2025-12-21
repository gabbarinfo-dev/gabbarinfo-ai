import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.email) {
    return res.redirect("/api/auth/signin");
  }

  const params = new URLSearchParams({
    app_id: process.env.FACEBOOK_CLIENT_ID,
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/facebook/callback`,
    state: JSON.stringify({
      email: session.user.email,
    }),
    scope: [
      "business_management",
      "ads_management",
      "ads_read",
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_metadata",
      "pages_manage_ads",
      "instagram_basic",
      "instagram_content_publish",
    ].join(","),
  });

  res.redirect(
    `https://www.facebook.com/dialog/business/login/?${params}`
  );
}
