import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    const userEmail = session?.user?.email || req.body?.userEmail || req.query?.userEmail;
    if (!userEmail) {
      return res.status(401).json({ ok: false, error: "Not authenticated" });
    }

    const normEmail = userEmail.toLowerCase().trim();

    // 1. Get user-specific access token
    const { data: metaRow } = await supabaseServer
      .from("meta_connections")
      .select("fb_business_id, fb_user_access_token")
      .ilike("email", normEmail)
      .maybeSingle();

    const businessId = metaRow?.fb_business_id;
    const user_access_token = metaRow?.fb_user_access_token;

    if (!user_access_token) {
      return res.status(400).json({
        ok: false,
        message: "Missing user access token. Please reconnect Facebook Business.",
      });
    }

    // 2. Fetch all businesses, ad accounts, and pages in parallel
    const [bizRes, adRes, pagesRes] = await Promise.all([
      fetch(`https://graph.facebook.com/v21.0/me/businesses?access_token=${user_access_token}`)
        .then(r => r.json())
        .catch(() => ({ data: [] })),
      fetch(`https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id,currency,business&access_token=${user_access_token}`)
        .then(r => r.json())
        .catch(() => ({ data: [] })),
      fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,phone,website,about,bio,description,category,category_list,access_token,instagram_business_account{id,username,name,biography,website}&access_token=${user_access_token}`)
        .then(r => r.json())
        .catch(() => ({ data: [] })),
    ]);

    const allBusinesses = bizRes.data || [];
    const allAdAccounts = adRes.data || [];
    const allPages = pagesRes.data || [];

    if (allPages.length === 0) {
      return res.status(400).json({
        ok: false,
        message: "No Facebook Pages found on this account. Please verify permissions in Facebook Business.",
      });
    }

    // 3. Multi-brand isolation: save every page/brand bundle to agent_memory & discover intelligence
    const { discoverAndCacheMetaBrandIntelligence } = await import("../../../lib/meta/brand-intelligence.js");
    const allMetaConnections = {};
    const connectedBrands = [];
    const discoveredIntelligences = {};

    for (let i = 0; i < allPages.length; i++) {
      const page = allPages[i];
      const pageName = page.name || `Brand_${page.id}`;
      const normName = pageName.toLowerCase().trim().replace(/[^a-z0-9]/g, "_");

      // Match closest Ad Account (by business or page name or index)
      const matchingAd = allAdAccounts.find(a =>
        (a.business?.name && pageName.toLowerCase().includes(a.business.name.toLowerCase())) ||
        (a.name && pageName.toLowerCase().includes(a.name.toLowerCase()))
      ) || allAdAccounts[i] || allAdAccounts[0] || null;

      // Match closest Business Manager
      const matchingBiz = allBusinesses.find(b =>
        pageName.toLowerCase().includes(b.name.toLowerCase())
      ) || allBusinesses[i] || allBusinesses[0] || null;

      const igData = page.instagram_business_account || null;
      const brandWebsite = page.website || igData?.website || null;

      const brandPayload = {
        businessName: pageName,
        pageId: page.id,
        pageName: pageName,
        pageToken: page.access_token,
        category: page.category || null,
        categoryList: page.category_list || [],
        about: page.about || null,
        bio: page.bio || null,
        description: page.description || null,
        phone: page.phone || null,
        website: brandWebsite,
        websiteUrl: brandWebsite,
        igId: igData?.id || null,
        igUsername: igData?.username || null,
        igName: igData?.name || null,
        igBiography: igData?.biography || null,
        igWebsite: igData?.website || null,
        businessId: matchingBiz?.id || businessId || null,
        businessTitle: matchingBiz?.name || pageName,
        adAccountId: matchingAd?.id || null,
        adAccountName: matchingAd?.name || null,
        currency: matchingAd?.currency || "INR",
        userToken: user_access_token,
        connectedAt: new Date().toISOString(),
      };

      allMetaConnections[normName] = brandPayload;
      connectedBrands.push(normName);

      await supabaseServer.from("agent_memory").upsert(
        {
          email: normEmail,
          memory_type: `meta_conn_${normName}`,
          content: JSON.stringify(brandPayload),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email,memory_type" }
      );

      // Trigger automatic website crawl and brand intelligence synthesis
      discoverAndCacheMetaBrandIntelligence({
        email: normEmail,
        normBusiness: normName,
        brandPayload,
        forceRefresh: true,
      })
        .then((intel) => {
          if (intel) discoveredIntelligences[normName] = intel;
        })
        .catch((e) => console.warn(`[Sync Meta Intel Error for ${normName}]:`, e.message));
    }

    // 4. Update primary meta_connections row with first/primary asset
    const primaryPage = allPages[0];
    const primaryAd = allAdAccounts[0];
    const primaryBiz = allBusinesses[0];

    const primaryPageIg = primaryPage.instagram_business_account?.id || primaryPage.connected_instagram_account?.id || null;
    const primaryWebsite = primaryPage.website || primaryPage.instagram_business_account?.website || null;
    const primaryAbout = primaryPage.about || primaryPage.bio || primaryPage.description || null;

    await supabaseServer
      .from("meta_connections")
      .update({
        fb_ad_account_id: primaryAd?.id || undefined,
        fb_business_id: primaryBiz?.id || businessId || undefined,
        fb_page_id: primaryPage.id || null,
        fb_page_access_token: primaryPage.access_token || null,
        ig_business_id: primaryPageIg,
        instagram_actor_id: primaryPageIg,
        business_name: primaryPage.name || null,
        business_phone: primaryPage.phone || null,
        business_website: primaryWebsite,
        business_about: primaryAbout,
        business_category: primaryPage.category || null,
        business_info_synced: true,
        account_currency: primaryAd?.currency || "INR",
        updated_at: new Date().toISOString(),
      })
      .ilike("email", normEmail);

    return res.json({
      ok: true,
      message: `Successfully synchronized ${allPages.length} Facebook Page(s), ${allAdAccounts.length} Ad Account(s), and ${allBusinesses.length} Business profile(s).`,
      connectedBrands,
      allMetaConnections,
      totalPages: allPages.length,
      totalAdAccounts: allAdAccounts.length,
    });
  } catch (err) {
    console.error("[Sync Meta Error]", err);
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
}
