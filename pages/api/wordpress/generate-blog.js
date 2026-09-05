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
    // 4. Generate High-Ranking Blog Content & SEO Payload with GPT
    console.log(`[SEO Engine] Generating full ${wordCount}-word authority guide on "${topic}" for ${businessName}...`);

    const systemPrompt = `You are a world-class SEO content strategist and elite industry copywriter.
Generate an exhaustive, high-ranking, human-grade pillar guide optimized for Google SERP dominance and reader conversion.

CRITICAL LENGTH & DEPTH MANDATES:
1. STRICT WORD COUNT: You MUST write at least ${wordCount} words of comprehensive, in-depth content (target: ${wordCount} to ${wordCount + 400} words). Writing less than ${wordCount} words is a strict violation.
2. EXTENSIVE STRUCTURE:
   - Create at least 7 to 9 detailed <h2> sections.
   - Include 2 to 3 detailed <h3> subsections under major sections.
   - Every subsection must have 3 to 4 substantial, informative paragraphs (each paragraph 70-110 words).
   - NEVER provide a superficial summary or condensed overview.
3. ACTIONABLE FRAMEWORKS & EXAMPLES:
   - Detail step-by-step execution methodologies, operational playbooks, and ROI metrics.
   - Include an in-depth Real-World Case Study / Example Breakdown with specific numbers and strategy analysis.
   - Include a detailed Troubleshooting & Costly Mistakes to Avoid section.
   - Include an exhaustive FAQ Section with 4-5 high-value questions and multi-paragraph comprehensive answers.
4. KEYWORD & INTERNAL LINK INTEGRATION:
   - Keyword Strategy: ${keywordStrategyDirective}
   - Internal Links: Weave in 2-3 organic internal links using the following live pages from the user's site:
${existingLinksContext || "None available - write naturally without broken links"}
   - External Authority: Include 1-2 authoritative citations (e.g. Google Search Central, Statista, Harvard Business Review).
5. FORMATTING:
   - Use semantic HTML: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>.
   - DO NOT include <h1>, <html>, or <body> tags.
6. OUTPUT FORMAT:
   - Output MUST be strictly valid JSON matching the schema.`;

    const userPrompt = `Business: ${businessName}
Target Market / Scope: ${businessLocation}
Core Services / Industry: ${businessServices || industry}
Brand Voice: ${brandVoice}
Blog Topic / Headline: ${topic}
${keywordList ? `Target Ranked Keywords: ${keywordList}` : "Keywords: Automatically target high-volume commercial and topical ranking phrases."}
MANDATORY MINIMUM WORD COUNT: ${wordCount} Words.

Respond ONLY with a valid JSON object matching this schema:
{
  "title": "Compelling, high-ranking blog title",
  "slug": "keyword-rich-url-slug",
  "meta_title": "SEO Meta Title (max 60 chars)",
  "meta_description": "SEO Meta Description (max 155 chars)",
  "focus_keyword": "Primary target keyword",
  "secondary_keywords": ["ranked keyword 2", "ranked keyword 3", "ranked keyword 4"],
  "html_content": "Full exhaustive pillar article HTML (minimum ${wordCount} words)",
  "featured_image_prompt": "Specific visual scene prompt for the header hero banner",
  "featured_image_alt": "Descriptive SEO alt text for hero image",
  "mid_image_prompt": "Specific visual infographic prompt for the mid-content visual",
  "mid_image_alt": "Descriptive SEO alt text for mid visual"
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 4500,
      temperature: 0.7,
    });

    const parsedArticle = JSON.parse(completion.choices[0].message.content);

    // Multi-model AI Image Generator Helper (gpt-image-2, gpt-image-1.5, gpt-image-1)
    const generateAiVisual = async (promptText, label = "visual") => {
      const candidateModels = [
        process.env.OPENAI_IMAGE_MODEL,
        "gpt-image-2",
        "gpt-image-1.5",
        "gpt-image-1",
      ].filter(Boolean);

      for (const modelName of candidateModels) {
        try {
          console.log(`[SEO Engine] Generating ${label} image using model ${modelName}...`);
          const imgResp = await openai.images.generate({
            model: modelName,
            prompt: promptText,
            size: "1024x1024",
          });

          let imgBuffer = null;
          if (imgResp.data?.[0]?.b64_json) {
            imgBuffer = Buffer.from(imgResp.data[0].b64_json, "base64");
          } else if (imgResp.data?.[0]?.url) {
            const fetchRes = await fetch(imgResp.data[0].url);
            imgBuffer = Buffer.from(await fetchRes.arrayBuffer());
          }

          if (imgBuffer) {
            const fileName = `blog_${label}_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
            const { data: uploadData, error: uploadErr } = await supabase.storage
              .from("instagram-creatives")
              .upload(fileName, imgBuffer, { contentType: "image/png" });

            if (!uploadErr && uploadData) {
              const { data: pubUrl } = supabase.storage.from("instagram-creatives").getPublicUrl(fileName);
              console.log(`[SEO Engine] Uploaded ${label} to Supabase: ${pubUrl.publicUrl}`);
              return pubUrl.publicUrl;
            }
          }
        } catch (imgErr) {
          console.warn(`[SEO Engine] ${modelName} failed for ${label}:`, imgErr.message);
        }
      }
      return null;
    };

    // 4. Generate Visual #1: Featured Hero Banner
    let featuredImageUrl = null;
    try {
      featuredImageUrl = await generateAiVisual(
        `High-end commercial visual photograph or 3D graphic banner for a blog titled "${parsedArticle.title}". ${parsedArticle.featured_image_prompt || "Modern digital growth, high technology, vibrant lighting"}. Ultra-clean, modern, vibrant lighting, 4K quality, no text watermark.`,
        "featured"
      );
    } catch (e) {
      console.warn("Featured image generation error:", e.message);
    }

    // 5. Generate Visual #2: Mid-Article Conceptual Visual
    let midImageUrl = null;
    try {
      midImageUrl = await generateAiVisual(
        `Infographic style modern visual illustration explaining "${parsedArticle.title}". ${parsedArticle.mid_image_prompt || "Diagram of search traffic growth, return on investment, analytics"}. Clean geometric layout, soft shadows, vibrant accents, professional design.`,
        "mid"
      );
    } catch (e) {
      console.warn("Mid image generation error:", e.message);
    }

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
      console.log(`[SEO Engine] Word count (${actualWords}) below target (${wordCount}). Executing automatic enrichment & expansion pass...`);
      try {
        const expandResp = await openai.chat.completions.create({
          model: "gpt-4o",
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

    // 7. Push Live Article to WordPress via Plugin
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
