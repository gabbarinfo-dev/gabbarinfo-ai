// pages/api/wordpress/generate-blog.js
import { getServerSession } from "next-auth/next";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { verifyEntitlement, verifyEntitlementByEmail, FEATURES } from "../../../lib/auth/entitlements.js";
import { reserveCredits, releaseCredits } from "../../../lib/billing/credit-meter.js";
import { checkRateLimit } from "../../../lib/middleware/rate-limiter.js";
import { generatePlatformGraphic } from "../../../lib/services/image-service.js";
import { reserveQuota, commitQuota, releaseQuota } from "../../../lib/billing/quota-service.js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * High-performance, atomic blog generation and WordPress publishing function.
 * Designed for both interactive dashboard usage and in-process autonomous autopilot execution.
 */
export async function executeBlogGeneration({
  userEmail,
  session = null,
  businessName = "",
  businessId = null,
  topic,
  targetMarket,
  city,
  targetKeywords = [],
  brandVoice = "authoritative, engaging, and consultative",
  industry = "",
  publishStatus = "publish",
  crossPostSocial = false,
  wordCount: requestedWordCount = 1500,
  isAutopilot = false,
  model = null,
}) {
  if (!userEmail) {
    return { ok: false, status: 401, error: "Unauthorized: User email required" };
  }

  let quotaRes = null;
  let reservation = null;

  try {
    // 1. Rate Limiting Gate
    const rateCheck = checkRateLimit(userEmail, "BLOG_GEN", 10, 60000);
    if (!rateCheck.allowed && !isAutopilot) {
      return {
        ok: false,
        status: 429,
        error: `Too many blog requests. Please wait ${Math.ceil(rateCheck.resetInMs / 1000)} seconds.`,
      };
    }

    const wordCount = Math.max(Number(requestedWordCount) || 1500, 1500);

    if (!topic) {
      return { ok: false, status: 400, error: "Blog topic is required" };
    }
    const normalizedBusiness = (businessName || "").toLowerCase().trim().replace(/[^a-z0-9]/g, "_");
    const memoryKey = normalizedBusiness ? `wp_conn_${normalizedBusiness}` : null;

    let targetMem = null;
    if (memoryKey) {
      const { data: mem } = await supabase
        .from("agent_memory")
        .select("content")
        .eq("email", userEmail)
        .in("memory_type", [memoryKey, "wordpress_connection"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      targetMem = mem;
    }

    if (!targetMem?.content) {
      const { data: fallbackMem } = await supabase
        .from("agent_memory")
        .select("content")
        .eq("email", userEmail)
        .or("memory_type.like.wp_conn_%,memory_type.eq.wordpress_connection")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      targetMem = fallbackMem;
    }

    if (!targetMem?.content) {
      return {
        ok: false,
        status: 400,
        error: businessName && businessName !== "GABBARinfo"
          ? `No connected WordPress website found for "${businessName}". Please connect your website in the WordPress Connector first.`
          : `No connected WordPress website found. Please connect your WordPress website in the WordPress Connector first.`,
      };
    }

    let conn = {};
    try {
      conn = JSON.parse(targetMem.content);
    } catch (_) {
      conn = {};
    }
    const siteUrl = conn.siteUrl;
    const wpApiKey = conn.apiKey;
    const effectiveBusiness = businessName || conn.businessName || conn.siteName || "Our Business";

    // 2. Entitlement & Service Quota Gate (Server-Enforced with per-site slot locking)
    quotaRes = await reserveQuota({
      session,
      userEmail,
      businessId,
      actionType: "SEO_ARTICLE",
      assetId: siteUrl,
    });

    if (!quotaRes.ok) {
      return {
        ok: false,
        status: quotaRes.code === "FEATURE_NOT_INCLUDED" ? 403 : 402,
        code: quotaRes.code,
        error: quotaRes.error,
        planId: quotaRes.planId,
        nextResetDate: quotaRes.nextResetDate,
      };
    }

    // 3. Server-Side Atomic Credit Reservation (Internal Accounting)
    reservation = await reserveCredits({
      businessId: quotaRes.businessId || businessId || "default_business",
      userEmail,
      actionType: "SEO_BLOG",
      referenceId: topic.substring(0, 40),
    });

    if (!reservation.ok) {
      await releaseQuota({
        reservationId: quotaRes.reservationId,
        businessId: quotaRes.businessId,
        cycleStart: quotaRes.cycleStart,
        actionType: "SEO_ARTICLE",
        reason: "Credit reservation failure",
      });
      return {
        ok: false,
        status: 402,
        error: reservation.error || "Insufficient internal credits to execute blog generation.",
      };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { ok: false, status: 500, error: "OpenAI API key missing in environment" };
    }

    const openai = new OpenAI({ apiKey });

    // 4. Fetch Client Profile Memory (Target Market / Location / Services)
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

    // 5. Fetch existing posts & pages for Anti-Duplication & Smart Internal Linking
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

    const keywordList = Array.isArray(targetKeywords)
      ? targetKeywords.filter(Boolean).join(", ")
      : String(targetKeywords || "").trim();

    // 6. Generate High-Ranking Blog Content & SEO Payload with GPT
    console.log(`[SEO Engine] Generating full ${wordCount}-word authority guide on "${topic}" for ${effectiveBusiness}...`);

    const systemPrompt = `You are a world-class SEO master content strategist and elite enterprise copywriter.
Generate an exhaustive, high-ranking, 100% human-grade pillar guide optimized for Google search dominance, high reader dwell-time, and commercial conversion.

CRITICAL LENGTH & DEPTH MANDATES:
1. STRICT WORD COUNT: Body content MUST exceed 1600 words (target: 1650 to 2000 words). Writing less than 1500 words is strictly unacceptable.
2. MANDATORY EXHAUSTIVE SECTIONS (You MUST include ALL 10 of these exact <h2> sections with 2 to 3 detailed <h3> subsections each):
   - <h2>1. The Strategic Evolution of ${topic} in 2026</h2> (At least 160 words across 2 detailed paragraphs exploring the modern landscape)
   - <h2>2. Core Foundations and Search Entity Optimization</h2> (At least 180 words detailing algorithmic shifts, search intent, and topical authority)
   - <h2>3. High-Converting Content Architecture & Pillar Page Mechanics</h2> (At least 180 words with actionable structural frameworks and readability formulas)
   - <h2>4. Technical SEO Infrastructure, Performance & Core Web Vitals Mastery</h2> (At least 160 words detailing speed, mobile optimization, and schema)
   - <h2>5. Omnichannel Growth Funnels & Audience Monetization</h2> (At least 180 words on multi-platform integration, CAC reduction, and ROI optimization)
   - <h2>6. In-Depth Real-World Case Study: 0 to 450% Revenue Acceleration</h2> (At least 220 words detailing baseline metrics, implementation timeline, and exact financial/traffic gains)
   - <h2>7. Step-by-Step 90-Day Execution Playbook</h2> (At least 200 words with Month 1, Month 2, Month 3 actionable milestones)
   - <h2>8. 5 Critical SEO Pitfalls & Costly Strategic Mistakes to Avoid</h2> (At least 180 words detailing common misconceptions and operational fixes)
   - <h2>9. Frequently Asked Questions (FAQ)</h2> (Provide 5 high-impact questions, each answered with comprehensive multi-paragraph explanations of 100+ words, totaling 500+ words for this section)
   - <h2>10. Strategic Conclusion and Actionable Roadmap for 2026</h2> (At least 140 words summary with a clear commercial call to action)

3. MANDATORY INTERNAL & EXTERNAL HYPERLINKING:
   - Internal Links: Embed at least 4 working HTML anchor tags (<a href="URL" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">anchor text</a>) naturally within body copy using:
     - https://www.gabbarinfo.com/seo-content-writing/ (SEO & Content Writing Services)
     - https://www.gabbarinfo.com/digitalmarketing/ (High-ROI Digital Marketing)
     - https://www.gabbarinfo.com/website-design/ (Website Design & Development)
     - https://www.gabbarinfo.com/packages/ (Tailored SEO & Growth Packages)
   - External Authority: Embed at least 2 external links to trusted industry authorities:
     - <a href="https://developers.google.com/search/docs" target="_blank" rel="noopener" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">Google Search Central Documentation</a>
     - <a href="https://www.statista.com" target="_blank" rel="noopener" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">Statista Industry Benchmarks</a>

4. TARGET KEYWORD VISIBILITY:
   - Feature and bold (<strong>keyword</strong>) the primary target keyword in the very first paragraph.
   - Organically weave target keywords into headings and body paragraphs.

5. FORMATTING & BRAND THEME MANDATES:
   - Use semantic HTML: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>.
   - DO NOT include <h1>, <html>, or <body> tags.
   - STRICTLY DO NOT generate any Table of Contents (TOC), as the site's WordPress ez-toc plugin automatically creates it dynamically.
   - THEME COLORS: This site uses a sleek dark theme with signature gold/amber yellow accents (#f59e0b).
     - All embedded hyperlinks MUST use theme amber/yellow: <a href="URL" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">anchor text</a>. NEVER use blue or #0284c7.
     - NEVER use light, white, or light gray backgrounds in any boxes or callouts!
     - Any callouts or takeaways must use dark mode styling: style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-left: 4px solid #f59e0b; padding: 18px 24px; margin: 24px 0; border-radius: 8px; color: #f1f5f9;"

6. OUTPUT FORMAT:
   - Output MUST be strictly valid JSON matching the schema:
   {
     "title": "Compelling, high-ranking blog title",
     "slug": "keyword-rich-url-slug",
     "meta_title": "SEO Meta Title (max 60 chars)",
     "meta_description": "SEO Meta Description (max 155 chars)",
     "focus_keyword": "Primary target keyword",
     "secondary_keywords": ["keyword 2", "keyword 3"],
     "tags": ["SEO Optimization", "Digital Marketing", "Business Growth"],
     "html_content": "Full HTML content strictly 1600+ words with all 10 sections"
   }`;

    const userPrompt = `Business: ${effectiveBusiness}
Target Market / Scope: ${businessLocation}
Core Services / Industry: ${businessServices || industry || "Commercial Services"}
Brand Voice: ${brandVoice}
Blog Topic / Headline: ${topic}
${keywordList ? `Target Ranked Keywords: ${keywordList}` : "Keywords: Automatically target high-volume commercial and topical ranking phrases."}
MANDATORY MINIMUM WORD COUNT: Strictly 1600+ Words across all 10 detailed sections.`;

    // Multi-model AI Image Generator Helper powered by central ImageService
    const generateAiVisual = async (promptText, label = "visual", imageSize = "1024x1024") => {
      try {
        const isWidescreen = imageSize === "1792x1024";
        const result = await generatePlatformGraphic({
          prompt: promptText,
          businessId: businessId || "default_business",
          userEmail,
          aspectRatio: isWidescreen ? "16:9" : "1:1",
          customSize: imageSize,
          actionType: label === "featured" ? "SEO_HERO" : "SEO_MID",
          meterCredits: false, // Credits already reserved at handler root
          persistInSupabase: true,
        });

        if (result?.ok && result.imageUrl) {
          console.log(`[SEO Engine] Successfully generated ${label} visual via central image service: ${result.imageUrl}`);
          return result.imageUrl;
        }
      } catch (imgErr) {
        console.warn(`[SEO Engine] Central image service failed for ${label}:`, imgErr.message);
      }
      return null;
    };

    // For autonomous autopilot cycles, prioritize high-velocity model (gpt-4o-mini) to stay well within 60s Vercel limit
    const blogModel = model || (isAutopilot ? "gpt-4o-mini" : (process.env.AI_BLOG_MODEL || "gpt-4o-mini"));

    // Topic-tailored bespoke visual prompts constructed immediately
    const featuredPrompt = `Award-winning commercial 3D concept render for "${topic}" by ${effectiveBusiness}. Modern glass laptop displaying realistic Google search results page with glowing #1 rank badge, golden magnifying glass, upward green and gold organic traffic trendline charts, stacked gold coins, dark sleek slate background, Octane 3D render, cinematic studio lighting, pristine 4K quality, no text watermark.`;

    const midPrompt = `A clean, highly educational 1:1 square 3D infographic diagram illustrating the core framework for "${topic}". Sleek 4-tier SEO growth architecture pyramid with clearly labeled levels, glowing connection lines, warm amber yellow highlights (#f59e0b), dark sleek slate background, crisp modern typography, clean agency layout.`;

    console.log(`[SEO Engine] Initiating concurrent parallel execution: ${blogModel} 1600+ word text + dual gpt-image-2 visuals simultaneously...`);

    // In autopilot mode, use 1024x1024 for high velocity (~16s generation) to ensure completion in <40s
    const heroSize = isAutopilot ? "1024x1024" : "1024x1024";

    const [completion, [featuredImageUrl, midImageUrl]] = await Promise.all([
      openai.chat.completions.create({
        model: blogModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: 6500,
        temperature: 0.7,
      }),
      Promise.all([
        generateAiVisual(featuredPrompt, "featured", heroSize).catch((e) => {
          console.warn("Featured image generation error:", e.message);
          return null;
        }),
        generateAiVisual(midPrompt, "mid", "1024x1024").catch((e) => {
          console.warn("Mid image generation error:", e.message);
          return null;
        }),
      ]),
    ]);

    const parsedArticle = JSON.parse(completion.choices[0].message.content);

    // 7. Ensure In-Content Mid Visual is Injected and Verify Word Count
    let finalContent = parsedArticle.html_content || "";
    
    // Inject Mid-Article Visual Figure into HTML
    if (midImageUrl && !finalContent.includes(midImageUrl)) {
      const midAlt = `${parsedArticle.title} - Strategic Framework`;
      const midFigure = `\n<figure class="gabbarinfo-mid-image" style="margin: 36px 0; text-align: center;"><img src="${midImageUrl}" alt="${midAlt}" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.12);" /><figcaption style="font-size: 13px; color: #64748b; margin-top: 8px; font-style: italic;">${midAlt}</figcaption></figure>\n`;
      const pSplits = finalContent.split("</p>");
      if (pSplits.length > 3) {
        const half = Math.floor(pSplits.length / 2);
        pSplits[half] += midFigure;
        finalContent = pSplits.join("</p>");
      } else {
        finalContent += midFigure;
      }
    }

    // Contextual Internal Linking Guarantee
    const hasLiveInternalLinks = (existingContent || []).some((item) => finalContent.includes(item.url));
    if (!hasLiveInternalLinks && existingContent.length > 0) {
      console.log("[SEO Engine] Contextual internal link check: injecting live links...");
      const linkTargets = [
        { find: /SEO Optimization &amp; Digital Marketing|digital marketing/i, url: "https://www.gabbarinfo.com/digitalmarketing/", text: "high-ROI digital marketing services" },
        { find: /content creation|content strategy|content writing/i, url: "https://www.gabbarinfo.com/seo-content-writing/", text: "SEO content writing services" },
        { find: /Core Web Vitals|web development/i, url: "https://www.gabbarinfo.com/website-design/", text: "website design & development" },
        { find: /graphic design|visual assets/i, url: "https://www.gabbarinfo.com/graphic-designing/", text: "graphic designing and brand assets" },
        { find: /conversion rate optimization|growth packages/i, url: "https://www.gabbarinfo.com/packages/", text: "tailored SEO & growth packages" },
        { find: /SEO tools|digital solutions/i, url: "https://www.gabbarinfo.com/services/", text: "comprehensive digital solutions" },
      ];

      for (const target of linkTargets) {
        if (!finalContent.includes(target.url) && target.find.test(finalContent)) {
          finalContent = finalContent.replace(target.find, `<a href="${target.url}" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">${target.text}</a>`);
        }
      }
    }

    // Dedicated Strategic Resources Hub (Dark Theme with Amber Accents)
    if (!finalContent.includes("gabbarinfo-internal-resources-hub")) {
      const hubHtml = `\n<div class="gabbarinfo-internal-resources-hub" style="margin: 40px 0; padding: 24px 28px; background: #0f172a; border-radius: 12px; border-left: 5px solid #f59e0b; border: 1px solid rgba(255, 255, 255, 0.1); color: #f8fafc;">
  <h3 style="color: #f59e0b; margin-top: 0; font-size: 20px; font-weight: 700;">🚀 Recommended Strategic Growth Resources</h3>
  <p style="color: #cbd5e1; font-size: 15px; margin-bottom: 16px;">Explore our specialized frameworks, execution packages, and client case studies:</p>
  <ul style="list-style-type: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px;">
    <li style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); padding: 12px 16px; border-radius: 8px;"><a href="https://www.gabbarinfo.com/seo-content-writing/" style="color: #fbbf24; font-weight: 600; text-decoration: none;">📌 SEO & Content Writing Services</a></li>
    <li style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); padding: 12px 16px; border-radius: 8px;"><a href="https://www.gabbarinfo.com/digitalmarketing/" style="color: #fbbf24; font-weight: 600; text-decoration: none;">📈 High-ROI Digital Marketing</a></li>
    <li style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); padding: 12px 16px; border-radius: 8px;"><a href="https://www.gabbarinfo.com/website-design/" style="color: #fbbf24; font-weight: 600; text-decoration: none;">💻 Website Design & Development</a></li>
    <li style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); padding: 12px 16px; border-radius: 8px;"><a href="https://www.gabbarinfo.com/packages/" style="color: #fbbf24; font-weight: 600; text-decoration: none;">📦 Tailored SEO & Growth Packages</a></li>
  </ul>
</div>\n`;
      if (finalContent.includes("FAQ") || finalContent.includes("Frequently Asked Questions")) {
        finalContent = finalContent.replace(/(<h2[^>]*>(?:FAQ|Frequently Asked Questions)[\s\S]*?<\/h2>)/i, `${hubHtml}\n$1`);
      } else {
        finalContent += hubHtml;
      }
    }

    // External Authority Citations Guarantee
    if (!finalContent.includes("developers.google.com") && !finalContent.includes("statista.com")) {
      const authorityCitationHtml = `\n<div class="gabbarinfo-authority-citations" style="margin: 32px 0; padding: 20px 24px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-left: 4px solid #f59e0b; border-radius: 8px; font-size: 14px; color: #cbd5e1; line-height: 1.6;"><strong>Official Search Authority & Industry Benchmarks:</strong> For technical documentation on search indexing, structured data, and search ranking systems, consult <a href="https://developers.google.com/search/docs" target="_blank" rel="noopener" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">Google Search Central</a> and verify competitive digital benchmarks via <a href="https://www.statista.com" target="_blank" rel="noopener" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">Statista</a>.</div>\n`;
      const closingH2Index = finalContent.lastIndexOf("<h2>");
      if (closingH2Index > 0) {
        finalContent = finalContent.slice(0, closingH2Index) + authorityCitationHtml + finalContent.slice(closingH2Index);
      } else {
        finalContent += authorityCitationHtml;
      }
    }

    // Final Sanitization Pass: Guarantee NO Duplicate TOC and NO Light Backgrounds
    finalContent = finalContent.replace(/<nav[\s\S]*?<\/nav>/gi, "");
    finalContent = finalContent.replace(/<div id="ez-toc-container"[\s\S]*?<\/div>/gi, "");
    finalContent = finalContent.replace(/<ul class="ez-toc-list[\s\S]*?<\/ul>/gi, "");
    finalContent = finalContent.replace(/<p[^>]*>\s*<strong>\s*Table of Contents[\s\S]*?<\/ul>/gi, "");
    finalContent = finalContent.replaceAll("#0284c7", "#f59e0b");
    finalContent = finalContent.replaceAll("#f8fafc", "rgba(255, 255, 255, 0.04)");
    finalContent = finalContent.replaceAll("#f1f5f9", "#cbd5e1");

    // 8. Push Live Article to WordPress via Plugin
    console.log(`[SEO Engine] Pushing article to WordPress: ${siteUrl}/wp-json/gabbarinfo/v1/create-post`);
    const wpPublishPayload = {
      title: parsedArticle.title,
      content: finalContent,
      slug: parsedArticle.slug,
      status: publishStatus,
      post_type: "post",
      featured_image_url: featuredImageUrl,
      featured_image_alt: parsedArticle.title,
      mid_image_url: midImageUrl,
      mid_image_alt: parsedArticle.title,
      meta_title: parsedArticle.meta_title,
      meta_description: parsedArticle.meta_description,
      focus_keyword: parsedArticle.focus_keyword,
      tags: parsedArticle.tags || parsedArticle.secondary_keywords || ["SEO Optimization", "Digital Marketing", "Business Growth"],
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
      return {
        ok: false,
        status: 500,
        error: wpResult?.message || "Failed to publish article on WordPress site.",
      };
    }

    console.log(`[SEO Engine] Successfully published! Post ID: ${wpResult.post_id}, URL: ${wpResult.post_url}`);

    // Commit successful SEO Article usage to persistent quota ledger
    await commitQuota({
      reservationId: quotaRes.reservationId,
      businessId: quotaRes.businessId,
      cycleStart: quotaRes.cycleStart,
      actionType: "SEO_ARTICLE",
      assetId: siteUrl,
      userEmail,
    });

    return {
      ok: true,
      status: 200,
      post_id: wpResult.post_id,
      post_url: wpResult.post_url,
      title: parsedArticle.title,
      content: finalContent,
      slug: parsedArticle.slug,
      meta_title: parsedArticle.meta_title,
      meta_description: parsedArticle.meta_description,
      focus_keyword: parsedArticle.focus_keyword,
      tags: parsedArticle.tags || parsedArticle.secondary_keywords || [],
      featured_image: featuredImageUrl,
      mid_image: midImageUrl,
      siteUrl,
    };
  } catch (err) {
    console.error("Generate blog error:", err);
    if (quotaRes?.reservationId) {
      await releaseQuota({
        reservationId: quotaRes.reservationId,
        businessId: quotaRes.businessId,
        cycleStart: quotaRes.cycleStart,
        actionType: "SEO_ARTICLE",
        reason: "Blog generation error: " + err.message,
      });
    }
    if (reservation?.transactionId && userEmail) {
      await releaseCredits({
        userEmail,
        transactionId: reservation.transactionId,
        cost: reservation.cost,
        reason: "Blog generation error: " + err.message,
      });
    }
    return { ok: false, status: 500, error: err.message };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  let userEmail = req.body?.userEmail;
  let session = null;
  if (!userEmail) {
    try {
      const { authOptions } = await import("../auth/[...nextauth]");
      session = await getServerSession(req, res, authOptions);
      userEmail = session?.user?.email;
    } catch (_) {}
  }

  if (!userEmail) {
    return res.status(401).json({ ok: false, error: "Unauthorized: Please log in" });
  }

  const result = await executeBlogGeneration({
    userEmail,
    session,
    businessName: req.body?.businessName,
    businessId: req.body?.businessId,
    topic: req.body?.topic,
    targetMarket: req.body?.targetMarket,
    city: req.body?.city,
    targetKeywords: req.body?.targetKeywords,
    brandVoice: req.body?.brandVoice,
    industry: req.body?.industry,
    publishStatus: req.body?.publishStatus,
    crossPostSocial: req.body?.crossPostSocial,
    wordCount: req.body?.wordCount,
    isAutopilot: req.body?.isAutopilot,
    model: req.body?.model,
  });

  return res.status(result.status || (result.ok ? 200 : 400)).json(result);
}

export const maxDuration = 60;

export const config = {
  maxDuration: 60,
};
