// pages/api/wordpress/sync.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import { verifyEntitlement, FEATURES } from "../../../lib/auth/entitlements";
import { getBusinessSubscriptionState, reserveQuota, commitQuota, releaseQuota } from "../../../lib/billing/quota-service";
import { checkAssetTrialEligibility, registerAssetClaim } from "../../../lib/billing/asset-registry";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const userEmail = session?.user?.email || req.body?.userEmail || req.query?.userEmail;

  if (!userEmail) {
    return res.status(401).json({ ok: false, error: "Unauthorized: Please log in" });
  }

  const body = req.method === "POST" ? (req.body || {}) : (req.query || {});
  const {
    action = "get-connection",
    siteUrl,
    apiKey,
    businessName,
    googleTagId,
    conversionLabel,
    metaPixelId,
    postData,
    seoData,
    updateData,
    type,
    per_page,
  } = body;

  const normalizedBusiness = (businessName || "default")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "_");
  const memoryKey = `wp_conn_${normalizedBusiness}`;

  // Helper to clean URL
  const formatUrl = (rawUrl) => {
    if (!rawUrl) return "";
    let clean = String(rawUrl).trim().replace(/\/+$/, "");
    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
      clean = "https://" + clean;
    }
    return clean;
  };

  try {
    // ----------------------------------------------------------------
    // 1. GET CONNECTION(S)
    // ----------------------------------------------------------------
    if (action === "get-connection") {
      // If a specific business is requested, fetch it; otherwise fetch all wp connections
      const { data: mems, error } = await supabase
        .from("agent_memory")
        .select("memory_type, content, updated_at")
        .eq("email", userEmail)
        .like("memory_type", "wp_conn_%");

      if (error) {
        console.error("Failed to fetch wp connections:", error);
        return res.status(500).json({ ok: false, error: error.message });
      }

      const connections = {};
      (mems || []).forEach((m) => {
        try {
          const parsed = JSON.parse(m.content);
          const bKey = m.memory_type.replace("wp_conn_", "");
          connections[bKey] = parsed;
        } catch (e) {}
      });

      // Support single target business lookup strictly without accidental fallbacks
      let activeConn = null;
      if (normalizedBusiness === "custom") {
        activeConn = null;
      } else if (body.businessName && normalizedBusiness !== "default") {
        activeConn = connections[normalizedBusiness] || null;
      } else {
        activeConn = connections["default"] || Object.values(connections)[0] || null;
      }

      return res.status(200).json({
        ok: true,
        connection: activeConn,
        allConnections: connections,
      });
    }

    // ----------------------------------------------------------------
    // 2. TEST CONNECTION / HEALTH
    // ----------------------------------------------------------------
    if (action === "health" || action === "test-connection") {
      if (!siteUrl) return res.status(400).json({ ok: false, error: "Missing siteUrl" });
      const cleanUrl = formatUrl(siteUrl);

      const resp = await fetch(`${cleanUrl}/wp-json/gabbarinfo/v1/health`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const data = await resp.json().catch(() => null);

      return res.status(resp.ok ? 200 : 400).json({
        ok: resp.ok,
        status: resp.status,
        data,
      });
    }

    // ----------------------------------------------------------------
    // 3. SAVE / CONNECT WORDPRESS WEBSITE (With Resource Limit Gate)
    // ----------------------------------------------------------------
    if (action === "save-connection") {
      if (!siteUrl || !apiKey) {
        return res.status(400).json({ ok: false, error: "Site URL and API Key are required" });
      }

      // Check simultaneous site resource limits
      const subState = await getBusinessSubscriptionState(null, userEmail);
      const plan = subState.plan;
      const maxSites = plan.limits?.maxWordPressSites || 1;

      // Count existing connected sites
      const { data: existingSites } = await supabase
        .from("agent_memory")
        .select("memory_type")
        .eq("email", userEmail)
        .like("memory_type", "wp_conn_%");

      const existingCount = (existingSites || []).length;
      const isUpdatingExisting = existingSites?.some(s => s.memory_type === memoryKey);

      if (!isUpdatingExisting && existingCount >= maxSites && !subState.isUnlimited) {
        return res.status(403).json({
          ok: false,
          code: "RESOURCE_LIMIT_REACHED",
          error: `Your current ${plan.name} plan permits up to ${maxSites} connected WordPress website(s). You currently have ${existingCount}. Upgrade your plan to connect additional websites.`,
        });
      }

      const isTrial = plan.category === "trial" || plan.id === "trial_99" || plan.id === "none" || plan.id === "try";
      const eligibility = await checkAssetTrialEligibility({
        assetType: "wordpress_domain",
        identifier: siteUrl,
        userEmail,
      });

      if (!eligibility.eligible && isTrial && !subState.isUnlimited) {
        return res.status(403).json({
          ok: false,
          code: eligibility.code || "DUPLICATE_TRIAL_ASSET",
          error: eligibility.error,
        });
      }

      const cleanUrl = formatUrl(siteUrl);

      // Verify credentials with plugin
      const healthResp = await fetch(`${cleanUrl}/wp-json/gabbarinfo/v1/health`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const healthData = await healthResp.json().catch(() => ({}));

      if (!healthResp.ok) {
        return res.status(400).json({
          ok: false,
          error: "Could not reach GabbarInfo AI plugin on that site. Please ensure the plugin is installed and activated.",
        });
      }

      const connPayload = {
        siteUrl: cleanUrl,
        apiKey: String(apiKey).trim(),
        businessName: businessName || healthData.site_name || "My Website",
        siteName: healthData.site_name || "",
        pluginVersion: healthData.plugin_version || "1.0.0",
        isWooCommerce: Boolean(healthData.is_woocommerce),
        googleTagId: healthData.google_tag_id || "",
        metaPixelId: healthData.meta_pixel_id || "",
        connected_at: new Date().toISOString(),
      };

      await supabase.from("agent_memory").upsert(
        {
          email: userEmail,
          memory_type: memoryKey,
          content: JSON.stringify(connPayload),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email,memory_type" }
      );

      // If no default exists, also write default
      await supabase.from("agent_memory").upsert(
        {
          email: userEmail,
          memory_type: "wordpress_connection",
          content: JSON.stringify(connPayload),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email,memory_type" }
      );

      // Global Anti-Abuse Registry: Lock asset claim
      await registerAssetClaim({
        assetType: "wordpress_domain",
        identifier: siteUrl,
        userEmail,
        planId: plan.id,
        isTrial,
      });

      // Asynchronously trigger site discovery so topics, niche, and keywords are immediately ready
      import("../../../lib/wordpress/site-intelligence.js")
        .then((m) =>
          m.getOrDiscoverSiteIntelligence({
            userEmail,
            businessName: connPayload.businessName,
            siteUrl: cleanUrl,
            forceRefresh: true,
          })
        )
        .catch((e) => console.warn("[Auto-Crawl on Connect Error]:", e.message));

      return res.status(200).json({
        ok: true,
        message: "WordPress site paired successfully!",
        connection: connPayload,
      });
    }

    // ----------------------------------------------------------------
    // 4. DISCONNECT
    // ----------------------------------------------------------------
    if (action === "disconnect") {
      await supabase
        .from("agent_memory")
        .delete()
        .eq("email", userEmail)
        .in("memory_type", [memoryKey, "wordpress_connection"]);

      return res.status(200).json({ ok: true, message: "Website disconnected" });
    }

    // ----------------------------------------------------------------
    // Resolve Credentials from memory if not explicitly provided
    // ----------------------------------------------------------------
    let activeUrl = formatUrl(siteUrl);
    let activeKey = apiKey ? String(apiKey).trim() : null;

    if (!activeUrl || !activeKey) {
      const { data: mem } = await supabase
        .from("agent_memory")
        .select("content")
        .eq("email", userEmail)
        .in("memory_type", [memoryKey, "wordpress_connection"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (mem?.content) {
        try {
          const parsed = JSON.parse(mem.content);
          if (!activeUrl) activeUrl = parsed.siteUrl;
          if (!activeKey) activeKey = parsed.apiKey;
        } catch (e) {}
      }
    }

    if (!activeUrl || !activeKey) {
      return res.status(400).json({
        ok: false,
        error: "No active WordPress connection found for this business. Please connect in the dashboard.",
      });
    }

    // ----------------------------------------------------------------
    // 5. LIST CONTENT (Posts and Pages)
    // ----------------------------------------------------------------
    if (action === "list-content") {
      const queryParams = new URLSearchParams();
      if (type) queryParams.set("type", type);
      if (per_page) queryParams.set("per_page", per_page);

      const resp = await fetch(`${activeUrl}/wp-json/gabbarinfo/v1/list-content?${queryParams.toString()}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${activeKey}`,
        },
      });

      const data = await resp.json().catch(() => ({}));
      return res.status(resp.ok ? 200 : resp.status).json(data);
    }

    // ----------------------------------------------------------------
    // 5.5 GET SINGLE POST / PAGE (Full Content for Editor)
    // ----------------------------------------------------------------
    if (action === "get-post") {
      const postId = body.postId || req.query.postId;
      const postType = body.postType || "post";
      const targetUrl = body.url || req.query.url;

      let fetchedData = null;

      // 1. Try our enhanced plugin endpoint first
      try {
        const richResp = await fetch(`${activeUrl}/wp-json/gabbarinfo/v1/get-content?post_id=${postId}`, {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${activeKey}`,
          },
        });
        if (richResp.ok) {
          const richJson = await richResp.json();
          if (richJson.ok && richJson.id) {
            fetchedData = richJson;
          }
        }
      } catch (_) {}

      // 2. Fallback to standard WP REST API if needed
      if (!fetchedData) {
        const endpoint = postType === "page" ? `pages/${postId}` : `posts/${postId}`;
        try {
          const resp = await fetch(`${activeUrl}/wp-json/wp/v2/${endpoint}`, {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${activeKey}`,
            },
          });
          if (resp.ok) {
            const json = await resp.json();
            fetchedData = {
              id: json.id,
              title: json.title?.rendered || json.title || "",
              content: json.content?.rendered || json.content || "",
              db_content: json.content?.rendered || json.content || "",
              slug: json.slug || "",
              status: json.status || "publish",
              url: json.link || `${activeUrl}/${json.slug}/`,
              type: postType,
              is_agent_created: false,
              edit_count: 0,
              edits_remaining: 0,
              requires_credit: true,
            };
          }
        } catch (e) {
          console.warn("WP REST API get-post failed:", e.message);
        }
      }

      // 3. Universal Live Frontend Extraction (For ANY theme / page builder where live page differs from DB)
      if (fetchedData) {
        const liveUrl = fetchedData.url || targetUrl || `${activeUrl}/${fetchedData.slug}/`;
        if (postType === "page" || fetchedData.bypasses_db_content) {
          try {
            const pageResp = await fetch(liveUrl, {
              headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
              signal: AbortSignal.timeout(6000),
            });
            if (pageResp.ok) {
              const html = await pageResp.text();
              const mainMatch =
                html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
                html.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                html.match(/<(?:div|section)[^>]*(?:class|id)=["'][^"']*(?:entry-content|site-content|page-content|elementor|et_builder_inner_content|fl-builder-content|post-content|main-content|primary)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/i);

              if (mainMatch && mainMatch[1].trim().length > 100) {
                const extractedHtml = mainMatch[1].trim();
                fetchedData.live_content = extractedHtml;
                // Always supply live rendered frontend HTML so custom templates/page builders show what is actually live
                fetchedData.content = extractedHtml;
                fetchedData.is_live_extracted = true;
              }
            }
          } catch (fetchErr) {
            console.warn("Could not extract live page frontend HTML:", fetchErr.message);
          }
        }

        return res.status(200).json({ ok: true, post: fetchedData });
      } else {
        return res.status(404).json({ ok: false, error: "Post not found or could not load content" });
      }
    }

    // ----------------------------------------------------------------
    // 6. UPDATE CONTENT (Optimize Page or Post with Quota Ledger)
    // ----------------------------------------------------------------
    if (action === "update-content") {
      const payload = updateData || seoData || {};
      const isAgentCreated = Boolean(payload.is_agent_created);
      const editCount = Number(payload.edit_count) || 0;

      // Universal Rule: Agent-created content gets 2 free edits.
      // Pre-existing content (or agent content with >= 2 edits) consumes 1 SEO_ARTICLE credit.
      const requiresCredit = !isAgentCreated || editCount >= 2;
      let reservationId = null;

      if (requiresCredit) {
        const businessId = session?.user?.business_id || `biz_${normalizedBusiness}`;
        const quotaRes = await reserveQuota({
          session,
          userEmail,
          businessId,
          actionType: "SEO_ARTICLE",
          assetId: activeUrl,
        });

        if (!quotaRes.ok) {
          return res.status(quotaRes.status || 403).json({
            ok: false,
            code: quotaRes.code || "MONTHLY_QUOTA_EXHAUSTED",
            error: quotaRes.error || "Monthly published blog quota exhausted. Please upgrade your plan to edit existing pages or publish more articles.",
          });
        }
        reservationId = quotaRes.reservationId;
      }

      let resp;
      try {
        resp = await fetch(`${activeUrl}/wp-json/gabbarinfo/v1/update-content`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${activeKey}`,
          },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        if (reservationId) await releaseQuota(reservationId);
        return res.status(500).json({ ok: false, error: `WordPress connection error: ${e.message}` });
      }

      const data = await resp.json().catch(() => ({}));

      if (resp.ok && data.ok) {
        if (reservationId) {
          await commitQuota(reservationId);
        }
        return res.status(200).json({
          ...data,
          credit_deducted: requiresCredit,
          edits_remaining: isAgentCreated ? Math.max(0, 1 - editCount) : 0,
        });
      } else {
        if (reservationId) await releaseQuota(reservationId);
        return res.status(resp.status || 400).json(data);
      }
    }

    // ----------------------------------------------------------------
    // 7. CREATE POST / BLOG
    // ----------------------------------------------------------------
    if (action === "create-post") {
      const resp = await fetch(`${activeUrl}/wp-json/gabbarinfo/v1/create-post`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeKey}`,
        },
        body: JSON.stringify(postData || {}),
      });

      const data = await resp.json().catch(() => ({}));
      return res.status(resp.ok ? 200 : resp.status).json(data);
    }

    // ----------------------------------------------------------------
    // 8. REGENERATE KEY
    // ----------------------------------------------------------------
    if (action === "regenerate-key") {
      const resp = await fetch(`${activeUrl}/wp-json/gabbarinfo/v1/regenerate-key`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeKey}`,
        },
      });

      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data?.new_key) {
        // Update stored key in memory
        const { data: mem } = await supabase
          .from("agent_memory")
          .select("content")
          .eq("email", userEmail)
          .eq("memory_type", memoryKey)
          .single();

        if (mem?.content) {
          const parsed = JSON.parse(mem.content);
          parsed.apiKey = data.new_key;
          await supabase.from("agent_memory").update({
            content: JSON.stringify(parsed),
            updated_at: new Date().toISOString(),
          }).eq("email", userEmail).eq("memory_type", memoryKey);
        }
      }

      return res.status(resp.ok ? 200 : resp.status).json(data);
    }

    // ----------------------------------------------------------------
    // 9. SYNC TRACKING
    // ----------------------------------------------------------------
    if (action === "sync-tracking") {
      const resp = await fetch(`${activeUrl}/wp-json/gabbarinfo/v1/sync-tracking`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeKey}`,
        },
        body: JSON.stringify({
          google_tag_id: googleTagId,
          conversion_label: conversionLabel,
          meta_pixel_id: metaPixelId,
        }),
      });

      const data = await resp.json().catch(() => ({}));
      return res.status(resp.ok ? 200 : resp.status).json(data);
    }

    // ----------------------------------------------------------------
    // 10. GET AUTOPILOT CONFIG
    // ----------------------------------------------------------------
    if (action === "get-autopilot-config") {
      const autoMemoryKey = `wp_autopilot_${normalizedBusiness}`;
      let { data: autoMem } = await supabase
        .from("agent_memory")
        .select("content")
        .eq("email", userEmail)
        .eq("memory_type", autoMemoryKey)
        .maybeSingle();

      // Only fallback if no specific business was provided
      if (!autoMem?.content && (!businessName || normalizedBusiness === "default")) {
        const { data: anyAutoMem } = await supabase
          .from("agent_memory")
          .select("content")
          .eq("email", userEmail)
          .like("memory_type", "wp_autopilot_%")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (anyAutoMem?.content) {
          autoMem = anyAutoMem;
        }
      }

      if (autoMem?.content) {
        try {
          const cfg = JSON.parse(autoMem.content);
          cfg.targetLocations = cfg.targetLocations || cfg.targetMarket || "";
          return res.status(200).json({ ok: true, config: cfg });
        } catch (e) {}
      }

      // Check if paired Meta account exists before enabling social sharing by default
      let hasPairedMeta = false;
      try {
        const { data: pairMems } = await supabase
          .from("agent_memory")
          .select("content")
          .eq("email", userEmail)
          .in("memory_type", ["bundle_pairings", "brand_asset_pairings"])
          .maybeSingle();
        if (pairMems?.content) {
          const list = JSON.parse(pairMems.content);
          if (Array.isArray(list) && list.some((p) => p.pageId)) {
            hasPairedMeta = true;
          }
        }
      } catch (_) {}

      return res.status(200).json({
        ok: true,
        config: {
          enabled: false,
          cadence: "daily",
          customDaysPerWeek: 3,
          autoShareFacebook: hasPairedMeta,
          autoShareInstagram: hasPairedMeta,
          targetLocations: "",
          targetMarket: "",
        },
      });
    }

    // ----------------------------------------------------------------
    // 11. SAVE AUTOPILOT CONFIG
    // ----------------------------------------------------------------
    if (action === "save-autopilot-config") {
      // 🔒 Entitlement Gate: SEO feature must be permitted to enable or update Autopilot
      if (body.config?.enabled && session) {
        const ent = await verifyEntitlement(session, null, FEATURES.SEO);
        if (!ent.allowed) {
          return res.status(403).json({
            ok: false,
            error: ent.error || "SEO Autopilot service is restricted for your account. Please contact administrator.",
          });
        }
      }

      let targetBiz = normalizedBusiness;
      if (!businessName || normalizedBusiness === "default") {
        // Look up user's active connected site name
        const { data: connMems } = await supabase
          .from("agent_memory")
          .select("memory_type")
          .eq("email", userEmail)
          .like("memory_type", "wp_conn_%")
          .limit(1)
          .maybeSingle();
        if (connMems?.memory_type) {
          targetBiz = connMems.memory_type.replace("wp_conn_", "");
        }
      }
      const autoMemoryKey = `wp_autopilot_${targetBiz}`;
      const configPayload = body.config || {};
      configPayload.businessName = businessName || targetBiz || "default";
      configPayload.targetLocations = (configPayload.targetLocations || configPayload.targetMarket || "").trim();
      configPayload.targetMarket = configPayload.targetLocations;
      configPayload.updatedAt = new Date().toISOString();

      const { error: upsertErr } = await supabase
        .from("agent_memory")
        .upsert(
          {
            email: userEmail,
            memory_type: autoMemoryKey,
            content: JSON.stringify(configPayload),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "email,memory_type" }
        );

      if (upsertErr) {
        console.error("Failed to upsert autopilot config:", upsertErr);
        return res.status(500).json({ ok: false, error: upsertErr.message });
      }

      // Cross-sync targetLocations strictly to this business's scoped Social Autopilot memory
      if (configPayload.targetLocations && targetBiz && targetBiz !== "default") {
        try {
          const normEmail = userEmail.toLowerCase().trim();
          const socialMemoryKey = `social_autopilot_${normEmail}_${targetBiz}`;
          const { data: socialMem } = await supabase
            .from("agent_memory")
            .select("content")
            .eq("email", normEmail)
            .eq("memory_type", socialMemoryKey)
            .maybeSingle();
          let socialConfig = {};
          if (socialMem?.content) {
            try { socialConfig = JSON.parse(socialMem.content); } catch (_) {}
          }
          socialConfig.targetLocations = configPayload.targetLocations;
          socialConfig.targetMarket = configPayload.targetLocations;
          await supabase.from("agent_memory").upsert(
            {
              email: normEmail,
              memory_type: socialMemoryKey,
              content: JSON.stringify(socialConfig),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "email,memory_type" }
          );
        } catch (syncErr) {
          console.warn("Could not cross-sync targetLocations to scoped social autopilot:", syncErr.message);
        }
      }

      return res.status(200).json({ ok: true, config: configPayload, message: "Autopilot settings saved successfully" });
    }

    return res.status(400).json({ ok: false, error: `Unknown action: ${action}` });
  } catch (err) {
    console.error("WordPress sync error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
