// pages/api/wordpress/sync.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const userEmail = session?.user?.email || req.body?.userEmail;

  const {
    action = "health",
    siteUrl,
    apiKey,
    googleTagId,
    conversionLabel,
    metaPixelId,
    postData,
    seoData,
  } = req.body;

  if (!siteUrl) {
    return res.status(400).json({ ok: false, error: "Missing siteUrl" });
  }

  let cleanUrl = String(siteUrl).trim().replace(/\/+$/, "");
  if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
    cleanUrl = "https://" + cleanUrl;
  }

  try {
    if (action === "health") {
      const resp = await fetch(`${cleanUrl}/wp-json/gabbarinfo/v1/health`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const data = await resp.json();
      return res.status(200).json({ ok: resp.ok, status: resp.status, data });
    }

    if (action === "sync-tracking") {
      if (!apiKey) {
        return res.status(400).json({ ok: false, error: "Missing apiKey for pairing" });
      }

      const resp = await fetch(`${cleanUrl}/wp-json/gabbarinfo/v1/sync-tracking`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          google_tag_id: googleTagId,
          conversion_label: conversionLabel,
          meta_pixel_id: metaPixelId,
        }),
      });

      const data = await resp.json();

      if (resp.ok && userEmail) {
        // Save connected site in memory
        await supabase
          .from("agent_memory")
          .upsert(
            {
              email: userEmail,
              memory_type: "wordpress_connection",
              content: JSON.stringify({
                siteUrl: cleanUrl,
                apiKey,
                googleTagId,
                conversionLabel,
                metaPixelId,
                connected_at: new Date().toISOString(),
              }),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "email,memory_type" }
          );
      }

      return res.status(200).json({ ok: resp.ok, status: resp.status, data });
    }

    if (action === "create-post") {
      if (!apiKey) return res.status(400).json({ ok: false, error: "Missing apiKey" });
      const resp = await fetch(`${cleanUrl}/wp-json/gabbarinfo/v1/create-post`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(postData || {}),
      });
      const data = await resp.json();
      return res.status(200).json({ ok: resp.ok, data });
    }

    if (action === "update-seo") {
      if (!apiKey) return res.status(400).json({ ok: false, error: "Missing apiKey" });
      const resp = await fetch(`${cleanUrl}/wp-json/gabbarinfo/v1/update-seo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(seoData || {}),
      });
      const data = await resp.json();
      return res.status(200).json({ ok: resp.ok, data });
    }

    return res.status(400).json({ ok: false, error: `Unknown action: ${action}` });
  } catch (err) {
    console.error("WordPress sync error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
