import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ ok: false });
    }

    // 🔥 Get user-specific access token
    const { data: metaRow } = await supabaseServer
      .from("meta_connections")
      .select("fb_business_id, fb_user_access_token")
      .eq("email", session.user.email)
      .single();

    const businessId = metaRow?.fb_business_id;
    const user_access_token = metaRow?.fb_user_access_token;
    let adAccountId = null;

    if (!user_access_token) {
      return res.status(400).json({
        ok: false,
        message: "Missing user access token. Please reconnect Facebook Business.",
      });
    }

    // --- STEP 0: Fetch Ad Account (Try Business Owned, then Fallback to Personal) ---
    try {
      // 1. Try Business Owned Ad Accounts
      if (businessId) {
        console.log(`🏢 [Sync] Attempting Business sync for ID: ${businessId}`);
        const bizAdRes = await fetch(
          `https://graph.facebook.com/v21.0/${businessId}/owned_ad_accounts?access_token=${user_access_token}`
        );
        const bizAdJson = await bizAdRes.json();
        if (bizAdJson?.data?.length) {
          adAccountId = bizAdJson.data[0].id;
          console.log(`✅ [Sync] Business ad account found: ${adAccountId}`);
        }
      }

      // 2. Fallback: Fetch any accessible ad accounts (Personal/Direct)
      if (!adAccountId) {
        console.log("📍 [Sync] No business ad account. Falling back to personal accounts (/me/adaccounts)...");
        const personalAdRes = await fetch(
          `https://graph.facebook.com/v21.0/me/adaccounts?access_token=${user_access_token}`
        );
        const personalAdJson = await personalAdRes.json();
        if (personalAdJson?.data?.length) {
          adAccountId = personalAdJson.data[0].id;
          console.log(`✅ [Sync] Personal/Fallback ad account found: ${adAccountId}`);
        }
      }

      // 3. Optional: Only error if ABSOLUTELY no ad account found and we need it for Ads
      // For now, we allow continuing if Page sync might still work (for Instagram organic)
      if (!adAccountId) {
        console.warn("⚠️ [Sync] No ad accounts found. Only Page/Instagram features will be enabled.");
      }
    } catch (e) {
      console.error(`[Sync AdAccount Error] ${e.message}`);
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
        adAccountId ? `https://graph.facebook.com/v21.0/${adAccountId}/product_catalogs?fields=id,name,product_count&access_token=${user_access_token}` : null,
        adAccountId ? `https://graph.facebook.com/v21.0/act_${cleanAdId}/assigned_product_catalogs?fields=id,name,product_count&access_token=${user_access_token}` : null,
        page?.id ? `https://graph.facebook.com/v21.0/${page.id}/product_catalogs?fields=id,name,product_count&access_token=${user_access_token}` : null,
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

    // 7️⃣ Refined WhatsApp Business Number Sync (4-Step Discovery)
    let whatsappBusinessNumber = null;
    let whatsappBusinessNumberId = null;

    try {
      console.log(`📱 [Sync] Starting Refined WhatsApp discovery...`);

      // STEP 1: WABA Discovery (Business-owned WABAs)
      if (businessId) {
        try {
          const wabaRes = await fetch(
            `https://graph.facebook.com/v21.0/${businessId}/owned_whatsapp_business_accounts?access_token=${user_access_token}`
          );
          const wabaJson = await wabaRes.json();

          if (wabaJson?.data?.length) {
            for (const waba of wabaJson.data) {
              const wabaId = waba.id;
              console.log(`📱 [Sync] Checking WABA ID: ${wabaId}`);

              const phoneRes = await fetch(
                `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?access_token=${user_access_token}`
              );
              const phoneJson = await phoneRes.json();

              if (phoneJson?.data?.length) {
                // Find first verified number or just first number
                const found = phoneJson.data[0];
                whatsappBusinessNumber = found.display_phone_number;
                whatsappBusinessNumberId = found.id;
                console.log(`✅ [Sync] STEP 1: WhatsApp Business Number found: ${whatsappBusinessNumber} (ID: ${whatsappBusinessNumberId})`);
                break;
              }
            }
          }
        } catch (e) {
          console.warn(`[Sync] STEP 1 (WABA) failed: ${e.message}`);
        }
      }

      // STEP 2: Page-Linked WhatsApp (Strict) — Use Page Access Token
      if (!whatsappBusinessNumber && page?.id && pageInfo?.access_token) {
        try {
          console.log(`📱 [Sync] STEP 2: Page-linked WhatsApp search using Page Access Token...`);
          const pageWasaRes = await fetch(
            `https://graph.facebook.com/v21.0/${page.id}?fields=whatsapp_number&access_token=${pageInfo.access_token}`
          );
          const pageWasaJson = await pageWasaRes.json();
          if (pageWasaJson?.whatsapp_number) {
            whatsappBusinessNumber = pageWasaJson.whatsapp_number;
            console.log(`✅ [Sync] STEP 2: Page-linked WhatsApp Number found: ${whatsappBusinessNumber}`);
          }
        } catch (e) {
          console.warn(`[Sync] STEP 2 (Page Link) failed: ${e.message}`);
        }
      }

      // STEP 3: Ads Capability Fallback (Check Page CTAs)
      if (!whatsappBusinessNumber && page?.id && pageInfo?.access_token) {
        try {
          console.log(`📱 [Sync] STEP 3: Checking Page CTAs for WhatsApp...`);
          const ctaRes = await fetch(
            `https://graph.facebook.com/v21.0/${page.id}/call_to_actions?fields=type,status,whatsapp_number&access_token=${pageInfo.access_token}`
          );
          const ctaJson = await ctaRes.json();
          const waCTA = ctaJson?.data?.find(cta => cta.type === "WHATSAPP_MESSAGE" && cta.whatsapp_number);
          if (waCTA) {
            whatsappBusinessNumber = waCTA.whatsapp_number;
            console.log(`✅ [Sync] STEP 3: Found WhatsApp in Page CTA: ${whatsappBusinessNumber}`);
          }
        } catch (e) {
          console.warn(`[Sync] STEP 3 (CTA Fallback) failed: ${e.message}`);
        }
      }

      // STEP 3.5: Connected WhatsApp Business Account (New Page Field Discovery)
      if (!whatsappBusinessNumber && page?.id && pageInfo?.access_token) {
        try {
          console.log(`📱 [Sync] STEP 3.5: Checking connected_whatsapp_business_account...`);
          const connRes = await fetch(
            `https://graph.facebook.com/v21.0/${page.id}?fields=connected_whatsapp_business_account&access_token=${pageInfo.access_token}`
          );
          const connJson = await connRes.json();

          if (connJson?.connected_whatsapp_business_account?.id) {
            const connectedWabaId = connJson.connected_whatsapp_business_account.id;
            console.log(`📱 [Sync] Found Connected WABA ID: ${connectedWabaId}`);

            const phoneRes = await fetch(
              `https://graph.facebook.com/v21.0/${connectedWabaId}/phone_numbers?access_token=${pageInfo.access_token}`
            );
            const phoneJson = await phoneRes.json();

            if (phoneJson?.data?.length) {
              const found = phoneJson.data[0];
              whatsappBusinessNumber = found.display_phone_number;
              whatsappBusinessNumberId = found.id;
              console.log(`✅ [Sync] STEP 3.5: Found WhatsApp from Connected WABA: ${whatsappBusinessNumber} (ID: ${whatsappBusinessNumberId})`);
            }
          }
        } catch (e) {
          console.warn(`[Sync] STEP 3.5 (Connected WABA) failed: ${e.message}`);
        }
      }

      // STEP 4: Final Fallback (Use Business Phone)
      if (!whatsappBusinessNumber && pageInfo?.phone) {
        whatsappBusinessNumber = pageInfo.phone;
        console.log(`✅ [Sync] STEP 4: Final fallback using Business Phone: ${whatsappBusinessNumber}`);
      }

    } catch (e) {
      console.warn(`⚠️ [Sync] WhatsApp discovery fatal error: ${e.message}`);
    }

    // 8️⃣ Store extracted data
    await supabaseServer
      .from("meta_connections")
      .update({
        fb_ad_account_id: adAccountId || undefined,
        fb_page_id: page.id || null,
        fb_page_access_token: pageInfo.access_token || null,
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
        account_currency: accountCurrency || undefined,
        fb_pixel_id: pixelId || undefined,
        fb_catalog_id: catalogId || undefined,
        catalog_last_synced_at: catalogId ? new Date().toISOString() : undefined,
        whatsapp_business_number: whatsappBusinessNumber || null,
        whatsapp_business_number_id: whatsappBusinessNumberId || null,
      })
      .eq("email", session.user.email);

    return res.json({
      ok: true,
      message: "Business info synced successfully",
      fb_business_id: businessId,
      fb_page_id: page.id,
      fb_ad_account_id: adAccountId,
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
}
