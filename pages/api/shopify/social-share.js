// pages/api/shopify/social-share.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import { executeFacebookPost } from "../../../lib/execute-facebook-post";
import { getMetaIdentity, checkBrandMatch } from "../../../lib/meta/brand-verifier";

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

  if (!userEmail) {
    return res.status(401).json({ ok: false, error: "Unauthorized: Please log in" });
  }

  const {
    platform = "facebook", // "facebook" | "instagram" | "both"
    title,
    postUrl,
    featuredImageUrl,
    caption,
    hashtags = "#eCommerce #Shopify #OnlineShopping #TrendingStyles",
  } = req.body;

  if (!postUrl) {
    return res.status(400).json({ ok: false, error: "Blog post URL is required" });
  }

  try {
    // 1. Check Meta Connection for this user
    const { data: meta, error: metaErr } = await supabase
      .from("meta_connections")
      .select("fb_page_id, fb_page_access_token, fb_user_access_token, instagram_actor_id, ig_business_id")
      .eq("email", userEmail.toLowerCase())
      .single();

    if (!meta || (!meta.fb_user_access_token && !meta.fb_page_access_token)) {
      return res.status(200).json({
        ok: false,
        require_connect: true,
        message: "Your Meta (Facebook/Instagram) account is not connected yet. Please connect Meta in the Social Pilot tab to enable 1-click social sharing.",
      });
    }

    // 1.5 Anti-Exploitation & Brand Identity Verification
    const { data: shopMem } = await supabase
      .from("agent_memory")
      .select("content")
      .eq("email", userEmail.toLowerCase())
      .eq("memory_type", "shopify_connection")
      .maybeSingle();

    let shopData = {};
    if (shopMem?.content) {
      try {
        shopData = typeof shopMem.content === "string" ? JSON.parse(shopMem.content) : shopMem.content;
      } catch (_) {}
    }

    const metaIdentity = await getMetaIdentity(meta);
    const brandCheck = checkBrandMatch({
      storeName: shopData.name || "Shopify Store",
      storeDomain: shopData.domain || shopData.shop,
      shopHandle: shopData.shop,
      metaIdentity,
    });

    if (!brandCheck.isMatched) {
      return res.status(403).json({
        ok: false,
        brandMismatch: true,
        brandSecurity: brandCheck,
        error: brandCheck.reason || "Anti-Exploitation Block: The connected social channel belongs to a different business. Cross-brand posting is prohibited to preserve audience trust and prevent multi-tenant abuse.",
      });
    }

    const results = {};
    const API_VERSION = "v21.0";
    const pageId = meta.fb_page_id ? meta.fb_page_id.split(",")[0].trim() : null;
    const pageToken = meta.fb_page_access_token || meta.fb_user_access_token;

    // 2. Share to Facebook Page (Interactive Link Preview Post or Photo)
    if (platform === "facebook" || platform === "both") {
      try {
        if (!pageId) {
          throw new Error("No Facebook Page linked to your account.");
        }

        const fullMessage = `${title ? `📢 ${title}\n\n` : ""}${caption ? `${caption}\n\n` : ""}Read full article here 👇\n${postUrl}\n\n${hashtags}`;

        const feedUrl = `https://graph.facebook.com/${API_VERSION}/${pageId}/feed`;
        const feedParams = new URLSearchParams();
        feedParams.append("link", postUrl);
        feedParams.append("message", fullMessage);
        feedParams.append("access_token", pageToken);

        const feedRes = await fetch(feedUrl, { method: "POST", body: feedParams });
        const feedJson = await feedRes.json();

        if (feedRes.ok && feedJson?.id) {
          results.facebook = { ok: true, id: feedJson.id, type: "link_preview" };
        } else {
          console.warn("Facebook Feed link post fallback to photo post:", feedJson?.error?.message);
          const fbRes = await executeFacebookPost({
            userEmail,
            imageUrl: featuredImageUrl,
            caption: fullMessage,
            targetPlatform: "facebook",
          });
          results.facebook = { ok: true, id: fbRes?.id, type: "photo" };
        }
      } catch (fbErr) {
        console.error("Facebook share error:", fbErr.message);
        results.facebook = { ok: false, error: fbErr.message };
      }
    }

    // 3. Share to Instagram (Image Post with Status Polling)
    if (platform === "instagram" || platform === "both") {
      const igId = meta.instagram_actor_id || meta.ig_business_id;
      if (!igId) {
        results.instagram = {
          ok: false,
          error: "No connected Instagram business account found. Ensure your Instagram account is linked to your Facebook Page in Meta Business Suite.",
        };
      } else if (!featuredImageUrl) {
        results.instagram = {
          ok: false,
          error: "Instagram requires a featured image to publish a post.",
        };
      } else {
        try {
          const igCaption = `${title ? `✨ ${title}\n\n` : ""}${caption ? `${caption}\n\n` : ""}🔗 Explore the full collection & guide: ${postUrl}\n\n${hashtags}`;

          // Step A: Create container
          const containerUrl = `https://graph.facebook.com/${API_VERSION}/${igId}/media`;
          const cParams = new URLSearchParams();
          cParams.append("image_url", featuredImageUrl);
          cParams.append("caption", igCaption);
          cParams.append("access_token", pageToken);

          const cRes = await fetch(containerUrl, { method: "POST", body: cParams });
          const cJson = await cRes.json();

          if (!cRes.ok || !cJson?.id) {
            throw new Error(cJson.error?.message || "Failed to create Instagram container");
          }

          const creationId = cJson.id;

          // Step B: Poll Instagram container status until FINISHED (up to 30s)
          let isReady = false;
          for (let attempt = 0; attempt < 12; attempt++) {
            await new Promise((r) => setTimeout(r, 2500));
            const statusRes = await fetch(
              `https://graph.facebook.com/${API_VERSION}/${creationId}?fields=status_code,status&access_token=${pageToken}`
            );
            const statusJson = await statusRes.json();
            if (statusJson.status_code === "FINISHED") {
              isReady = true;
              break;
            }
            if (statusJson.status_code === "ERROR") {
              throw new Error("Instagram media processing error: " + (statusJson.status || "Invalid image"));
            }
          }

          if (!isReady) {
            throw new Error("Instagram media processing timed out. Please try again in a few moments.");
          }

          // Step C: Publish container
          const publishUrl = `https://graph.facebook.com/${API_VERSION}/${igId}/media_publish`;
          const pParams = new URLSearchParams();
          pParams.append("creation_id", creationId);
          pParams.append("access_token", pageToken);

          const pRes = await fetch(publishUrl, { method: "POST", body: pParams });
          const pJson = await pRes.json();

          if (!pRes.ok || !pJson?.id) {
            throw new Error(pJson.error?.message || "Failed to publish Instagram post");
          }

          results.instagram = { ok: true, id: pJson.id };
        } catch (igErr) {
          console.error("Instagram share error:", igErr.message);
          results.instagram = { ok: false, error: igErr.message };
        }
      }
    }

    const platformSuccess = platform === "both"
      ? (results.facebook?.ok || results.instagram?.ok)
      : !!results[platform]?.ok;

    const errorMessage = !platformSuccess
      ? (results[platform]?.error || "Social share failed. Please verify page permissions.")
      : null;

    return res.status(platformSuccess ? 200 : 400).json({
      ok: platformSuccess,
      results,
      error: errorMessage,
    });
  } catch (err) {
    console.error("Shopify social share error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
