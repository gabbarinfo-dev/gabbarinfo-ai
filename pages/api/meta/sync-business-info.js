import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ ok: false });
    }

    const { user_access_token } = req.body;

    if (!user_access_token) {
      return res.status(400).json({
        ok: false,
        message: "Missing user access token",
      });
    }

    // 1️⃣ Get Pages user manages
    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${user_access_token}`
    );
    const pagesJson = await pagesRes.json();

    if (!pagesJson?.data?.length) {
      return res.status(400).json({
        ok: false,
        message: "No Facebook Pages found",
      });
    }

    // Pick first page (you can improve later)
    const page = pagesJson.data[0];

    // 2️⃣ Fetch Page details
    const pageInfoRes = await fetch(
      `https://graph.facebook.com/v19.0/${page.id}?fields=name,phone,website,about,category&access_token=${page.access_token}`
    );
    const pageInfo = await pageInfoRes.json();

    // 3️⃣ Fetch Instagram business (if connected)
    let instagram = null;

    const igRes = await fetch(
      `https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
    );
    const igJson = await igRes.json();

    if (igJson?.instagram_business_account?.id) {
      const igInfoRes = await fetch(
        `https://graph.facebook.com/v19.0/${igJson.instagram_business_account.id}?fields=name,biography,website&access_token=${page.access_token}`
      );
      instagram = await igInfoRes.json();
    }

    // 4️⃣ Store extracted data (NO TOKENS)
    await supabaseServer
      .from("meta_connections")
      .update({
        business_name: pageInfo.name || null,
        business_phone: pageInfo.phone || null,
        business_website: pageInfo.website || null,
        business_about: pageInfo.about || null,
        business_category: pageInfo.category || null,
        instagram_bio: instagram?.biography || null,
        instagram_website: instagram?.website || null,
        business_info_synced: true,
      })
      .eq("email", session.user.email);

    return res.json({
      ok: true,
      message: "Business info synced successfully",
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
}
