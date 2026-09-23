// pages/api/meta/select-profile.js
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

    const { brandKey } = req.body || {};
    if (!brandKey) {
      return res.status(400).json({ ok: false, message: "brandKey is required" });
    }

    const email = userEmail.toLowerCase().trim();

    // 1. Fetch brand memory
    const { data: brandMem, error: memErr } = await supabaseServer
      .from("agent_memory")
      .select("content")
      .eq("email", email)
      .eq("memory_type", `meta_conn_${brandKey}`)
      .maybeSingle();

    if (memErr || !brandMem?.content) {
      return res.status(404).json({
        ok: false,
        message: `Brand profile '${brandKey}' not found in connected profiles.`,
      });
    }

    let brandProfile = {};
    try {
      brandProfile = JSON.parse(brandMem.content);
    } catch (e) {
      return res.status(500).json({ ok: false, message: "Invalid brand profile data." });
    }

    // 2. Synchronize active credentials in meta_connections
    const normalizedAdId = brandProfile.adAccountId
      ? (brandProfile.adAccountId.startsWith("act_") ? brandProfile.adAccountId : `act_${brandProfile.adAccountId}`)
      : null;

    const resolvedIgId = brandProfile.igId || brandProfile.instagramActorId || null;

    const upsertPayload = {
      email,
      fb_page_id: brandProfile.pageId || null,
      fb_page_access_token: brandProfile.pageToken || null,
      fb_business_id: brandProfile.businessId || null,
      ig_business_id: resolvedIgId,
      instagram_actor_id: resolvedIgId,
      fb_ad_account_id: normalizedAdId,
      business_name: brandProfile.businessName || brandProfile.pageName || null,
      account_currency: brandProfile.currency || "INR",
      business_website: brandProfile.website || null,
      business_phone: brandProfile.phone || null,
      business_category: brandProfile.category || null,
      fb_user_access_token: brandProfile.userToken || null,
      updated_at: new Date().toISOString(),
    };

    const { error: syncErr } = await supabaseServer
      .from("meta_connections")
      .upsert(upsertPayload, { onConflict: "email" });

    if (syncErr) {
      console.error("[select-profile] Error updating meta_connections:", syncErr);
    }

    // 3. Save active profile marker in agent_memory
    await supabaseServer.from("agent_memory").upsert(
      {
        email,
        memory_type: "meta_active_profile",
        content: JSON.stringify({
          activeBrandKey: brandKey,
          businessName: brandProfile.businessName || brandProfile.pageName,
          adAccountId: normalizedAdId,
          adAccountName: brandProfile.adAccountName || null,
          pageId: brandProfile.pageId || null,
          igUsername: brandProfile.igUsername || null,
          currency: brandProfile.currency || "INR",
          updated_at: new Date().toISOString(),
        }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email,memory_type" }
    );

    // 4. Delete stale agent_meta_assets cache for this user
    try {
      await supabaseServer
        .from("agent_meta_assets")
        .delete()
        .eq("email", email);
    } catch (e) {
      console.warn("[select-profile] agent_meta_assets cache delete warning:", e.message);
    }

    // 5. Clean up any in-progress draft campaign_state so switching accounts starts fresh
    try {
      const { data: clientMem } = await supabaseServer
        .from("agent_memory")
        .select("content")
        .eq("email", email)
        .eq("memory_type", "client")
        .maybeSingle();

      if (clientMem?.content) {
        const parsed = JSON.parse(clientMem.content);
        if (parsed.business_answers) {
          // Remove campaign_state from all business answer buckets
          for (const key of Object.keys(parsed.business_answers)) {
            if (parsed.business_answers[key]?.campaign_state) {
              delete parsed.business_answers[key].campaign_state;
            }
          }
          await supabaseServer
            .from("agent_memory")
            .update({
              content: JSON.stringify(parsed),
              updated_at: new Date().toISOString(),
            })
            .eq("email", email)
            .eq("memory_type", "client");
        }
      }
    } catch (cleanErr) {
      console.warn("[select-profile] draft clean warning:", cleanErr.message);
    }

    return res.status(200).json({
      ok: true,
      message: `Switched active Meta profile to ${brandProfile.businessName || brandKey}.`,
      activeBrandKey: brandKey,
      profile: brandProfile,
    });
  } catch (err) {
    console.error("[select-profile] Unhandled error:", err);
    return res.status(500).json({ ok: false, message: err.message });
  }
}
