// pages/api/wordpress/generate-blog.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  let userEmail = req.body?.userEmail;
  let session = null;
  if (!userEmail) {
    try {
      session = await getServerSession(req, res, authOptions);
      userEmail = session?.user?.email;
    } catch (_) {}
  }

  if (!userEmail) {
    return res.status(401).json({ ok: false, error: "Unauthorized: Please log in" });
  }

  let quotaRes = null;
  let reservation = null;

  try {
    // 1. Rate Limiting Gate
    const rateCheck = checkRateLimit(userEmail, "BLOG_GEN", 10, 60000);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        ok: false,
        error: `Too many blog requests. Please wait ${Math.ceil(rateCheck.resetInMs / 1000)} seconds.`,
      });
    }

    const {
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
    } = req.body;

    const requestedWords = Number(req.body?.wordCount) || 1500;
    const wordCount = Math.max(requestedWords, 1500);

    if (!topic) {
      return res.status(400).json({ ok: false, error: "Blog topic is required" });
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
      return res.status(400).json({
        ok: false,
        error: businessName && businessName !== "GABBARinfo"
          ? `No connected WordPress website found for "${businessName}". Please connect your website in the WordPress Connector first.`
          : `No connected WordPress website found. Please connect your WordPress website in the WordPress Connector first.`,
      });
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
      return res.status(quotaRes.code === "FEATURE_NOT_INCLUDED" ? 403 : 402).json({
        ok: false,
        code: quotaRes.code,
        error: quotaRes.error,
        planId: quotaRes.planId,
        nextResetDate: quotaRes.nextResetDate,
      });
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
      return res.status(402).json({
        ok: false,
        error: reservation.error || "Insufficient internal credits to execute blog generation.",
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ ok: false, error: "OpenAI API key missing in environment" });
    }

    const openai = new OpenAI({ apiKey });

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
      : `AUTONOMOUS KEYWORD DISCOVERY: The user did not provide manual keywords. You MUST act as an elite SEO keyword research engine: automatically identify, prioritize, and embed the top 3-5 high-volume, high-intent ranking keywords tailored specifically to "${effectiveBusiness}", its target market scope ("${businessLocation}"), and its core offerings ("${businessServices || industry || "Commercial Services"}"). Target commercial buyer and problem-solving search phrases that actual customers and decision-makers search for.`;

    // 4. Generate High-Ranking Blog Content & SEO Payload with GPT
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
   - STRICTLY DO NOT generate any Table of Contents (TOC), as the site's WordPress ez-toc plugin automatically creates it dynamically. Generating a manual TOC creates a duplicate.
   - THEME COLORS: This site uses a sleek dark theme with signature gold/amber yellow accents (#f59e0b).
     - All embedded hyperlinks MUST use theme amber/yellow: <a href="URL" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">anchor text</a>. NEVER use blue or #0284c7.
     - NEVER use light, white, or light gray backgrounds (like #f8fafc, #f1f5f9, or #ffffff) in any boxes or callouts!
     - Any callouts, key takeaways, or pro-tips must use dark mode styling: style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-left: 4px solid #f59e0b; padding: 18px 24px; margin: 24px 0; border-radius: 8px; color: #f1f5f9;"

6. OUTPUT FORMAT:
   - Output MUST be strictly valid JSON matching the schema.`;

    const userPrompt = `Business: ${effectiveBusiness}
Target Market / Scope: ${businessLocation}
Core Services / Industry: ${businessServices || industry || "Commercial Services"}
Brand Voice: ${brandVoice}
Blog Topic / Headline: ${topic}
${keywordList ? `Target Ranked Keywords: ${keywordList}` : "Keywords: Automatically target high-volume commercial and topical ranking phrases."}
MANDATORY MINIMUM WORD COUNT: Strictly 1600+ Words across all 10 detailed sections.

Respond ONLY with a valid JSON object matching this schema:
{
  "title": "Compelling, high-ranking blog title",
  "slug": "keyword-rich-url-slug",
  "meta_title": "SEO Meta Title (max 60 chars)",
  "meta_description": "SEO Meta Description (max 155 chars)",
  "focus_keyword": "Primary target keyword",
  "secondary_keywords": ["ranked keyword 2", "ranked keyword 3", "ranked keyword 4"],
  "tags": ["SEO Optimization", "Digital Marketing", "Business Growth", "Content Strategy", "Online Marketing"],
  "html_content": "Full exhaustive pillar article HTML (strictly 1600+ words with all 10 detailed sections, at least 4 internal links and 2 external links)",
  "featured_image_prompt": "Specific visual scene prompt for a 16:9 panoramic widescreen hero banner",
  "featured_image_alt": "Descriptive SEO alt text for hero image",
  "mid_image_prompt": "Specific visual infographic prompt for the mid-content visual",
  "mid_image_alt": "Descriptive SEO alt text for mid visual"
}`;

    // Multi-model AI Image Generator Helper powered by central ImageService
    const generateAiVisual = async (promptText, label = "visual", imageSize = "1024x1024") => {
      try {
        const isWidescreen = imageSize === "1792x1024";
        const result = await generatePlatformGraphic({
          prompt: promptText,
          businessId: businessId || "default_business",
          userEmail,
          aspectRatio: isWidescreen ? "16:9" : "1:1",
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
    const blogModel = req.body?.model || (req.body?.isAutopilot ? "gpt-4o-mini" : (process.env.AI_BLOG_MODEL || "gpt-4o-mini"));
    console.log(`[SEO Engine] Initiating concurrent parallel generation: ${blogModel} text + 2 gpt-image-2 visuals simultaneously...`);

    const featuredPrompt = `Panoramic 16:9 widescreen 3D conceptual artwork of "${topic}" for ${effectiveBusiness}. Sleek futuristic analytics command center, glowing golden trophy and amber bar charts, upward growth arrow, dark navy and slate aesthetic, cinematic studio lighting, Octane 3D render. STRICTLY NO TEXT, NO WORDS, NO LETTERS, NO TYPOGRAPHY, completely clean visual art.`;

    const midPrompt = `Clean isometric 3D infographic diagram illustrating "${topic}" and modern digital marketing growth flywheel. Floating glass geometric layers, golden gears, upward trajectory, dark slate background, warm amber glowing accents, studio lighting. STRICTLY NO TEXT, NO WORDS, NO LETTERS, completely clean visual art.`;

    // Execute LLM text generation AND both visual generations CONCURRENTLY in parallel
    const [completion, featuredImageUrl, midImageUrl] = await Promise.all([
      openai.chat.completions.create({
        model: blogModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: 8000,
        temperature: 0.7,
      }),
      generateAiVisual(featuredPrompt, "featured", "1792x1024").catch((e) => {
        console.warn("Featured image generation error:", e.message);
        return null;
      }),
      generateAiVisual(midPrompt, "mid", "1024x1024").catch((e) => {
        console.warn("Mid image generation error:", e.message);
        return null;
      }),
    ]);

    const parsedArticle = JSON.parse(completion.choices[0].message.content);

    // 6. Ensure In-Content Mid Visual is Injected and Verify Word Count
    let finalContent = parsedArticle.html_content || "";
    
    // Inject Mid-Article Visual Figure into HTML
    if (midImageUrl && !finalContent.includes(midImageUrl)) {
      const midAlt = parsedArticle.mid_image_alt || parsedArticle.title;
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

    // Word Count Verification and Expansion Pass
    const actualWords = finalContent.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;
    console.log(`[SEO Engine] Initial article word count: ${actualWords} words (Target: ${wordCount})`);

    if (actualWords < wordCount * 0.82) {
      if (req.body?.isAutopilot) {
        console.log(`[SEO Engine] Autopilot mode: word count is ${actualWords}. Skipping secondary expansion pass to guarantee high-velocity serverless completion.`);
      } else {
        console.log(`[SEO Engine] Word count (${actualWords}) below target (${wordCount}). Executing automatic enrichment & expansion pass...`);
        try {
          const expandResp = await openai.chat.completions.create({
            model: blogModel || "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You are an elite SEO editor and authority content architect.
The user requested a full ${wordCount}-word comprehensive pillar guide, but the draft currently has ${actualWords} words.
Your task is to expand and enrich this article so that the total word count exceeds ${wordCount} words.
INSTRUCTIONS:
1. Add 2 brand-new, comprehensive <h2> sections with deep technical analysis and practical execution playbooks.
2. Expand existing sections with multi-paragraph explanations (80-120 words per paragraph), actionable step-by-step frameworks, and metric breakdown lists.
3. Add or expand an exhaustive FAQ section with 5 high-impact questions and detailed multi-paragraph answers.
4. Keep all existing internal and external links and image tags intact.
5. Return ONLY valid JSON: { "expanded_html": "full comprehensive expanded HTML" }`,
              },
              {
                role: "user",
                content: `Headline: ${parsedArticle.title}\nTarget Word Count: ${wordCount}\nCurrent HTML Content:\n${finalContent}`,
              },
            ],
            response_format: { type: "json_object" },
            max_tokens: 4500,
            temperature: 0.7,
          });

          const expParsed = JSON.parse(expandResp.choices[0].message.content);
          if (expParsed?.expanded_html && expParsed.expanded_html.length > finalContent.length) {
            finalContent = expParsed.expanded_html;
            const newCount = finalContent.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;
            console.log(`[SEO Engine] Expansion successful! New word count: ${newCount} words.`);
          }
        } catch (expErr) {
          console.warn("[SEO Engine] Expansion pass skipped:", expErr.message);
        }
      }
    }

    // 7. Contextual Internal Linking & External Authority Citations Guarantee
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
    }

    // External Authority Citations Guarantee (Dark Theme with Amber Accents)
    if (!finalContent.includes("developers.google.com") && !finalContent.includes("statista.com")) {
      console.log("[SEO Engine] Injecting authoritative industry citations...");
      const authorityCitationHtml = `\n<div class="gabbarinfo-authority-citations" style="margin: 32px 0; padding: 20px 24px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-left: 4px solid #f59e0b; border-radius: 8px; font-size: 14px; color: #cbd5e1; line-height: 1.6;"><strong>Official Search Authority & Industry Benchmarks:</strong> For technical documentation on search indexing, structured data, and search ranking systems, consult <a href="https://developers.google.com/search/docs" target="_blank" rel="noopener" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">Google Search Central</a> and verify competitive digital benchmarks via <a href="https://www.statista.com" target="_blank" rel="noopener" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">Statista</a>.</div>\n`;
      const closingH2Index = finalContent.lastIndexOf("<h2>");
      if (closingH2Index > 0) {
        finalContent = finalContent.slice(0, closingH2Index) + authorityCitationHtml + finalContent.slice(closingH2Index);
      } else {
        finalContent += authorityCitationHtml;
      }
    }

    // Target Focus Keyword Highlighting
    if (parsedArticle.focus_keyword && !finalContent.toLowerCase().includes(`<strong>${parsedArticle.focus_keyword.toLowerCase()}</strong>`)) {
      const kwRegex = new RegExp(`(<p(?:[^>]*)>[^<]*?)(${parsedArticle.focus_keyword})([^<]*?<\\/p>)`, "i");
      if (kwRegex.test(finalContent)) {
        finalContent = finalContent.replace(kwRegex, `$1<strong>$2</strong>$3`);
      }
    }

    // Final Sanitization Pass: Guarantee NO Duplicate TOC and NO Light/White Backgrounds
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
      featured_image_alt: parsedArticle.featured_image_alt || parsedArticle.title,
      mid_image_url: midImageUrl,
      mid_image_alt: parsedArticle.mid_image_alt || parsedArticle.title,
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
      return res.status(500).json({
        ok: false,
        error: wpResult?.message || "Failed to publish article on WordPress site.",
      });
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

    return res.status(200).json({
      ok: true,
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
      status: wpResult.status,
      siteUrl,
    });
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
    return res.status(500).json({ ok: false, error: err.message });
  }
}

export const maxDuration = 60;

export const config = {
  maxDuration: 60,
};
