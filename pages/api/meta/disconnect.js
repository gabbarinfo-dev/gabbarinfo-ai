import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const userEmail = session?.user?.email || req.body?.userEmail;

  if (!userEmail) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const email = userEmail.toLowerCase().trim();
  const { brandKey, disconnectAll } = req.body || {};

  try {
    // If a specific brandKey is provided (and NOT requesting disconnectAll)
    if (brandKey && brandKey !== "all" && !disconnectAll) {
      const normBrandKey = brandKey.toLowerCase().trim().replace(/[^a-z0-9]/g, "_");

      // 1. Delete this specific brand profile from agent_memory
      await supabaseServer
        .from("agent_memory")
        .delete()
        .ilike("email", email)
        .or(`memory_type.eq.meta_conn_${normBrandKey},memory_type.eq.meta_conn_${brandKey}`);

      // 2. Check remaining brand connections
      const { data: remainingRows } = await supabaseServer
        .from("agent_memory")
        .select("memory_type, content")
        .ilike("email", email)
        .like("memory_type", "meta_conn_%");

      if (remainingRows && remainingRows.length > 0) {
        // Parse the first remaining brand to make it the active profile
        let nextProfile = null;
        let nextKey = null;

        for (const row of remainingRows) {
          try {
            nextProfile = JSON.parse(row.content);
            nextKey = row.memory_type.replace("meta_conn_", "");
            break;
          } catch (_) {}
        }

        if (nextProfile && nextKey) {
          const normalizedAdId = nextProfile.adAccountId
            ? (nextProfile.adAccountId.startsWith("act_") ? nextProfile.adAccountId : `act_${nextProfile.adAccountId}`)
            : null;
          const resolvedIgId = nextProfile.igId || nextProfile.instagramActorId || null;

          // Update meta_connections to the next remaining profile
          await supabaseServer.from("meta_connections").upsert(
            {
              email,
              fb_page_id: nextProfile.pageId || null,
              fb_page_access_token: nextProfile.pageToken || null,
              fb_business_id: nextProfile.businessId || null,
              ig_business_id: resolvedIgId,
              instagram_actor_id: resolvedIgId,
              fb_ad_account_id: normalizedAdId,
              business_name: nextProfile.businessName || nextProfile.pageName || null,
              account_currency: nextProfile.currency || "INR",
              business_website: nextProfile.website || null,
              business_phone: nextProfile.phone || null,
              business_category: nextProfile.category || null,
              fb_user_access_token: nextProfile.userToken || null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "email" }
          );

          // Update active profile in agent_memory
          await supabaseServer.from("agent_memory").upsert(
            {
              email,
              memory_type: "meta_active_profile",
              content: JSON.stringify({
                activeBrandKey: nextKey,
                businessName: nextProfile.businessName || nextProfile.pageName,
                adAccountId: normalizedAdId,
                adAccountName: nextProfile.adAccountName || null,
                pageId: nextProfile.pageId || null,
                igUsername: nextProfile.igUsername || null,
                currency: nextProfile.currency || "INR",
                updated_at: new Date().toISOString(),
              }),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "email,memory_type" }
          );

          return res.status(200).json({
            ok: true,
            success: true,
            disconnectedBrand: brandKey,
            remainingCount: remainingRows.length,
            nextActiveBrand: nextKey,
            profile: nextProfile,
          });
        }
      }
      // If no remaining profiles, fall through to complete wipe below!
    }

    // COMPLETE DISCONNECT (either explicit disconnectAll, brandKey="all", or no brands left)
    await Promise.allSettled([
      // 1. Delete meta_connections table entry
      supabaseServer
        .from("meta_connections")
        .delete()
        .ilike("email", email),

      // 2. Delete all meta_conn_% in agent_memory
      supabaseServer
        .from("agent_memory")
        .delete()
        .ilike("email", email)
        .like("memory_type", "meta_conn_%"),

      // 3. Delete active profile pointer in agent_memory
      supabaseServer
        .from("agent_memory")
        .delete()
        .ilike("email", email)
        .eq("memory_type", "meta_active_profile"),

      // 4. Delete meta drafts
      supabaseServer
        .from("agent_memory")
        .delete()
        .ilike("email", email)
        .like("memory_type", "meta_draft_%"),

      // 5. Delete bundle pairings
      supabaseServer
        .from("agent_memory")
        .delete()
        .ilike("email", email)
        .in("memory_type", ["bundle_pairings", "brand_asset_pairings"]),

      // 6. Delete cached agent_meta_assets if table exists
      supabaseServer
        .from("agent_meta_assets")
        .delete()
        .ilike("email", email),
    ]);

    return res.status(200).json({
      ok: true,
      success: true,
      disconnectedAll: true,
      remainingCount: 0,
    });
  } catch (err) {
    console.error("[Meta Disconnect Error]:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
