// pages/api/shopify/social-share.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import { executeFacebookPost } from "../../../lib/execute-facebook-post";
import { getMetaIdentity, checkBrandMatch } from "../../../lib/meta/brand-verifier";
import { ensureInstagramCompatibleJpeg } from "../../../lib/instagram-image-helper";

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
    // 1. Resolve Brand-Specific Meta Connection strictly
    const targetBrand = req.body?.businessName || req.body?.brandName;
    const [allBrandMemsRes, bundlePairMemRes] = await Promise.all([
      supabase
        .from("agent_memory")
        .select("memory_type, content")
        .eq("email", userEmail.toLowerCase())
        .like("memory_type", "meta_conn_%"),
      supabase
        .from("agent_memory")
        .select("content")
        .eq("email", userEmail.toLowerCase())
        .in("memory_type", ["bundle_pairings", "brand_asset_pairings"])
        .maybeSingle(),
    ]);

    const allBrands = [];
    (allBrandMemsRes.data || []).forEach((m) => {
      try {
        const parsed = JSON.parse(m.content);
        allBrands.push(parsed);
      } catch (_) {}
    });

    // Also include explicit pairings from bundle_pairings if present
    if (bundlePairMemRes.data?.content) {
      try {
        const pairList = JSON.parse(bundlePairMemRes.data.content);
        if (Array.isArray(pairList)) {
          pairList.forEach((p) => {
            if (p.pageId && !allBrands.some((b) => b.pageId === p.pageId)) {
              allBrands.push(p);
            }
          });
        }
      } catch (_) {}
    }

    // Try finding specific shopify connection
    let shopData = {};
    const reqShop = req.body?.shop || req.body?.shopHandle || req.body?.storeDomain;
    if (reqShop) {
      const normReqShop = String(reqShop).toLowerCase().replace(/[^a-z0-9]/g, "_");
      const { data: specificShopMem } = await supabase
        .from("agent_memory")
        .select("content")
        .eq("email", userEmail.toLowerCase())
        .eq("memory_type", `shopify_conn_${normReqShop}`)
        .maybeSingle();
      if (specificShopMem?.content) {
        try {
          shopData = typeof specificShopMem.content === "string" ? JSON.parse(specificShopMem.content) : specificShopMem.content;
        } catch (_) {}
      }
    }

    if (!shopData.shop && !shopData.domain) {
      const { data: shopMem } = await supabase
        .from("agent_memory")
        .select("content")
        .eq("email", userEmail.toLowerCase())
        .eq("memory_type", "shopify_connection")
        .maybeSingle();

      if (shopMem?.content) {
        try {
          shopData = typeof shopMem.content === "string" ? JSON.parse(shopMem.content) : shopMem.content;
        } catch (_) {}
      }
    }

    const storeDisplayName = shopData.name || shopData.shopName || targetBrand || "Shopify Store";
    const normStoreName = String(targetBrand || shopData.name || shopData.shopName || shopData.shop || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const normPostUrl = String(postUrl || "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    const normStoreDomain = String(shopData.domain || shopData.primary_domain || shopData.shop || "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");

    let brandMeta = allBrands.find((b) => {
      const bName = String(b.businessName || b.pageName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const bUrl = String(b.websiteUrl || b.website || "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
      const bIg = String(b.igUsername || "").toLowerCase().replace(/[^a-z0-9]/g, "");

      const urlMatches = bUrl && (normPostUrl.includes(bUrl) || normStoreDomain.includes(bUrl) || bUrl.includes(normStoreDomain));
      const nameMatches = bName && normStoreName && (bName.includes(normStoreName) || normStoreName.includes(bName));
      const igMatches = bIg && normStoreName && (bIg.includes(normStoreName) || normStoreName.includes(bIg));

      return urlMatches || nameMatches || igMatches;
    });

    const { data: defaultMeta } = await supabase
      .from("meta_connections")
      .select("fb_page_id, fb_page_access_token, fb_user_access_token, instagram_actor_id, ig_business_id")
      .eq("email", userEmail.toLowerCase())
      .maybeSingle();

    const pageId = brandMeta?.pageId || (allBrands.length === 0 ? defaultMeta?.fb_page_id?.split(",")[0]?.trim() : null);
    const pageToken = brandMeta?.pageToken || (allBrands.length === 0 ? (defaultMeta?.fb_page_access_token || defaultMeta?.fb_user_access_token) : null);
    const igId = brandMeta?.igId || (allBrands.length === 0 ? (defaultMeta?.instagram_actor_id || defaultMeta?.ig_business_id) : null);

    if (!pageId || !pageToken) {
      return res.status(200).json({
        ok: false,
        require_connect: true,
        message: `No connected Facebook Page found for ${storeDisplayName}. Please connect or pair Meta in Social Pilot.`,
      });
    }

    const results = {};
    const API_VERSION = "v21.0";

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
          // Guarantee 100% standard JPEG format without alpha transparency for Instagram
          const cleanIgImageUrl = await ensureInstagramCompatibleJpeg({
            imageUrl: featuredImageUrl,
            supabase,
            bucket: "instagram-creatives",
            logger: (msg) => console.log(`[Shopify Social Share] ${msg}`),
          });

          const igCaption = `${title ? `✨ ${title}\n\n` : ""}${caption ? `${caption}\n\n` : ""}🔗 Explore the full collection & guide: ${postUrl}\n\n${hashtags}`;

          // Step A: Create container
          const containerUrl = `https://graph.facebook.com/${API_VERSION}/${igId}/media`;
          const cParams = new URLSearchParams();
          cParams.append("image_url", cleanIgImageUrl);
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
      target: {
        pageName: brandMeta?.pageName || "Facebook Page",
        pageId,
        igUsername: brandMeta?.igUsername || null,
        igId,
      },
      error: errorMessage,
    });
  } catch (err) {
    console.error("Shopify social share error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
