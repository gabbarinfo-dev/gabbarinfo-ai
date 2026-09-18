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

function enforceSpatialLinkDistribution(contentHtml, catalogPosts = [], activeService = "Our Services") {
  if (!contentHtml) return contentHtml;
  let clean = contentHtml;

  // 1. Clean Section 10 / Final Paragraph from dumped links
  clean = clean.replace(/<p>[^<]*partner with\s*<a[^>]*href=["'][^"']*services[^"']*["'][^>]*>[\s\S]*?<\/p>/gi, () => {
    return `<p>To stay ahead of the competition in 2026, building an agile, multi-channel growth engine is no longer optional—it is the foundation of sustainable enterprise scale. By pairing disciplined data analytics with high-converting creative execution, modern businesses can unlock predictable revenue streams and outpace market disruption.</p>`;
  });

  const lastSectionRegex = /<h2>10\.\s*Strategic Conclusion[\s\S]*$/i;
  const matchSection10 = clean.match(lastSectionRegex);
  if (matchSection10) {
    let section10Html = matchSection10[0];
    const strippedSection10 = section10Html.replace(/<a\s+[^>]*href=["'][^"']*(?:services|contact-us|packages)[^"']*["'][^>]*>(.*?)<\/a>/gi, '$1');
    clean = clean.replace(section10Html, strippedSection10);
  }

  // 2. Count internal links to real blog posts across the body
  const internalLinkRegex = /<a\s+[^>]*href=["']https?:\/\/[^"']+\/([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  const foundBlogLinks = [];
  let m;
  while ((m = internalLinkRegex.exec(clean)) !== null) {
    const path = m[1];
    if (!path.includes('services') && !path.includes('contact') && !path.includes('packages') && !path.includes('#')) {
      foundBlogLinks.push({ url: m[0], path });
    }
  }

  // If fewer than 3 internal blog links exist in the body, inject them into sections 2, 4, 6
  if (foundBlogLinks.length < 3 && Array.isArray(catalogPosts) && catalogPosts.length > 0) {
    const usablePosts = catalogPosts.filter(p => p.link && !p.link.includes('santa') && !p.link.includes('christmas'));
    if (usablePosts[0] && !clean.includes(usablePosts[0].link)) {
      clean = clean.replace(/(2\.\s*Core Foundations[\s\S]*?<\/h2>\s*<p>)/i, (match) => {
        return `${match}As detailed in our foundational analysis of <a href="${usablePosts[0].link}" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">${usablePosts[0].title.toLowerCase()}</a>, establishing rigorous commercial foundations is essential. `;
      });
    }
    if (usablePosts[1] && !clean.includes(usablePosts[1].link)) {
      clean = clean.replace(/(4\.\s*Technology Infrastructure[\s\S]*?<\/h2>\s*<p>)/i, (match) => {
        return `${match}Modern digital infrastructure requires strict attribution fidelity. For teams scaling campaigns, referencing our guide on <a href="${usablePosts[1].link}" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">${usablePosts[1].title.toLowerCase()}</a> provides actionable technical frameworks. `;
      });
    }
    if (usablePosts[2] && !clean.includes(usablePosts[2].link)) {
      clean = clean.replace(/(6\.\s*In-Depth Real-World Case Study[\s\S]*?<\/h2>\s*<p>)/i, (match) => {
        return `${match}Organic discovery remains a powerful compounding asset. As analyzed in our <a href="${usablePosts[2].link}" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">${usablePosts[2].title.toLowerCase()}</a>, coupling organic authority with targeted outreach dramatically lowers customer acquisition costs. `;
      });
    }
  }

  return clean;
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

      // 4. Select Legitimate Service Topic for ANY Business Type
      let candidateServices = [];
      if (Array.isArray(config.discoveredServices)) candidateServices.push(...config.discoveredServices.map(decodeHtmlEntities));
      if (Array.isArray(config.targetKeywords)) candidateServices.push(...config.targetKeywords.map(decodeHtmlEntities));
      candidateServices = [...new Set(candidateServices)].filter(isLegitimateService);

      // If not yet discovered, check client onboarding memory for their exact business services
      if (candidateServices.length === 0) {
        try {
          const { data: clientMem } = await supabase
            .from("agent_memory")
            .select("content")
            .eq("email", item.email)
            .eq("memory_type", "client")
            .maybeSingle();
          if (clientMem?.content) {
            const parsedClient = typeof clientMem.content === "string" ? JSON.parse(clientMem.content) : clientMem.content;
            const bAnswers = parsedClient?.business_answers?.[businessName] || parsedClient?.business_answers?.["default_business"] || parsedClient || {};
            const clientServ = bAnswers.services || bAnswers.service || bAnswers.products || "";
            if (clientServ) {
              const splitted = String(clientServ).split(/[,|\n]+/).map((s) => s.trim()).filter((s) => s.length > 2);
              if (splitted.length > 0) candidateServices.push(...splitted.filter(isLegitimateService));
            }
          }
        } catch (_) {}
      }

      // If still empty, dynamically crawl their actual site's published pages
      if (candidateServices.length === 0 && siteUrl) {
        try {
          const pagesRes = await fetch(`${siteUrl}/wp-json/wp/v2/pages?per_page=20&_fields=title,slug`);
          if (pagesRes.ok) {
            const pages = await pagesRes.json();
            const skipSlugs = /^(home|about|contact|privacy|terms|faq|cart|checkout|my-account|sample-page)$/i;
            for (const p of pages || []) {
              const title = (p?.title?.rendered || p?.slug || "").replace(/<[^>]+>/g, "").trim();
              if (title && title.length > 2 && !skipSlugs.test((p.slug || "").toLowerCase())) {
                candidateServices.push(title);
              }
            }
          }
        } catch (_) {}
      }

      // Dynamic fallback based on the user's specific business name & industry
      if (candidateServices.length === 0) {
        const ind = config.industry || businessName || "Commercial Growth";
        candidateServices = [
          `${ind} Core Services & Solutions`,
          `High-ROI Strategic ${ind}`,
          `Customer Acquisition & ${ind} Operations`,
          `Quality Excellence & Delivery in ${ind}`
        ];
      }

      let nextIndex = (Number(config.lastServiceIndex) || 0) + 1;
      if (nextIndex >= candidateServices.length) nextIndex = 0;
      const activeService = candidateServices[nextIndex] || `${businessName} Core Services`;
      const targetLocations = (config.targetLocations || config.targetMarket || "").trim();

      // 4.5 Fetch Existing Published WordPress Posts & Pages for Authentic Internal Linking
      let existingPublishedPosts = [];
      let existingPublishedPages = [];
      try {
        const [postsResp, pagesResp] = await Promise.all([
          fetch(`${siteUrl}/wp-json/wp/v2/posts?per_page=15&_fields=id,title,slug,link`, { headers: { Accept: "application/json" } }),
          fetch(`${siteUrl}/wp-json/wp/v2/pages?per_page=10&_fields=id,title,slug,link`, { headers: { Accept: "application/json" } })
        ]);
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
        if (pagesResp.ok) {
          const rawPages = await pagesResp.json();
          if (Array.isArray(rawPages)) {
            existingPublishedPages = rawPages.map((p) => ({
              id: p.id,
              title: typeof p.title === "object" ? p.title.rendered : p.title,
              link: p.link,
              slug: p.slug,
            })).filter((p) => p.link && p.title);
          }
        }
      } catch (e) {
        logger(`[SEO Autopilot] Note: Could not fetch existing published content (${e.message}).`);
      }

      // Filter out off-topic / junk articles if any
      const offTopicFilter = /santa|christmas|herbal-beauty/i;
      const relevantPublishedPosts = existingPublishedPosts.filter(p => !offTopicFilter.test(p.slug || p.title));
      const selectedInternalPosts = relevantPublishedPosts.length > 0 ? relevantPublishedPosts.slice(0, 8) : existingPublishedPosts.slice(0, 8);

      // 5. Generate Full SEO Article (STRICT 1,650+ words, 10 structured sections) via GPT-4o
      logger(`[SEO Autopilot] Generating exhaustive 1,650+ word SEO guide for "${activeService}" (${businessName})...`);
      const systemPrompt = `You are an elite commercial director, subject matter expert, and enterprise journalist writing for ${businessName} (${siteUrl}).
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
   - <h2>1. The Strategic Evolution of ${activeService} in 2026</h2> (At least 170 words across 2 detailed paragraphs explaining the modern landscape, industry discovery, and market shifts)
   - <h2>2. Core Foundations, Strategic Principles & Attribution Frameworks</h2> (At least 180 words detailing key methodologies, customer touchpoints, and operational mechanics)
   - <h2>3. High-Converting Campaign Architecture & Execution Systems</h2> (At least 200 words with actionable structural frameworks, audience modeling, and operational formulas)
   - <h2>4. Technology Infrastructure, Analytics & Conversion Mastery</h2> (At least 180 words detailing measurement, modern tooling, and service accuracy)
   - <h2>5. Omnichannel Growth Funnels & Audience Monetization</h2> (At least 180 words on cross-channel synergy, client retention, and ROI scaling)
   - <h2>6. In-Depth Real-World Case Study: 0 to 480% Revenue Acceleration</h2> (At least 220 words detailing baseline metrics, strategic interventions, and verified commercial gains)
   - <h2>7. Step-by-Step 90-Day Execution Playbook for Hyper-Growth</h2> (At least 220 words with Month 1, Month 2, Month 3 actionable sprints)
   - <h2>8. 5 Critical Pitfalls & Costly Strategic Mistakes to Avoid</h2> (At least 200 words detailing common misconceptions, operational errors, and actionable fixes)
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

4. MANDATORY INTERNAL HYPERLINKS (STRICT SPATIAL DISTRIBUTION - ZERO LINK DUMPING):
   CRITICAL MANDATE: You MUST embed 3 to 4 distinct internal hyperlinks to existing published blog articles from the catalog below, smoothly integrated into informative, explanatory sentences.

   STRICT SPATIAL DISTRIBUTION RULES:
   - Early Body (Section 2 or Section 3): Embed 1 contextual link to an existing related published article from the catalog below.
   - Mid Body (Section 4 or Section 5): Embed 1 contextual link to an existing related published article from the catalog below.
   - Mid-Late Body (Section 6 or Section 7): Embed 1 contextual link to an existing related published article from the catalog below.
   - Late Body (Section 8 or Section 9): Embed 1 contextual link to an existing related published article or solutions page.

   STRICT FORBIDDEN RULES (NO LAST PARAGRAPH CLUSTERING):
   - IT IS STRICTLY FORBIDDEN TO STUFF, CLUMP, OR DUMP INTERNAL LINKS INTO SECTION 10 (CONCLUSION) OR IN THE FINAL PARAGRAPH!
   - NO MORE THAN ONE internal link may appear in any single section.
   - NEVER dump multiple links next to each other.
   - Anchor Text Mandate: EVERY internal link MUST be integrated into a natural, flowing sentence with descriptive semantic anchor text describing the content. (Example: "As detailed in our breakdown of <a href="..." style="color: #f59e0b; font-weight: 700; text-decoration: underline;">high-performance Google Ads management</a>, attribution modeling is essential..."). NEVER use generic anchors like "Click Here", "Official Website", or "Services".

   CATALOG OF EXISTING PUBLISHED ARTICLES TO LINK TO:
${selectedInternalPosts.map((p) => `   * Title: "${p.title}" | Link: <a href="${p.link}" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">[Descriptive semantic anchor for "${p.title}"]</a>`).join("\n")}

5. MANDATORY 4+ SCATTERED EXTERNAL AUTHORITY LINKS (STRICT SPATIAL DISTRIBUTION & TOPIC RELEVANCE):
   You MUST embed AT LEAST 4 authoritative, topic-relevant, non-competing external links.
   CRITICAL RELEVANCE MANDATE: All 4 external links MUST be directly relevant to "${activeService}" and the specific industry of ${businessName} (e.g., for healthcare/medical: ADA, PubMed, WHO, WebMD; for real estate: NAR, Zillow Research, Urban Land Institute; for legal/finance: ABA, Forbes, Bloomberg, SEC; for eCommerce/retail: NRF, eMarketer, Statista; for engineering/construction: AGC, IEEE, ANSI; for B2B/technology/marketing: Gartner, McKinsey, HBR, Forrester, Search Engine Journal, W3C). NEVER use generic tech/SEO links for a healthcare, retail, or real estate business.
   
   CRITICAL SPATIAL DISTRIBUTION RULE: These links MUST BE SCATTERED across different parts of the article. It is STRICTLY FORBIDDEN to clump them together or put them only in the last 2 paragraphs or conclusion.
   
   Embed strictly across these sections:
   - Early Body (Section 1 or Section 2): 1 external link citing recognized market statistics, economic analysis, or industry shifts relevant to the business domain.
   - Mid-First Half (Section 3 or Section 4): 1 external link to an authoritative publication, professional association, or technical standard directly relevant to ${activeService}.
   - Mid-Second Half (Section 5 or Section 6): 1 external link to an authoritative commercial benchmark, industry index, or verified research study.
   - Late Body (Section 7 or Section 8): 1 external link to a credible professional guideline, safety/compliance standard, or recognized industry governing body.
   
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

      // Image 1: Hero Featured Image (Hierarchy: gpt-image-2 -> gpt-image-2-2026-04-21 -> gpt-image-1.5)
      const imageModels = ["gpt-image-2", "gpt-image-2-2026-04-21", "gpt-image-1.5"];
      const heroPrompt = `Award-winning commercial editorial hero illustration for blog article. Title: "${parsedArticle.title}". Subject: "${activeService}". Sleek modern studio lighting, 3D holographic digital accents, dark luxury slate aesthetics, high contrast, clean agency composition, pristine 4K quality, no text watermark.`;

      let heroBuffer = null;
      for (const modelName of imageModels) {
        try {
          logger(`[SEO Autopilot] Generating hero visual with ${modelName}...`);
          const heroRes = await openai.images.generate({
            model: modelName,
            prompt: heroPrompt,
            size: "1024x1024",
          });

          if (heroRes.data?.[0]?.b64_json) {
            heroBuffer = Buffer.from(heroRes.data[0].b64_json, "base64");
          } else if (heroRes.data?.[0]?.url) {
            const fetchRes = await fetch(heroRes.data[0].url);
            heroBuffer = Buffer.from(await fetchRes.arrayBuffer());
          }

          if (heroBuffer && heroBuffer.length > 0) {
            logger(`[SEO Autopilot] Successfully generated hero image via ${modelName}`);
            break;
          }
        } catch (imgErr) {
          logger(`[SEO Autopilot] Hero image gen with ${modelName} failed (${imgErr.message}), trying next approved model...`);
        }
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

      // Image 2: Secondary Mid-Article Architecture Diagram / Infographic
      const midPrompt = `Award-winning commercial editorial diagram graphic showing modern technical architecture, workflow flowcharts, and multi-channel attribution model for "${activeService}". Sleek dark luxury slate aesthetic, glowing cyan and warm amber accent lighting, clean geometric flow lines, 3D holographic analytics panels, high contrast, clean agency composition, pristine 4K quality, no text gibberish.`;

      let midBuffer = null;
      for (const modelName of imageModels) {
        try {
          logger(`[SEO Autopilot] Generating mid-article diagram with ${modelName}...`);
          const midRes = await openai.images.generate({
            model: modelName,
            prompt: midPrompt,
            size: "1024x1024",
          });

          if (midRes.data?.[0]?.b64_json) {
            midBuffer = Buffer.from(midRes.data[0].b64_json, "base64");
          } else if (midRes.data?.[0]?.url) {
            const fetchRes = await fetch(midRes.data[0].url);
            midBuffer = Buffer.from(await fetchRes.arrayBuffer());
          }

          if (midBuffer && midBuffer.length > 0) {
            logger(`[SEO Autopilot] Successfully generated mid-article diagram via ${modelName}`);
            break;
          }
        } catch (midErr) {
          logger(`[SEO Autopilot] Mid-article diagram gen with ${modelName} failed (${midErr.message}), trying next approved model...`);
        }
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

      // Enforce spatial internal link distribution & remove any final-paragraph link dumps
      finalContentHtml = enforceSpatialLinkDistribution(finalContentHtml, selectedInternalPosts, activeService);

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
      const { data: metaConn, error: metaErr } = await supabase
        .from("meta_connections")
        .select("fb_page_id, fb_page_access_token, fb_user_access_token, ig_business_id, instagram_actor_id")
        .ilike("email", item.email.trim())
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (metaErr) {
        logger(`[SEO Autopilot] Error querying meta_connections for ${item.email}: ${metaErr.message}`);
      }

      if (metaConn) {
        let pageToken = metaConn.fb_page_access_token;
        const userToken = metaConn.fb_user_access_token;
        const pageId = metaConn.fb_page_id ? metaConn.fb_page_id.split(",")[0].trim() : null;
        const igId = metaConn.ig_business_id || metaConn.instagram_actor_id;

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
