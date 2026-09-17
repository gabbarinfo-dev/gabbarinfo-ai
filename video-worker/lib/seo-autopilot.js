// video-worker/lib/seo-autopilot.js
const { createClient } = require("@supabase/supabase-js");
const OpenAI = require("openai");

const BLACKLISTED_TERMS = [
  "shipping",
  "delivery",
  "privacy",
  "policy",
  "terms",
  "condition",
  "refund",
  "cancellation",
  "disclaimer",
  "return",
  "contact",
  "about",
  "login",
  "register",
  "cart",
  "checkout",
  "cookie",
  "test",
  "discreet",
  "horoscope"
];

function decodeHtmlEntities(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/&#038;/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&#8211;/g, "-")
    .replace(/&#8217;/g, "'")
    .replace(/&quot;/g, '"');
}

function isLegitimateService(serviceName) {
  if (!serviceName || typeof serviceName !== "string") return false;
  const decoded = decodeHtmlEntities(serviceName).toLowerCase().trim();
  if (decoded.length < 3) return false;
  for (const term of BLACKLISTED_TERMS) {
    if (decoded.includes(term)) return false;
  }
  return true;
}

async function runSeoAutopilotCycle({ supabase, openai, force = false, logger = console.log }) {
  if (!supabase) throw new Error("Supabase client is required.");
  if (!openai) throw new Error("OpenAI client is required for blog & visual generation.");

  logger("[SEO Autopilot] Starting autonomous scheduled blog cycle on Railway...");

  // 1. Fetch active SEO Autopilot configurations
  const { data: configs, error } = await supabase
    .from("agent_memory")
    .select("email, memory_type, content")
    .like("memory_type", "wp_autopilot_%");

  if (error) {
    logger("[SEO Autopilot] Failed to fetch SEO autopilot configs:", error.message);
    throw error;
  }

  const results = [];

  for (const item of configs || []) {
    try {
      const config = JSON.parse(item.content);
      const isEnabled = config.enabled === undefined ? true : config.enabled;
      if (!isEnabled && !force) {
        logger(`[SEO Autopilot] Autopilot disabled for ${item.email}. Skipping.`);
        continue;
      }

      const businessName = config.businessName || "GABBARinfo";
      logger(`[SEO Autopilot] Processing cycle for ${item.email} (${businessName})...`);

      // 2. Check Cadence velocity (~12 hours for daily)
      const lastPublished = config.lastPublishedAt ? new Date(config.lastPublishedAt) : null;
      const now = new Date();
      const minIntervalMs = 12 * 60 * 60 * 1000;

      if (lastPublished && (now - lastPublished) < minIntervalMs && !force) {
        logger(`[SEO Autopilot] Cadence threshold not reached for ${item.email} (${businessName}). Skipping.`);
        continue;
      }

      // 3. Find connected WordPress credentials from agent_memory
      const { data: wpMemList } = await supabase
        .from("agent_memory")
        .select("content")
        .eq("email", item.email)
        .or("memory_type.like.wp_conn_%,memory_type.like.wp_connection_%");

      let wpConn = null;
      for (const m of wpMemList || []) {
        try {
          const parsed = JSON.parse(m.content);
          if (parsed.siteUrl && (parsed.apiKey || parsed.applicationPassword)) {
            wpConn = parsed;
            break;
          }
        } catch (_) {}
      }

      if (!wpConn) {
        logger(`[SEO Autopilot] No active WordPress connection for ${item.email}. Skipping.`);
        results.push({ email: item.email, status: "skipped", reason: "no_wp_connection" });
        continue;
      }

      const siteUrl = wpConn.siteUrl.replace(/\/$/, "");
      const wpApiKey = wpConn.apiKey;

      // 4. Select Legitimate Service Topic
      let candidateServices = [];
      if (Array.isArray(config.discoveredServices)) candidateServices.push(...config.discoveredServices.map(decodeHtmlEntities));
      if (Array.isArray(config.targetKeywords)) candidateServices.push(...config.targetKeywords.map(decodeHtmlEntities));
      candidateServices = [...new Set(candidateServices)].filter(isLegitimateService);

      if (candidateServices.length === 0) {
        candidateServices = [
          "Search Engine Optimization (SEO) & Topical Authority",
          "High-ROI Google Ads Management & Search PPC",
          "High-Performance Meta & Instagram Ads Scaling",
          "Custom Website Design & High-Converting UI/UX",
          "Google Business Profile & Local 3-Pack Dominance",
          "Full-Funnel Digital Marketing Strategy"
        ];
      }

      let nextIndex = (Number(config.lastServiceIndex) || 0) + 1;
      if (nextIndex >= candidateServices.length) nextIndex = 0;
      const activeService = candidateServices[nextIndex] || "Full-Funnel Digital Marketing Strategy";
      const targetLocations = (config.targetLocations || config.targetMarket || "").trim();

      // 4.5 Fetch Existing Published WordPress Posts for Authentic Internal Linking
      let existingPublishedPosts = [];
      try {
        const postsResp = await fetch(`${siteUrl}/wp-json/wp/v2/posts?per_page=15&_fields=id,title,slug,link`, {
          headers: { Accept: "application/json" },
        });
        if (postsResp.ok) {
          const rawPosts = await postsResp.json();
          if (Array.isArray(rawPosts)) {
            existingPublishedPosts = rawPosts.map((p) => ({
              id: p.id,
              title: typeof p.title === "object" ? p.title.rendered : p.title,
              link: p.link,
              slug: p.slug,
            })).filter((p) => p.link && p.title);
          }
        }
      } catch (e) {
        logger(`[SEO Autopilot] Note: Could not fetch existing published posts (${e.message}).`);
      }

      // 5. Generate Full SEO Article (STRICT 1,650+ words, 10 structured sections) via GPT-4o
      logger(`[SEO Autopilot] Generating exhaustive 1,650+ word SEO guide for "${activeService}"...`);
      const systemPrompt = `You are an elite commercial SEO director, tech journalist, and enterprise growth strategist writing for ${businessName} (${siteUrl}).
Write an exhaustive, authoritative, 100% human-grade master guide focused specifically on "${activeService}".
${targetLocations ? `
TARGET GEOGRAPHIC MARKET MANDATE:
The business is specifically targeting clients and audiences in: "${targetLocations}".
- Deeply localize the analysis, market dynamics, regulatory landscape, consumer purchasing behavior, and regional industry context to these target countries/cities (${targetLocations}).
- Incorporate specific regional references naturally within case examples, economic statistics, and strategic playbooks (e.g. contrasting market speeds, local compliance, or consumer search patterns in ${targetLocations}).
` : ""}
CRITICAL LENGTH & DEPTH MANDATES:
1. STRICT WORD COUNT: Body content MUST BE AT LEAST 1,650 WORDS (target: 1,700 to 2,200 words). Any shallow summaries under 1,500 words are strictly unacceptable.
2. MANDATORY 10 SECTIONS (You MUST include ALL 10 of these exact <h2> sections with 2 to 3 detailed <h3> subsections each):
   - <h2>1. The Strategic Evolution of ${activeService} in 2026</h2> (At least 170 words across 2 detailed paragraphs explaining the modern landscape, AI discovery, and market shifts)
   - <h2>2. Core Foundations, Strategic Principles & Attribution Frameworks</h2> (At least 180 words detailing key methodologies, first-party data capture, and operational mechanics)
   - <h2>3. High-Converting Campaign Architecture & Execution Systems</h2> (At least 200 words with actionable structural frameworks, audience modeling, and formulas)
   - <h2>4. Technology Infrastructure, Analytics & Conversion Mastery</h2> (At least 180 words detailing measurement, CAPI/tracking, modern tooling, and data accuracy)
   - <h2>5. Omnichannel Growth Funnels & Audience Monetization</h2> (At least 180 words on cross-platform synergy, CAC reduction, and ROI scaling)
   - <h2>6. In-Depth Real-World Case Study: 0 to 480% Revenue Acceleration</h2> (At least 220 words detailing baseline metrics, strategic interventions, and verified commercial gains)
   - <h2>7. Step-by-Step 90-Day Execution Playbook for Hyper-Growth</h2> (At least 220 words with Month 1, Month 2, Month 3 actionable sprints)
   - <h2>8. 5 Critical Pitfalls & Costly Strategic Mistakes to Avoid</h2> (At least 200 words detailing common misconceptions, vanity metrics, and operational fixes)
   - <h2>9. Frequently Asked Questions (FAQ)</h2> (Provide 5 detailed, high-impact questions specifically about ${activeService}, each answered with comprehensive multi-paragraph explanations of 100+ words, totaling 500+ words for this FAQ section)
   - <h2>10. Strategic Conclusion and Actionable Roadmap for 2026</h2> (At least 150 words summary with a clear commercial call to action to partner with ${businessName})

3. MANDATORY 8 TO 12 TARGET KEYWORD CLUSTER & ORGANIC DENSITY:
   - Generate and target a rich semantic keyword cluster of 8 to 12 distinct keywords directly relevant to "${activeService}":
     * 1 Primary Focus Keyword
     * 3 to 4 Secondary Commercial Intent Keywords
     * 4 to 7 Semantic LSI Variations and long-tail query phrases
   - NATURAL HIGH DENSITY USAGE (1.5% - 2.5%):
     * The Primary Keyword MUST appear in the title, in the first 100 words of the opening paragraph (bolded as <strong>primary keyword</strong>), in at least two <h2> or <h3> subheadings, and naturally 4 to 6 times across the body.
     * Each of the 7 to 11 Secondary and LSI keywords MUST be woven organically throughout the article sections (at least 2 to 4 times each).
     * NEVER stuff keywords robotically. Every keyword MUST be integrated in natural, fluent, syntactically correct English.

4. MANDATORY EMBEDDED INTERNAL HYPERLINKS (Styled with theme amber #f59e0b, bold, underline):
   - Core Services & Pages:
     * <a href="${siteUrl}/services/" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">${businessName} Digital Marketing & Development Services</a>
     * <a href="${siteUrl}/contact-us/" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">Schedule a Growth Strategy Session with ${businessName}</a>
     * <a href="${siteUrl}/packages/" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">Explore Enterprise Digital Growth Packages</a>
${existingPublishedPosts.length > 0 ? `
   - MANDATORY EXISTING PUBLISHED BLOG INTERNAL LINK:
     You MUST choose at least ONE relevant published blog post from the site's existing catalog below and contextually embed an internal hyperlink to it in Section 3, Section 4, or Section 5 with natural, fluent sentence anchor text:
${existingPublishedPosts.slice(0, 8).map((p) => `     * Link: <a href="${p.link}" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">[Contextual anchor related to ${p.title}]</a> (Title: "${p.title}")`).join("\n")}
` : ""}

5. MANDATORY 4+ SCATTERED EXTERNAL AUTHORITY LINKS (STRICT SPATIAL DISTRIBUTION):
   You MUST embed AT LEAST 4 authoritative, topic-relevant, non-competing external links.
   CRITICAL SPATIAL DISTRIBUTION RULE: These links MUST BE SCATTERED across different parts of the article. It is STRICTLY FORBIDDEN to clump them together or put them only in the last 2 paragraphs or conclusion.
   
   Embed strictly across these sections:
   - Early Body (Section 1 or Section 2): 1 external link citing recognized market statistics, economic analysis, or industry shifts (e.g., Gartner [https://www.gartner.com], McKinsey & Company [https://www.mckinsey.com], Harvard Business Review [https://hbr.org], Forrester [https://www.forrester.com], or Statista [https://www.statista.com]).
   - Mid-First Half (Section 3 or Section 4): 1 external link to an authoritative publication or technical standard directly relevant to the topic (e.g., Search Engine Journal [https://www.searchenginejournal.com], HubSpot Research [https://www.hubspot.com], Content Marketing Institute [https://contentmarketinginstitute.com], W3C Standards [https://www.w3.org], Nielsen Norman Group [https://www.nngroup.com], or IEEE Computer Society [https://www.computer.org]).
   - Mid-Second Half (Section 5 or Section 6): 1 external link to an authoritative commercial benchmark, conversion index, or analytics framework (e.g., Bain & Company [https://www.bain.com], Deloitte Insights [https://www2.deloitte.com], PwC Global [https://www.pwc.com], or eMarketer [https://www.emarketer.com]).
   - Late Body (Section 7 or Section 8): 1 external link to a credible professional guideline, compliance standard, or recognized industry benchmark (e.g., FTC Consumer & Advertising Guidelines [https://www.ftc.gov], IAB Interactive Advertising Bureau [https://www.iab.com], or ISO Standards [https://www.iso.org]).
   
   External Link Styling:
   Every external link MUST have target="_blank" rel="noopener noreferrer" and be styled in theme amber:
   <a href="URL" target="_blank" rel="noopener noreferrer" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">Descriptive Anchor Text</a>

6. FORMATTING & THEME:
   - Semantic HTML: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>.
   - DO NOT include <h1>, <html>, or <body> tags.
   - DO NOT generate a Table of Contents (the WordPress ez-toc plugin handles it).
   - Use dark mode callout boxes:
     <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-left: 4px solid #f59e0b; padding: 18px 24px; margin: 24px 0; border-radius: 8px; color: #f1f5f9;"><strong>Key Insight:</strong> [Detailed tactical recommendation]</div>

Format output as valid JSON:
{
  "title": "Clear High-CTR Title with Focus Keyword",
  "meta_title": "SEO Title (under 60 chars)",
  "meta_description": "Compelling meta description with call to action (under 160 chars)",
  "focus_keyword": "Primary keyword",
  "target_keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5", "keyword 6", "keyword 7", "keyword 8"],
  "slug": "url-friendly-slug",
  "tags": ["Tag 1", "Tag 2", "Tag 3", "Tag 4", "Tag 5"],
  "content_html": "Full 1650+ word article formatted in semantic HTML with all 10 sections"
}`;

      const articleCompletion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Write the complete 1,650+ word deep-dive guide focused specifically on "${activeService}" for ${businessName} in 2026.` }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 4096,
      });

      const parsedArticle = JSON.parse(articleCompletion.choices[0]?.message?.content || "{}");
      if (!parsedArticle.title || !parsedArticle.content_html) {
        throw new Error("Failed to generate complete SEO article content.");
      }

      // 6. Generate Bespoke Dual Images via gpt-image-2 (Hero + Mid-Content Diagram)
      logger(`[SEO Autopilot] Generating dual bespoke visuals via gpt-image-2 for "${parsedArticle.title}"...`);
      let featuredImageUrl = null;
      let midImageUrl = null;

      // Image 1: Hero Featured Image
      try {
        const heroPrompt = `Award-winning commercial editorial hero illustration for blog article. Title: "${parsedArticle.title}". Subject: "${activeService}". Sleek modern studio lighting, 3D holographic digital accents, dark luxury slate aesthetics, high contrast, clean agency composition, pristine 4K quality, no text watermark.`;
        const heroRes = await openai.images.generate({
          model: "gpt-image-2",
          prompt: heroPrompt,
          size: "1024x1024",
        });

        let heroBuffer = null;
        if (heroRes.data?.[0]?.b64_json) {
          heroBuffer = Buffer.from(heroRes.data[0].b64_json, "base64");
        } else if (heroRes.data?.[0]?.url) {
          const fetchRes = await fetch(heroRes.data[0].url);
          heroBuffer = Buffer.from(await fetchRes.arrayBuffer());
        }

        if (heroBuffer) {
          const fileName = `wp_feat_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from("instagram-creatives")
            .upload(fileName, heroBuffer, { contentType: "image/png", upsert: true });

          if (!uploadErr && uploadData) {
            const { data: pubUrlData } = supabase.storage.from("instagram-creatives").getPublicUrl(fileName);
            featuredImageUrl = pubUrlData.publicUrl;
            logger(`[SEO Autopilot] Featured hero image hosted: ${featuredImageUrl}`);
          }
        }
      } catch (imgErr) {
        logger("[SEO Autopilot] Hero image generation notice:", imgErr.message);
      }

      // Image 2: Secondary Mid-Article Architecture Diagram / Infographic
      try {
        const midPrompt = `Award-winning commercial editorial diagram graphic showing modern technical architecture, workflow flowcharts, and multi-channel attribution model for "${activeService}". Sleek dark luxury slate aesthetic, glowing cyan and warm amber accent lighting, clean geometric flow lines, 3D holographic analytics panels, high contrast, clean agency composition, pristine 4K quality, no text gibberish.`;
        const midRes = await openai.images.generate({
          model: "gpt-image-2",
          prompt: midPrompt,
          size: "1024x1024",
        });

        let midBuffer = null;
        if (midRes.data?.[0]?.b64_json) {
          midBuffer = Buffer.from(midRes.data[0].b64_json, "base64");
        } else if (midRes.data?.[0]?.url) {
          const fetchRes = await fetch(midRes.data[0].url);
          midBuffer = Buffer.from(await fetchRes.arrayBuffer());
        }

        if (midBuffer) {
          const midFileName = `wp_mid_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from("instagram-creatives")
            .upload(midFileName, midBuffer, { contentType: "image/png", upsert: true });

          if (!uploadErr && uploadData) {
            const { data: pubUrlData } = supabase.storage.from("instagram-creatives").getPublicUrl(midFileName);
            midImageUrl = pubUrlData.publicUrl;
            logger(`[SEO Autopilot] Secondary mid-article diagram hosted: ${midImageUrl}`);
          }
        }
      } catch (midErr) {
        logger("[SEO Autopilot] Mid-article diagram notice:", midErr.message);
      }

      // Inject Secondary Mid-Article Diagram Image into HTML content after section 2
      let finalContentHtml = parsedArticle.content_html;
      if (midImageUrl) {
        const midFigureHtml = `\n<figure class="gabbarinfo-mid-image" style="margin: 36px 0; text-align: center;">\n  <img src="${midImageUrl}" alt="${activeService} Strategy and Architecture Blueprint 2026" style="max-width: 100%; height: auto; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 8px 32px rgba(0,0,0,0.4);" />\n  <figcaption style="font-size: 13px; color: #94a3b8; margin-top: 10px; font-style: italic;">Figure 1: Strategic Architecture & Execution Blueprint for ${activeService}</figcaption>\n</figure>\n`;
        if (finalContentHtml.includes("</h2>")) {
          const parts = finalContentHtml.split("</h2>");
          if (parts.length > 2) {
            parts[2] = parts[2] + midFigureHtml;
            finalContentHtml = parts.join("</h2>");
          } else {
            finalContentHtml = parts[0] + "</h2>" + midFigureHtml + parts.slice(1).join("</h2>");
          }
        } else {
          finalContentHtml = midFigureHtml + finalContentHtml;
        }
      }

      // 7. Publish Post to WordPress via Official Plugin Endpoint
      logger(`[SEO Autopilot] Publishing live post to ${siteUrl}/wp-json/gabbarinfo/v1/create-post...`);
      const wpPayload = {
        title: parsedArticle.title,
        content: finalContentHtml,
        slug: parsedArticle.slug,
        status: "publish",
        post_type: "post",
        featured_image_url: featuredImageUrl,
        featured_image_alt: parsedArticle.title,
        meta_title: parsedArticle.meta_title,
        meta_description: parsedArticle.meta_description,
        focus_keyword: parsedArticle.focus_keyword,
        tags: parsedArticle.tags || ["SEO Optimization", "Digital Marketing", "Business Growth"],
      };

      const wpResp = await fetch(`${siteUrl}/wp-json/gabbarinfo/v1/create-post`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${wpApiKey}`,
        },
        body: JSON.stringify(wpPayload),
      });

      const wpResult = await wpResp.json();
      if (!wpResp.ok || !wpResult.ok) {
        throw new Error(wpResult.message || `WordPress publish failed with HTTP ${wpResp.status}`);
      }

      const publishedPostId = wpResult.post_id || wpResult.id;
      const publishedPostUrl = wpResult.post_url || `${siteUrl}/${parsedArticle.slug}/`;
      logger(`[SEO Autopilot] Post published successfully to WordPress! ID: ${publishedPostId}, URL: ${publishedPostUrl}`);

      // 8. In-Process Social Media Syndication (Guaranteed Facebook & Instagram Posting)
      const socialShares = {};
      const { data: metaConn } = await supabase
        .from("meta_connections")
        .select("fb_page_id, fb_page_access_token, fb_user_access_token, ig_business_id, instagram_id")
        .ilike("email", item.email.trim())
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (metaConn) {
        let pageToken = metaConn.fb_page_access_token;
        const userToken = metaConn.fb_user_access_token;
        const pageId = metaConn.fb_page_id ? metaConn.fb_page_id.split(",")[0].trim() : null;
        const igId = metaConn.ig_business_id || metaConn.instagram_id;

        if (!pageToken && userToken && pageId) {
          try {
            const tokenResp = await fetch(`https://graph.facebook.com/v21.0/${pageId}?fields=access_token&access_token=${encodeURIComponent(userToken)}`);
            const tokenJson = await tokenResp.json();
            if (tokenJson?.access_token) {
              pageToken = tokenJson.access_token;
              // Persist valid page access token
              await supabase
                .from("meta_connections")
                .update({ fb_page_access_token: pageToken, updated_at: new Date().toISOString() })
                .eq("email", item.email.trim());
            }
          } catch (_) {}
        }
        const effectiveToken = pageToken || userToken;
        const geoTagline = targetLocations ? `📍 Geo Target: ${targetLocations}\n\n` : "";
        const geoHashtags = targetLocations
          ? " " + targetLocations.split(",").map((l) => `#${l.trim().replace(/[^a-zA-Z0-9]/g, "")}`).filter((h) => h.length > 2).slice(0, 4).join(" ")
          : "";

        // FACEBOOK: Interactive Clickable Link Card with Photo Fallback
        const shouldShareFacebook = config.autoShareFacebook !== false && pageId && effectiveToken;
        if (shouldShareFacebook) {
          try {
            logger(`[SEO Autopilot] Syndicating Clickable Link Card to Facebook Page (${pageId})...`);
            const feedParams = new URLSearchParams();
            feedParams.append("link", publishedPostUrl);
            feedParams.append("message", `📢 ${parsedArticle.title}\n\n${geoTagline}${parsedArticle.meta_description || ""}\n\nRead full article here 👇\n${publishedPostUrl}\n\n#${activeService.replace(/[^a-zA-Z0-9]/g, "")} #SEO #DigitalMarketing${geoHashtags}`);
            feedParams.append("access_token", effectiveToken);

            const fbRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
              method: "POST",
              body: feedParams,
            });
            const fbData = await fbRes.json();
            if (fbData.id) {
              socialShares.facebook = { ok: true, id: fbData.id };
              logger(`[SEO Autopilot] Facebook Link Card published: ${fbData.id}`);
            } else {
              // Fallback to photo post if link feed failed
              const shareImg = featuredImageUrl || midImageUrl;
              if (shareImg) {
                const photoParams = new URLSearchParams();
                photoParams.append("url", shareImg);
                photoParams.append("caption", `📢 ${parsedArticle.title}\n\n${geoTagline}${parsedArticle.meta_description || ""}\n\nRead full article here 👇\n${publishedPostUrl}\n\n#${activeService.replace(/[^a-zA-Z0-9]/g, "")} #SEO #DigitalMarketing${geoHashtags}`);
                photoParams.append("access_token", effectiveToken);
                const fbPhotoRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, { method: "POST", body: photoParams });
                const fbPhotoData = await fbPhotoRes.json();
                socialShares.facebook = { ok: !!(fbPhotoData.id), id: fbPhotoData.id || null, error: fbData.error?.message };
              } else {
                socialShares.facebook = { ok: false, error: fbData.error?.message };
              }
            }
          } catch (fbErr) {
            socialShares.facebook = { ok: false, error: fbErr.message };
            logger("[SEO Autopilot] Facebook syndication network error:", fbErr.message);
          }
        }

        // INSTAGRAM: Featured image with title, description, link/bio, and hashtags
        const shouldShareInstagram = config.autoShareInstagram !== false && igId && effectiveToken && featuredImageUrl;
        if (shouldShareInstagram) {
          try {
            logger(`[SEO Autopilot] Syndicating Featured Image to Instagram (${igId})...`);
            const igCaption = [
              `📢 ${parsedArticle.title}`,
              "",
              geoTagline ? geoTagline.trim() : "",
              parsedArticle.meta_description || "",
              "",
              `🔗 Full article: ${publishedPostUrl}`,
              "",
              `#${activeService.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()} #SEO #ContentMarketing #BusinessGrowth #DigitalStrategy${geoHashtags}`
            ].filter(Boolean).join("\n");

            const containerParams = new URLSearchParams();
            containerParams.append("image_url", featuredImageUrl);
            containerParams.append("caption", igCaption);
            containerParams.append("access_token", effectiveToken);

            const igContainerRes = await fetch(`https://graph.facebook.com/v21.0/${igId}/media`, { method: "POST", body: containerParams });
            const containerData = await igContainerRes.json();

            if (containerData.id) {
              await new Promise((resolve) => setTimeout(resolve, 5000));
              const pubParams = new URLSearchParams();
              pubParams.append("creation_id", containerData.id);
              pubParams.append("access_token", effectiveToken);

              const igPubRes = await fetch(`https://graph.facebook.com/v21.0/${igId}/media_publish`, { method: "POST", body: pubParams });
              const pubData = await igPubRes.json();
              socialShares.instagram = { ok: !!pubData.id, id: pubData.id || null };
              logger(`[SEO Autopilot] Instagram post published: ${pubData.id}`);
            }
          } catch (igErr) {
            socialShares.instagram = { ok: false, error: igErr.message };
            logger("[SEO Autopilot] Instagram syndication error:", igErr.message);
          }
        }
      }

      // 9. Persist updated memory state to Supabase
      config.lastPublishedAt = now.toISOString();
      config.lastPublishedTitle = parsedArticle.title;
      config.lastPublishedUrl = publishedPostUrl;
      config.lastPublishedPostId = publishedPostId;
      config.lastServiceIndex = nextIndex;
      config.publishedCount = (Number(config.publishedCount) || 0) + 1;
      config.publishedTopics = config.publishedTopics || [];
      config.publishedTopics.push(parsedArticle.title);
      if (config.publishedTopics.length > 30) config.publishedTopics.shift();

      await supabase
        .from("agent_memory")
        .update({
          content: JSON.stringify(config),
          updated_at: now.toISOString(),
        })
        .eq("email", item.email)
        .eq("memory_type", item.memory_type);

      logger(`[SEO Autopilot] Memory updated for ${item.email}. Published count: ${config.publishedCount}`);

      results.push({
        email: item.email,
        business: businessName,
        title: parsedArticle.title,
        postUrl: publishedPostUrl,
        postId: publishedPostId,
        status: "published",
        socialShares,
      });
    } catch (userErr) {
      logger(`[SEO Autopilot] Error processing ${item.email}:`, userErr.message);
      results.push({ email: item.email, status: "error", error: userErr.message });
    }
  }

  logger(`[SEO Autopilot] Completed cycle. Processed ${results.length} accounts.`);
  return results;
}

module.exports = {
  runSeoAutopilotCycle,
  isLegitimateService,
};
