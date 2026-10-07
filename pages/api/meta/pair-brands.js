import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    const userEmail = session?.user?.email || req.body?.userEmail;

    if (!userEmail) {
      return res.status(401).json({ ok: false, message: "Not authenticated" });
    }

    const { pairings = [] } = req.body;
    if (!Array.isArray(pairings) || pairings.length === 0) {
      return res.status(400).json({ ok: false, message: "No pairings provided" });
    }

    const email = userEmail.toLowerCase().trim();
    const savedProfiles = [];

    for (const item of pairings) {
      const pageName = item.pageName || item.businessName || `Brand_${item.pageId}`;
      const normName = pageName.toLowerCase().trim().replace(/[^a-z0-9]/g, "_");

      const brandPayload = {
        businessName: pageName,
        pageId: item.pageId,
        pageName: pageName,
        pageToken: item.pageToken,
        igId: item.igId || null,
        igUsername: item.igUsername || null,
        businessId: item.businessId || null,
        businessTitle: item.businessTitle || pageName,
        adAccountId: item.adAccountId || null,
        adAccountName: item.adAccountName || null,
        websiteUrl: item.websiteUrl || null,
        websiteType: item.websiteType || "wordpress", // "wordpress" | "shopify" | "custom"
        logo_url: item.logo_url || null,
        logo_filename: item.logo_filename || null,
        connectedAt: new Date().toISOString(),
      };

      const { error: upsertErr } = await supabaseServer.from("agent_memory").upsert(
        {
          email,
          memory_type: `meta_conn_${normName}`,
          content: JSON.stringify(brandPayload),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email,memory_type" }
      );

      if (upsertErr) {
        console.error(`Failed to upsert meta_conn_${normName}:`, upsertErr);
      } else {
        savedProfiles.push({ key: normName, ...brandPayload });

        // Also synchronize logo into social_autopilot memory if present
        if (item.logo_url) {
          try {
            const autoKey = `social_autopilot_${email}_${normName}`;
            const { data: autoData } = await supabaseServer
              .from("agent_memory")
              .select("content")
              .eq("email", email)
              .eq("memory_type", autoKey)
              .maybeSingle();

            let autoObj = {};
            if (autoData?.content) {
              try { autoObj = JSON.parse(autoData.content); } catch (_) {}
            }
            autoObj.logo_url = item.logo_url;
            autoObj.logo_filename = item.logo_filename || "brand_logo.png";

            await supabaseServer.from("agent_memory").upsert(
              {
                email,
                memory_type: autoKey,
                content: JSON.stringify(autoObj),
                updated_at: new Date().toISOString(),
              },
              { onConflict: "email,memory_type" }
            );
          } catch (syncErr) {
            console.warn(`Failed to sync logo to ${normName} autopilot:`, syncErr);
          }
        }
      }
    }

    // Persist full bundle pairings in agent_memory for instant cross-module lookup
    await supabaseServer.from("agent_memory").upsert(
      {
        email,
        memory_type: "bundle_pairings",
        content: JSON.stringify(pairings),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email,memory_type" }
    );

    // Also update primary meta_connections with first pairing for backward compatibility
    if (savedProfiles.length > 0) {
      const primary = savedProfiles[0];
      await supabaseServer.from("meta_connections").upsert(
        {
          email,
          fb_page_id: primary.pageId,
          fb_page_access_token: primary.pageToken,
          fb_business_id: primary.businessId,
          ig_business_id: primary.igId,
          instagram_actor_id: primary.igId,
          fb_ad_account_id: primary.adAccountId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      );
    }

    return res.json({
      ok: true,
      message: `Successfully saved ${savedProfiles.length} brand profile(s).`,
      savedProfiles,
    });
  } catch (err) {
    console.error("pair-brands error:", err);
    return res.status(500).json({ ok: false, message: err.message });
  }
}
