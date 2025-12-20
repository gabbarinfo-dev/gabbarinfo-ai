export default function handler(req, res) {
  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_CLIENT_ID,
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/facebook/callback`,
    scope: [
      "email",
      "public_profile",
      "business_management",
      "pages_show_list",
      "pages_manage_metadata",
      "pages_read_engagement",
      "pages_manage_engagement",
      "ads_management",
      "ads_read"
    ].join(","),
    response_type: "code",
  });

  const url = `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
  res.redirect(url);
}
