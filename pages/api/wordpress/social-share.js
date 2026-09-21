// pages/api/wordpress/social-share.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import { executeFacebookPost } from "../../../lib/execute-facebook-post";

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
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const {
    platform = "facebook", // "facebook" | "instagram" | "both"
    businessName,
    pageId: explicitPageId,
    title,
    postUrl,
    featuredImageUrl,
    caption,
    hashtags = "#DigitalMarketing #SEO #BusinessGrowth #GABBARinfo",
  } = req.body;

  if (!postUrl) {
    return res.status(400).json({ ok: false, error: "Blog post URL is required" });
  }

  try {
    // 1. Resolve Brand-Specific Meta Connection strictly
    let brandMeta = null;
    const { data: allBrandMems } = await supabase
      .from("agent_memory")
      .select("memory_type, content")
      .eq("email", userEmail.toLowerCase())
      .like("memory_type", "meta_conn_%");

    const allBrands = [];
    (allBrandMems || []).forEach((m) => {
      try {
        const parsed = JSON.parse(m.content);
        allBrands.push(parsed);
      } catch (_) {}
    });

    if (businessName) {
      const normBiz = String(businessName).toLowerCase().trim().replace(/[^a-z0-9]/g, "");
      // Match by exact websiteUrl or by business name
      brandMeta = allBrands.find((b) => {
        const bName = String(b.businessName || b.pageName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const bUrl = String(b.websiteUrl || "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
        return (normBiz && bName && (normBiz === bName || normBiz.includes(bName) || bName.includes(normBiz))) ||
               (postUrl && bUrl && postUrl.toLowerCase().includes(bUrl));
      });
    } else if (postUrl) {
      brandMeta = allBrands.find((b) => {
        const bUrl = String(b.websiteUrl || "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
        return bUrl && postUrl.toLowerCase().includes(bUrl);
      });
    }

    // If still not matched, check if explicitPageId was provided and find that page
    if (!brandMeta && explicitPageId) {
      brandMeta = allBrands.find((b) => String(b.pageId) === String(explicitPageId));
    }

    // Strict Isolation: If this website has no paired brand, DO NOT cross-post to an unrelated brand!
    if (businessName && !brandMeta && !explicitPageId) {
      return res.status(200).json({
        ok: false,
        require_connect: true,
        message: `No connected Facebook Page is paired with ${businessName}. Please connect and pair social assets in Social Pilot.`,
      });
    }

    const { data: defaultMeta } = await supabase
      .from("meta_connections")
      .select("fb_page_id, fb_page_access_token, fb_user_access_token, instagram_actor_id, ig_business_id")
      .eq("email", userEmail.toLowerCase())
      .maybeSingle();

    const pageId = explicitPageId || brandMeta?.pageId || (allBrands.length === 0 ? defaultMeta?.fb_page_id?.split(",")[0]?.trim() : null);
    const pageToken = brandMeta?.pageToken || (allBrands.length === 0 ? (defaultMeta?.fb_page_access_token || defaultMeta?.fb_user_access_token) : null);
    const igId = brandMeta?.igId || (allBrands.length === 0 ? (defaultMeta?.instagram_actor_id || defaultMeta?.ig_business_id) : null);

    if (!pageId || !pageToken) {
      return res.status(200).json({
        ok: false,
        require_connect: true,
        message: `No connected Facebook Page found for ${businessName || "this website"}. Please connect Facebook in Social Pilot.`,
      });
    }

    const results = {};
    const API_VERSION = "v21.0";

    // 2. Share to Facebook Page (Link Preview Post)
    if (platform === "facebook" || platform === "both") {
      try {
        if (!pageId) {
          throw new Error("No Facebook Page linked to your account.");
        }

        const fullMessage = `${title ? `📢 ${title}\n\n` : ""}${caption ? `${caption}\n\n` : ""}Read full article here 👇\n${postUrl}\n\n${hashtags}`;

        // Attempt official Link Post to /{page_id}/feed for interactive click-through card
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
          // Fallback to Photo post if feed link posting has page permission restriction
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
        results.instagram = { ok: false, error: "No connected Instagram business account found. Ensure your Instagram account is linked to your Facebook Page in Meta Business Suite." };
      } else if (!featuredImageUrl) {
        results.instagram = { ok: false, error: "Instagram requires an image to publish a post." };
      } else {
        try {
          const igCaption = `${title ? `✨ ${title}\n\n` : ""}${caption ? `${caption}\n\n` : ""}🔗 Read the complete guide on our website: ${postUrl}\n\n${hashtags}`;

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
      target: {
        pageName: brandMeta?.pageName || "Facebook Page",
        pageId,
        igUsername: brandMeta?.igUsername || null,
        igId,
      },
      error: errorMessage,
    });
  } catch (err) {
    console.error("Social share error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
