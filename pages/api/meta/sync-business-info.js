import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ ok: false });
    }

    const user_access_token = process.env.META_SYSTEM_USER_TOKEN;

    // 0️⃣ Get existing Meta connection for fb_business_id
    const { data: metaRow } = await supabaseServer
      .from("meta_connections")
      .select("fb_business_id")
      .eq("email", session.user.email)
      .single();

    const businessId = metaRow?.fb_business_id;
    let adAccountId = null;

    // Fetch Ad Accounts (Strictly Business-owned)
    try {
      if (businessId) {
        const bizAdRes = await fetch(
          `https://graph.facebook.com/v21.0/${businessId}/owned_ad_accounts?access_token=${user_access_token}`
        );
        const bizAdJson = await bizAdRes.json();
        if (bizAdJson?.data?.length) {
          adAccountId = bizAdJson.data[0].id;
        }
      }

      if (!adAccountId) {
        return res.status(400).json({
          ok: false,
          message: "No business-owned ad accounts found. A Meta Business account is required.",
        });
      }
    } catch (e) {
      return res.status(500).json({ ok: false, message: `AdAccount Sync Failed: ${e.message}` });
    }

    // 1️⃣ Get Pages user manages
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?access_token=${user_access_token}`
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

    // 2️⃣ Fetch Page details (Including Page Access Token)
    const pageInfoRes = await fetch(
      `https://graph.facebook.com/v21.0/${page.id}?fields=name,phone,website,about,category,access_token&access_token=${user_access_token}`
    );
    const pageInfo = await pageInfoRes.json();

    // 3️⃣ Fetch Instagram business (if connected)
    let instagram = null;
    let instagramActorId = null;

    const igRes = await fetch(
      `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account&access_token=${user_access_token}`
    );
    const igJson = await igRes.json();

    if (igJson?.instagram_business_account?.id) {
      const igId = igJson.instagram_business_account.id;

      // Explicitly resolve Actor ID for creatives
      try {
        const actorRes = await fetch(
          `https://graph.facebook.com/v21.0/${igId}?fields=id,username&access_token=${user_access_token}`
        );
        const actorJson = await actorRes.json();
        if (actorJson?.id) instagramActorId = actorJson.id;
      } catch (e) {
        console.warn(`[IG Actor Resolution Failed] ${e.message}`);
      }

      const igInfoRes = await fetch(
        `https://graph.facebook.com/v21.0/${igId}?fields=name,biography,website&access_token=${user_access_token}`
      );
      instagram = await igInfoRes.json();
    }

    // 4️⃣ Fetch Ad Account Currency
    let accountCurrency = null;
    try {
      const currRes = await fetch(
        `https://graph.facebook.com/v21.0/${adAccountId}?fields=currency&access_token=${user_access_token}`
      );
      const currJson = await currRes.json();
      if (currJson.currency) {
        accountCurrency = currJson.currency;
        console.log(`💱 [Sync] Currency detected: ${accountCurrency}`);
      }
    } catch (e) {
      console.warn(`⚠️ [Sync] Currency detection failed: ${e.message}`);
    }

    // 5️⃣ Fetch Pixel ID
    let pixelId = null;
    try {
      const pixRes = await fetch(
        `https://graph.facebook.com/v21.0/${adAccountId}/adspixels?fields=id,name&access_token=${user_access_token}`
      );
      const pixJson = await pixRes.json();
      if (pixJson?.data?.length) {
        pixelId = pixJson.data[0].id;
        console.log(`🎯 [Sync] Pixel found: ${pixelId}`);
      }
    } catch (e) {
      console.warn(`⚠️ [Sync] Pixel discovery failed: ${e.message}`);
    }

    // 6️⃣ Deep Catalogue Scan
    let catalogId = null;
    try {
      const cleanAdId = (adAccountId || "").toString().replace(/^act_/, "");
      const catalogEndpoints = [
        businessId ? `https://graph.facebook.com/v21.0/${businessId}/owned_product_catalogs?fields=id,name,product_count&access_token=${user_access_token}` : null,
        `https://graph.facebook.com/v21.0/${adAccountId}/product_catalogs?fields=id,name,product_count&access_token=${user_access_token}`,
        `https://graph.facebook.com/v21.0/${adAccountId}/client_product_catalogs?fields=id,name,product_count&access_token=${user_access_token}`,
        `https://graph.facebook.com/v21.0/act_${cleanAdId}/assigned_product_catalogs?fields=id,name,product_count&access_token=${user_access_token}`,
        page.id ? `https://graph.facebook.com/v21.0/${page.id}/product_catalogs?fields=id,name,product_count&access_token=${user_access_token}` : null,
        businessId ? `https://graph.facebook.com/v21.0/${businessId}/assigned_product_catalogs?fields=id,name,product_count&access_token=${user_access_token}` : null,
        businessId ? `https://graph.facebook.com/v21.0/${businessId}/client_product_catalogs?fields=id,name,product_count&access_token=${user_access_token}` : null,
      ].filter(Boolean);

      const allCatalogs = [];
      for (const url of catalogEndpoints) {
        try {
          const catRes = await fetch(url);
          const catJson = await catRes.json();
          if (catJson?.data?.length) allCatalogs.push(...catJson.data);
        } catch (_) { /* skip failed endpoint */ }
      }

      // De-duplicate and pick the one with the most products
      const unique = Array.from(new Map(allCatalogs.map(c => [c.id, c])).values());
      if (unique.length > 0) {
        unique.sort((a, b) => (b.product_count || 0) - (a.product_count || 0));
        catalogId = unique[0].id;
        console.log(`🛍️ [Sync] Best catalogue: "${unique[0].name}" (ID: ${catalogId}, Products: ${unique[0].product_count || 0})`);
      }
    } catch (e) {
      console.warn(`⚠️ [Sync] Catalogue discovery failed: ${e.message}`);
    }

    // 7️⃣ Store extracted data
    await supabaseServer
      .from("meta_connections")
      .update({
        fb_ad_account_id: adAccountId || undefined,
        fb_page_id: page.id || null, // Ensure Page ID is persisted
        fb_page_access_token: pageInfo.access_token || null, // Persist Page Token
        ig_business_id: igJson?.instagram_business_account?.id || null,
        instagram_actor_id: instagramActorId,
        business_name: pageInfo.name || null,
        business_phone: pageInfo.phone || null,
        business_website: pageInfo.website || null,
        business_about: pageInfo.about || null,
        business_category: pageInfo.category || null,
        instagram_bio: instagram?.biography || null,
        instagram_website: instagram?.website || null,
        business_info_synced: true,
        // NEW: Synced Meta Assets
        account_currency: accountCurrency || undefined,
        fb_pixel_id: pixelId || undefined,
        fb_catalog_id: catalogId || undefined,
        catalog_last_synced_at: catalogId ? new Date().toISOString() : undefined,
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
