// pages/api/wordpress/generate-blog.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

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
    businessName = "GABBARinfo",
    topic,
    targetMarket,
    city,
    targetKeywords = [],
    wordCount = 1200,
    brandVoice = "authoritative, engaging, and consultative",
    industry = "Digital Marketing",
    publishStatus = "publish",
    crossPostSocial = false,
  } = req.body;

  if (!topic) {
    return res.status(400).json({ ok: false, error: "Blog topic is required" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ ok: false, error: "OpenAI API key missing in environment" });
  }

  const openai = new OpenAI({ apiKey });

  try {
    // 1. Resolve WordPress Connection
    const normalizedBusiness = businessName.toLowerCase().trim().replace(/[^a-z0-9]/g, "_");
    const memoryKey = `wp_conn_${normalizedBusiness}`;

    const { data: mem } = await supabase
      .from("agent_memory")
      .select("content")
      .eq("email", userEmail)
      .in("memory_type", [memoryKey, "wordpress_connection"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (!mem?.content) {
      return res.status(400).json({
        ok: false,
        error: `No connected WordPress website found for "${businessName}". Please connect your website in the dashboard first.`,
      });
    }

    const conn = JSON.parse(mem.content);
    const siteUrl = conn.siteUrl;
    const wpApiKey = conn.apiKey;

    // 2. Fetch Client Profile Memory (Target Market / Location / Services)
    let businessLocation = (targetMarket || city || "").trim();
    let businessServices = "";
    try {
      const { data: clientMem } = await supabase
        .from("agent_memory")
        .select("content")
        .eq("email", userEmail)
        .eq("memory_type", "client")
        .maybeSingle();

      if (clientMem?.content) {
        const parsed = JSON.parse(clientMem.content);
        const answers = parsed?.business_answers?.[businessName] || parsed?.business_answers?.["default_business"] || parsed || {};
        if (!businessLocation) {
          businessLocation = answers.target_market || answers.location || answers.country || answers.city || "";
        }
        businessServices = answers.service || answers.services || "";
      }
    } catch (e) {
      console.warn("Could not load client location/service memory:", e.message);
    }
    if (!businessLocation) {
      businessLocation = "National & Global Commercial";
    }

    // 3. Fetch existing posts & pages for Anti-Duplication & Smart Internal Linking
    let existingContent = [];
    try {
      const listResp = await fetch(`${siteUrl}/wp-json/gabbarinfo/v1/list-content?per_page=30`, {
        method: "GET",
        headers: { Authorization: `Bearer ${wpApiKey}` },
      });
      const listData = await listResp.json();
      if (listData?.ok && Array.isArray(listData.items)) {
        existingContent = listData.items;
      }
    } catch (e) {
      console.warn("Could not pre-fetch existing content for internal linking:", e.message);
    }

    const existingLinksContext = existingContent
      .slice(0, 8)
      .map((item) => `- Title: "${item.title}" | URL: ${item.url}`)
      .join("\n");

    const keywordList = Array.isArray(targetKeywords)
      ? targetKeywords.filter(Boolean).join(", ")
      : String(targetKeywords || "").trim();

    const keywordStrategyDirective = keywordList.length > 0
      ? `Target Keywords to Embed: "${keywordList}". Weave these in organically across the title, H2s, introduction, body copy, and conclusion. Do not keyword-stuff; maintain natural readability and flow.`
      : `AUTONOMOUS KEYWORD DISCOVERY: The user did not provide manual keywords. You MUST act as an elite SEO keyword research engine: automatically identify, prioritize, and embed the top 3-5 high-volume, high-intent ranking keywords tailored specifically to "${businessName}", its target market scope ("${businessLocation}"), and its core offerings ("${businessServices || industry}"). Target commercial buyer and problem-solving search phrases that actual customers and decision-makers search for.`;

    // 4. Generate High-Ranking Blog Content & SEO Payload with GPT
    console.log(`[SEO Engine] Generating ${wordCount}-word article on "${topic}" for ${businessName}...`);

    const systemPrompt = `You are a world-class SEO content strategist and elite copywriter.
Generate a comprehensive, high-ranking, human-grade blog post optimized for Google SERP and reader conversion.
Rules:
1. Output MUST be valid JSON matching the exact schema specified.
2. Structure the HTML content with <h2>, <h3>, <p>, <ul>, <li>, and <strong> tags. DO NOT include <h1> or <html>/<body> wrappers.
3. Word count target: roughly ${wordCount} words.
4. Keyword Integration: ${keywordStrategyDirective}
5. Weave in 2-3 organic internal links using the following live pages from the user's site:
${existingLinksContext || "None available - write naturally without broken links"}
6. Include 1-2 authoritative external references (e.g. Google Search Central, Statista, Harvard Business Review, Wikipedia).
7. Generate an engaging Meta Title (under 60 characters) and high-CTR Meta Description (under 155 characters).
8. Generate visual image prompts for:
   - featured_image_prompt: A striking hero banner visual prompt.
   - mid_image_prompt: An informative mid-article infographic or conceptual visual prompt.`;

    const userPrompt = `Business Name: ${businessName}
Business Operating City / Location: ${businessLocation || "Local & Regional Market"}
Primary Services / Specialization: ${businessServices || industry}
Brand Voice: ${brandVoice}
Blog Topic: ${topic}
${keywordList ? `Target Keywords: ${keywordList}` : "Keywords: Automatically generate top-ranking city and service keywords"}
Target Word Count: ${wordCount}

Respond ONLY with a valid JSON object matching this schema:
{
  "title": "Compelling, high-ranking blog title",
  "slug": "keyword-rich-url-slug",
  "meta_title": "SEO Meta Title (max 60 chars)",
  "meta_description": "SEO Meta Description (max 155 chars)",
  "focus_keyword": "Primary target keyword (including city/service if local intent)",
  "secondary_keywords": ["ranked keyword 2", "ranked keyword 3", "ranked keyword 4"],
  "html_content": "Full article HTML with headings and paragraphs",
  "featured_image_prompt": "DALL-E prompt for the header hero banner",
  "featured_image_alt": "Descriptive SEO alt text for hero image",
  "mid_image_prompt": "DALL-E prompt for the mid-content visual",
  "mid_image_alt": "Descriptive SEO alt text for mid visual"
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const parsedArticle = JSON.parse(completion.choices[0].message.content);

    // 4. Generate Visual #1: Featured Hero Banner
    let featuredImageUrl = null;
    let midImageUrl = null;

    try {
      console.log(`[SEO Engine] Generating Featured Hero Banner image...`);
      const img1Resp = await openai.images.generate({
        model: "dall-e-3",
        prompt: `Commercial editorial advertising photograph or 3D graphic banner for a blog article titled "${parsedArticle.title}". ${parsedArticle.featured_image_prompt}. Ultra-clean, modern, vibrant lighting, 4K quality, no generic stock text.`,
        size: "1024x1024",
      });

      if (img1Resp.data?.[0]?.url) {
        // Download and upload to Supabase storage
        const fetchRes = await fetch(img1Resp.data[0].url);
        const buf = Buffer.from(await fetchRes.arrayBuffer());
        const fileName = `blog_featured_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from("instagram-creatives")
          .upload(fileName, buf, { contentType: "image/png" });

        if (!uploadErr && uploadData) {
          const { data: pubUrl } = supabase.storage.from("instagram-creatives").getPublicUrl(fileName);
          featuredImageUrl = pubUrl.publicUrl;
        } else {
          featuredImageUrl = img1Resp.data[0].url;
        }
      }
    } catch (imgErr) {
      console.warn("Featured image generation fallback:", imgErr.message);
    }

    // 5. Generate Visual #2: Mid-Article Conceptual Visual
    try {
      console.log(`[SEO Engine] Generating Mid-Article Visual...`);
      const img2Resp = await openai.images.generate({
        model: "dall-e-3",
        prompt: `Infographic style modern visual illustration explaining "${parsedArticle.title}". ${parsedArticle.mid_image_prompt}. Clean geometric layout, soft shadows, vibrant accents, professional design.`,
        size: "1024x1024",
      });

      if (img2Resp.data?.[0]?.url) {
        const fetchRes = await fetch(img2Resp.data[0].url);
        const buf = Buffer.from(await fetchRes.arrayBuffer());
        const fileName = `blog_mid_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from("instagram-creatives")
          .upload(fileName, buf, { contentType: "image/png" });

        if (!uploadErr && uploadData) {
          const { data: pubUrl } = supabase.storage.from("instagram-creatives").getPublicUrl(fileName);
          midImageUrl = pubUrl.publicUrl;
        } else {
          midImageUrl = img2Resp.data[0].url;
        }
      }
    } catch (img2Err) {
      console.warn("Mid image generation fallback:", img2Err.message);
    }

    // 6. Push Live Article to WordPress via Plugin
    console.log(`[SEO Engine] Pushing article to WordPress: ${siteUrl}/wp-json/gabbarinfo/v1/create-post`);
    const wpPublishPayload = {
      title: parsedArticle.title,
      content: parsedArticle.html_content,
      slug: parsedArticle.slug,
      status: publishStatus,
      post_type: "post",
      featured_image_url: featuredImageUrl,
      featured_image_alt: parsedArticle.featured_image_alt || parsedArticle.title,
      mid_image_url: midImageUrl,
      mid_image_alt: parsedArticle.mid_image_alt || parsedArticle.title,
      meta_title: parsedArticle.meta_title,
      meta_description: parsedArticle.meta_description,
      focus_keyword: parsedArticle.focus_keyword,
    };

    const wpPostResp = await fetch(`${siteUrl}/wp-json/gabbarinfo/v1/create-post`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${wpApiKey}`,
      },
      body: JSON.stringify(wpPublishPayload),
    });

    const wpResult = await wpPostResp.json();

    if (!wpPostResp.ok || !wpResult?.ok) {
      console.error("WordPress publish error:", wpResult);
      return res.status(500).json({
        ok: false,
        error: wpResult?.message || "Failed to publish article on WordPress site.",
      });
    }

    console.log(`[SEO Engine] Successfully published! Post ID: ${wpResult.post_id}, URL: ${wpResult.post_url}`);

    return res.status(200).json({
      ok: true,
      post_id: wpResult.post_id,
      post_url: wpResult.post_url,
      title: parsedArticle.title,
      slug: parsedArticle.slug,
      meta_title: parsedArticle.meta_title,
      meta_description: parsedArticle.meta_description,
      focus_keyword: parsedArticle.focus_keyword,
      featured_image: featuredImageUrl,
      mid_image: midImageUrl,
      status: wpResult.status,
      siteUrl,
    });
  } catch (err) {
    console.error("Generate blog error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
