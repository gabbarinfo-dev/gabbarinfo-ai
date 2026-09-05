// pages/api/wordpress/sync.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

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

      // Also support single target business lookup
      const activeConn = connections[normalizedBusiness] || connections["default"] || Object.values(connections)[0] || null;

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
    // 3. SAVE / CONNECT WORDPRESS WEBSITE
    // ----------------------------------------------------------------
    if (action === "save-connection") {
      if (!siteUrl || !apiKey) {
        return res.status(400).json({ ok: false, error: "Site URL and API Key are required" });
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
        businessName: businessName || "GABBARinfo",
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
      const endpoint = postType === "page" ? `pages/${postId}` : `posts/${postId}`;

      let fetchedData = null;
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
            slug: json.slug || "",
            status: json.status || "publish",
          };
        }
      } catch (e) {
        console.warn("WP REST API get-post failed:", e.message);
      }

      if (fetchedData) {
        return res.status(200).json({ ok: true, post: fetchedData });
      } else {
        return res.status(404).json({ ok: false, error: "Post not found or could not load content" });
      }
    }

    // ----------------------------------------------------------------
    // 6. UPDATE CONTENT (Optimize Page or Post)
    // ----------------------------------------------------------------
    if (action === "update-content") {
      const payload = updateData || seoData || {};
      const resp = await fetch(`${activeUrl}/wp-json/gabbarinfo/v1/update-content`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeKey}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await resp.json().catch(() => ({}));
      return res.status(resp.ok ? 200 : resp.status).json(data);
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

    return res.status(400).json({ ok: false, error: `Unknown action: ${action}` });
  } catch (err) {
    console.error("WordPress sync error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
