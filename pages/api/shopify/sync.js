// pages/api/shopify/sync.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getValidShopifyAccessToken } from "../../../lib/shopify/token-service";
import { getMetaIdentity, checkBrandMatch } from "../../../lib/meta/brand-verifier";
import { runShopifyAutopilotCycle } from "../../../lib/shopify/shopify-autopilot";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const maxDuration = 300;
export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: "25mb",
    },
  },
};

function getRelevantProductsForLinking(products = [], queryText = "", primaryDomain = "", maxCount = 8) {
  if (!Array.isArray(products) || products.length === 0) return [];

  const stopwords = new Set([
    "a", "an", "the", "and", "or", "but", "if", "because", "as", "what",
    "when", "where", "how", "all", "any", "both", "each", "few", "more",
    "most", "other", "some", "such", "no", "nor", "not", "only", "own",
    "same", "so", "than", "too", "very", "can", "will", "just", "should",
    "now", "in", "on", "at", "to", "for", "with", "by", "from", "about",
    "into", "through", "during", "before", "after", "above", "below",
    "of", "off", "over", "under", "again", "further", "then", "once",
    "here", "there", "why", "our", "your", "my", "their", "its", "is", "are"
  ]);

  const tokens = String(queryText || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.has(w));

  const scored = products.map((p) => {
    let score = 0;
    const titleLower = (p.title || "").toLowerCase();
    const tagsLower = (Array.isArray(p.tags) ? p.tags.join(" ") : String(p.tags || "")).toLowerCase();
    const typeLower = (p.product_type || "").toLowerCase();

    for (const token of tokens) {
      if (titleLower.includes(token)) score += 3;
      if (tagsLower.includes(token)) score += 2;
      if (typeLower.includes(token)) score += 2;
    }

    return {
      id: p.id,
      title: p.title,
      handle: p.handle,
      product_type: p.product_type,
      tags: p.tags,
      url: `https://${primaryDomain}/products/${p.handle}`,
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  let selected = scored.filter((p) => p.score > 0).slice(0, maxCount);

  if (selected.length < 5) {
    const selectedIds = new Set(selected.map((p) => p.id));
    for (const p of scored) {
      if (!selectedIds.has(p.id)) {
        selected.push(p);
        selectedIds.add(p.id);
        if (selected.length >= 6) break;
      }
    }
  }

  return selected;
}

function isProductInStock(p) {
  if (!p) return false;
  if (p.status && p.status !== "active") return false;

  const variants = p.variants;
  if (!Array.isArray(variants) || variants.length === 0) return true;

  // Product is available if any variant has continue policy, unmanaged inventory, or quantity > 0
  return variants.some((v) => {
    if (!v.inventory_management) return true;
    if (v.inventory_policy === "continue") return true;
    return typeof v.inventory_quantity === "number" && v.inventory_quantity > 0;
  });
}

function getFallbackEcommerceTopics(brandName = "Our Store", targetLoc = "", niche = "") {
  const locSuffix = targetLoc ? ` in ${targetLoc}` : "";
  const nicheName = niche || "Designer Jewellery & Accessories";
  return [
    `The Ultimate Guide to Styling ${nicheName}${locSuffix}: 2026 Trends`,
    `How to Choose the Perfect ${nicheName} for Special Occasions & Parties`,
    `Everyday Elegance: Transitioning Your Signature Look from Day to Night`,
    `The Complete Care and Maintenance Guide for Long-Lasting ${nicheName}`,
    `Top 10 ${nicheName} Pieces Every Modern Wardrobe Needs This Season`,
    `How to Pair Contemporary Outfits with Heritage & Traditional Pieces`,
    `Bridal & Wedding Guest Styling: The Definitive ${nicheName} Checklist${locSuffix}`,
    `Demystifying Metals & Stones: How to Identify Premium Quality Craftsmanship`,
    `Minimalist vs Statement Styling: How to Balance Your Ensemble Flawlessly`,
    `The Art of Layering: How to Stack Necklaces and Bracelets Like a Pro`,
    `Hypoallergenic & Sensitive Skin: Choosing Safe, High-Quality ${nicheName}`,
    `Gift Guide 2026: Meaningful & Memorable ${nicheName} for Every Loved One`,
    `Red Carpet Glamour: How to Achieve Luxury Celebrity Looks on Any Budget`,
    `Workplace Chic: Professional Yet Striking Accessories for the Office`,
    `Festive Season Spotlight: Curated Styling Tips for Celebrations${locSuffix}`,
    `Investment Pieces: Timeless Accessories That Retain Their Charm Over Decades`,
    `How to Clean and Store Fine Pieces Without Damaging Delicate Finishes`,
    `Color Psychology in Fashion: Choosing Pieces That Complement Your Skin Tone`,
    `Bespoke vs Ready-to-Wear: Finding Your Signature Personal Aesthetic`,
    `Weekend Casuals: Elevating T-Shirts and Denim with Strategic Accessories`,
    `The Modern Bride's Guide to Choosing Ceremony and Reception Pieces`,
    `Spring & Summer Style Forecast: The Hottest Trends Emerging in 2026`,
    `Autumn & Winter Layering: Incorporating Rich Tones and Ornate Textures`,
    `Behind the Craft: How Master Artisans Create Exquisite Handcrafted Designs`,
    `Sustainable & Ethical Fashion: Caring for Pieces That Last a Lifetime`,
    `Cocktail Hour Essentials: Standout Accessories That Spark Conversations`,
    `Airport & Vacation Styling: Chic, Travel-Friendly Pieces That Won't Tangle`,
    `How to Style Western Evening Gowns with Ethnic Statement Accents`,
    `Subtle Glamour: The Power of Delicate Studs and Understated Chains`,
    `The Definitive Guide to Anti-Tarnish Finishes and Plating Longevity`,
    `Graduation, Milestones & Promotions: Marking Life's Achievements in Style`,
    `Vintage Revival: How Classic Silhouettes are Dominating 2026 Runways`,
    `How to Organize Your Dressing Table & Keep Chains from Tangling`,
    `Neckline Masterclass: Matching Pendants and Chokers to Your Dress Cut`,
    `Earring Guide: Selecting Shapes That Flatter Your Unique Face Structure`,
    `Ring Stacking Secrets: Creating Harmonious Combinations Across Fingers`,
    `The Power of Pearls and Gemstones: Symbolism, Energy, and Styling`,
    `How to Avoid Over-Accessorizing: The Rule of Three in Modern Fashion`,
    `Seasonal Transitions: Refreshing Your Look Between Warm and Cold Weather`,
    `Mother's Day & Anniversary Gifts: Curated Highlights She Will Cherish`,
    `Modern Bohemian Chic: How to Incorporate Earthy and Eclectic Textures`,
    `Monochrome Dressing: Adding Depth with Contrasting Metallic Highlights`,
    `Destination Wedding Survival Guide: Packing and Caring for Your Outfits`,
    `The Evolution of London and Global Streetwear: Blending Luxury with Comfort`,
    `Confidence Through Styling: How the Right Piece Transforms Your Presence`
  ];
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const userEmail = session?.user?.email || req.body?.userEmail || req.query?.userEmail;

  if (!userEmail) {
    return res.status(401).json({ ok: false, error: "Unauthorized: Please log in" });
  }

  const payload = req.method === "POST" ? (req.body || {}) : (req.query || {});
  const { action = "get-connection" } = payload;

  try {
    // ---------------------------------------------------------
    // 1. GET CONNECTION
    // ---------------------------------------------------------
    if (action === "get-connection") {
      const { data: mem, error } = await supabase
        .from("agent_memory")
        .select("content, updated_at")
        .eq("email", userEmail)
        .eq("memory_type", "shopify_connection")
        .maybeSingle();

      if (error) {
        console.error("Error fetching shopify connection:", error);
        return res.status(500).json({ ok: false, error: error.message });
      }

      if (!mem?.content) {
        return res.status(200).json({ ok: true, connected: false });
      }

      const parsed = typeof mem.content === "string" ? JSON.parse(mem.content) : mem.content;
      return res.status(200).json({
        ok: true,
        connected: true,
        connection: {
          shop: parsed.shop,
          myshopify_domain: parsed.myshopify_domain,
          domain: parsed.domain,
          shopName: parsed.shopName,
          currency: parsed.currency,
          country: parsed.country,
          connected_at: parsed.connected_at || mem.updated_at,
        },
      });
    }

    // ---------------------------------------------------------
    // 2. DISCONNECT
    // ---------------------------------------------------------
    if (action === "disconnect") {
      const { error: delErr } = await supabase
        .from("agent_memory")
        .delete()
        .eq("email", userEmail)
        .eq("memory_type", "shopify_connection");

      if (delErr) {
        return res.status(500).json({ ok: false, error: delErr.message });
      }

      return res.status(200).json({ ok: true, message: "Shopify store disconnected successfully." });
    }

    // ---------------------------------------------------------
    // 2.5 CONNECT VIA DIRECT ACCESS TOKEN (ALTERNATIVE TO OAUTH)
    // ---------------------------------------------------------
    if (action === "connect-token") {
      let rawShop = payload.shop;
      const rawToken = payload.accessToken;

      if (!rawShop || !rawToken) {
        return res.status(400).json({ ok: false, error: "Missing Shopify store domain or Access Token." });
      }

      let shop = String(rawShop).trim().toLowerCase();
      if (shop.includes("admin.shopify.com/store/")) {
        const match = shop.match(/admin\.shopify\.com\/store\/([a-zA-Z0-9\-]+)/);
        if (match && match[1]) shop = `${match[1]}.myshopify.com`;
      } else {
        shop = shop.replace(/^https?:\/\//, "").replace(/\/+$/, "").split("/")[0];
        if (!shop.includes(".")) shop = `${shop}.myshopify.com`;
      }

      const tokenClean = String(rawToken).trim();

      // Verify token with shopify shop.json
      let shopDetails = {};
      try {
        const testRes = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
          headers: {
            "X-Shopify-Access-Token": tokenClean,
            "Content-Type": "application/json",
          },
        });

        if (!testRes.ok) {
          const errBody = await testRes.text();
          return res.status(400).json({
            ok: false,
            error: `Could not verify access token with ${shop}. Please ensure the token is correct and has Admin API permissions.`,
          });
        }

        const testData = await testRes.json();
        shopDetails = testData.shop || {};
      } catch (netErr) {
        return res.status(500).json({ ok: false, error: `Network error reaching ${shop}: ${netErr.message}` });
      }

      const connectionPayload = {
        shop,
        myshopify_domain: shopDetails.myshopify_domain || shop,
        domain: shopDetails.domain || shop,
        shopName: shopDetails.name || shop.replace(".myshopify.com", ""),
        shopEmail: shopDetails.email || "",
        currency: shopDetails.currency || "USD",
        country: shopDetails.country_name || "",
        access_token: tokenClean,
        scope: "read_content,write_content,read_products,write_products",
        connected_at: new Date().toISOString(),
        primary_domain: shopDetails.domain || shop,
        connection_type: "custom_app_token",
      };

      const { error: dbErr } = await supabase.from("agent_memory").upsert(
        {
          email: userEmail,
          memory_type: "shopify_connection",
          content: JSON.stringify(connectionPayload),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email,memory_type" }
      );

      if (dbErr) {
        return res.status(500).json({ ok: false, error: "Database error: " + dbErr.message });
      }

      return res.status(200).json({
        ok: true,
        message: "Shopify store paired successfully!",
        connection: connectionPayload,
      });
    }

    // Retrieve active connection for authenticated actions below
    const { data: mem } = await supabase
      .from("agent_memory")
      .select("content")
      .eq("email", userEmail)
      .eq("memory_type", "shopify_connection")
      .maybeSingle();

    if (!mem?.content) {
      return res.status(400).json({ ok: false, error: "No Shopify store connected." });
    }

    const conn = typeof mem.content === "string" ? JSON.parse(mem.content) : mem.content;
    const { shop } = conn;
    const accessToken = await getValidShopifyAccessToken(conn, userEmail, supabase);

    if (!shop || !accessToken) {
      return res.status(400).json({ ok: false, error: "Shopify connection credentials invalid or missing." });
    }

    // ---------------------------------------------------------
    // 3. LIST BLOGS
    // ---------------------------------------------------------
    if (action === "list-blogs") {
      const resp = await fetch(`https://${shop}/admin/api/2024-01/blogs.json`, {
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
      });

      if (!resp.ok) {
        const txt = await resp.text();
        return res.status(resp.status).json({ ok: false, error: `Shopify Blogs API Error: ${txt}` });
      }

      const data = await resp.json();
      let blogs = data.blogs || [];

      // If store has no blog channel created yet, automatically create default "News" channel
      if (blogs.length === 0) {
        try {
          const createBlogRes = await fetch(`https://${shop}/admin/api/2024-01/blogs.json`, {
            method: "POST",
            headers: {
              "X-Shopify-Access-Token": accessToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              blog: { title: "News", commentable: "no" },
            }),
          });
          if (createBlogRes.ok) {
            const createdData = await createBlogRes.json();
            if (createdData?.blog) {
              blogs = [createdData.blog];
            }
          }
        } catch (e) {
          console.warn("Could not auto-create blog:", e);
        }
      }

      // Augment each blog with its article count
      const blogsWithCounts = await Promise.all(
        blogs.map(async (b) => {
          try {
            const countRes = await fetch(`https://${shop}/admin/api/2024-01/blogs/${b.id}/articles/count.json`, {
              headers: {
                "X-Shopify-Access-Token": accessToken,
                "Content-Type": "application/json",
              },
            });
            if (countRes.ok) {
              const cData = await countRes.json();
              return { ...b, article_count: cData.count ?? 0 };
            }
          } catch (cErr) {
            // ignore
          }
          return { ...b, article_count: 0 };
        })
      );

      return res.status(200).json({ ok: true, blogs: blogsWithCounts });
    }

    // ---------------------------------------------------------
    // 3.5 LIST ALL ARTICLES ACROSS BLOGS
    // ---------------------------------------------------------
    if (action === "list-articles") {
      try {
        const blogResp = await fetch(`https://${shop}/admin/api/2024-01/blogs.json`, {
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
        });
        const blogData = blogResp.ok ? await blogResp.json() : { blogs: [] };
        const allBlogs = blogData.blogs || [];

        let allArticles = [];
        const primaryDomain = conn.domain || conn.primary_domain || conn.myshopify_domain || shop;

        await Promise.all(
          allBlogs.map(async (b) => {
            try {
              const artResp = await fetch(
                `https://${shop}/admin/api/2024-01/blogs/${b.id}/articles.json?limit=50&fields=id,title,handle,published_at,created_at,author,image,tags,summary_html,body_html`,
                {
                  headers: {
                    "X-Shopify-Access-Token": accessToken,
                    "Content-Type": "application/json",
                  },
                }
              );
              if (artResp.ok) {
                const artData = await artResp.json();
                const items = (artData.articles || []).map((art) => ({
                  ...art,
                  blog_id: b.id,
                  blog_title: b.title,
                  blog_handle: b.handle,
                  live_url: `https://${primaryDomain}/blogs/${b.handle}/${art.handle}`,
                }));
                allArticles = allArticles.concat(items);
              }
            } catch (aErr) {
              console.warn(`Error fetching articles for blog ${b.id}:`, aErr);
            }
          })
        );

        // Sort descending by published_at / created_at
        allArticles.sort((a, b) => new Date(b.published_at || b.created_at) - new Date(a.published_at || a.created_at));

        return res.status(200).json({ ok: true, articles: allArticles, total: allArticles.length });
      } catch (err) {
        return res.status(500).json({ ok: false, error: "Failed to list articles: " + err.message });
      }
    }

    // ---------------------------------------------------------
    // 4. LIST PRODUCTS
    // ---------------------------------------------------------
    if (action === "list-products") {
      const requestedLimit = Number(payload.limit || req.query.limit) || 250;
      let allProducts = [];
      const fetchLimit = Math.min(requestedLimit, 250);
      const initialUrl = `https://${shop}/admin/api/2024-01/products.json?limit=${fetchLimit}&fields=id,title,body_html,vendor,product_type,handle,images,variants,tags,status`;

      const resp = await fetch(initialUrl, {
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
      });

      if (!resp.ok) {
        const txt = await resp.text();
        return res.status(resp.status).json({ ok: false, error: `Shopify Products API Error: ${txt}` });
      }

      const data = await resp.json();
      allProducts = data.products || [];

      // If user requested more than 250 or there are next pages, follow Shopify link headers
      let linkHeader = resp.headers.get("link");
      while (linkHeader && linkHeader.includes('rel="next"') && allProducts.length < requestedLimit) {
        const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        if (!match || !match[1]) break;
        const nextFetch = await fetch(match[1], {
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
        });
        if (!nextFetch.ok) break;
        const nextData = await nextFetch.json();
        if (!nextData.products || nextData.products.length === 0) break;
        allProducts = allProducts.concat(nextData.products);
        linkHeader = nextFetch.headers.get("link");
      }

      return res.status(200).json({ ok: true, products: allProducts, total: allProducts.length });
    }

    // ---------------------------------------------------------
    // 5. GENERATE AI PRODUCT DESCRIPTION (SEO OPTIMIZED)
    // ---------------------------------------------------------
    if (action === "generate-product-description") {
      const {
        title,
        currentDescription = "",
        category = "",
        vendor = "",
        keywords = "",
        tone = "luxury, persuasive, and conversion-focused",
      } = payload;

      if (!title) {
        return res.status(400).json({ ok: false, error: "Product title is required." });
      }

      const prompt = `You are a world-class luxury ecommerce copywriter and SEO specialist.
Write a comprehensive, high-converting product listing for the following product:

PRODUCT TITLE: ${title}
VENDOR/BRAND: ${vendor || conn.shopName || "Brand"}
CATEGORY: ${category || "General"}
TARGET KEYWORDS: ${keywords || title}
DESIRED TONE: ${tone}
CURRENT / RAW DESCRIPTION: ${currentDescription.substring(0, 1000)}

Your output MUST be in valid JSON format only, matching this structure:
{
  "seoTitle": "A catchy, keyword-rich SEO title under 60 characters for Google search preview",
  "seoDescription": "A compelling meta description between 145 and 155 characters with a clear hook, benefit, and call-to-action",
  "bodyHtml": "Rich HTML for the product description containing:
    1. A punchy 1-2 sentence hook paragraph highlighting the unique value proposition.
    2. <h3>Why You'll Love It</h3> followed by a <ul> list of 4-5 key benefits with <strong>Bold Benefit Titles</strong>.
    3. <h3>Specifications & Features</h3> followed by clean list or table of specs/materials.
    4. <h3>Frequently Asked Questions</h3> with 2 realistic Q&As that eliminate buying hesitation.
    Use clean, modern, semantic HTML (<h3>, <p>, <ul>, <li>, <strong>). Do NOT wrap in markdown code blocks.",
  "suggestedTags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}

Respond ONLY with the raw JSON object. Do not include markdown code block backticks.`;

      let aiResult = null;

      // Try OpenAI first, fallback to Gemini
      if (process.env.OPENAI_API_KEY) {
        try {
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          const comp = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.7,
          });
          aiResult = JSON.parse(comp.choices[0]?.message?.content || "{}");
        } catch (e) {
          console.warn("OpenAI product desc generation fallback:", e.message);
        }
      }

      if (!aiResult && process.env.GEMINI_API_KEY) {
        try {
          const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
          const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
          const res = await model.generateContent(prompt);
          const text = res.response.text().replace(/```json/gi, "").replace(/```/g, "").trim();
          aiResult = JSON.parse(text);
        } catch (geminiErr) {
          console.error("Gemini product desc generation failed:", geminiErr);
        }
      }

      if (!aiResult || !aiResult.bodyHtml) {
        return res.status(500).json({ ok: false, error: "Failed to generate AI product description." });
      }

      return res.status(200).json({
        ok: true,
        generated: aiResult,
      });
    }

    // ---------------------------------------------------------
    // 5.5 GENERATE AI ECOMMERCE SEO BLOG ARTICLE (1,500+ WORDS)
    // ---------------------------------------------------------
    if (action === "generate-blog") {
      const {
        topic,
        keywords = "",
        targetLocations = "",
        tone = "engaging, authoritative, and conversion-focused",
        brandName = conn.shopName || "Our Store",
      } = payload;

      if (!topic) {
        return res.status(400).json({ ok: false, error: "Blog topic is required." });
      }

      // 1. Fetch store products to identify candidate pieces for internal linking
      let storeProducts = [];
      try {
        const prodResp = await fetch(
          `https://${shop}/admin/api/2024-01/products.json?limit=250&fields=id,title,handle,product_type,tags,variants,status`,
          {
            headers: {
              "X-Shopify-Access-Token": accessToken,
              "Content-Type": "application/json",
            },
          }
        );
        if (prodResp.ok) {
          const pData = await prodResp.json();
          const rawProducts = pData.products || [];
          // EXCLUDE SOLD-OUT AND INACTIVE PRODUCTS (ONLY LINK IN-STOCK PRODUCTS)
          storeProducts = rawProducts.filter(isProductInStock);
        }
      } catch (pErr) {
        console.warn("Could not fetch products for blog internal linking:", pErr.message);
      }

      const primaryDomain = conn.domain || conn.primary_domain || conn.myshopify_domain || shop;
      const candidateProducts = getRelevantProductsForLinking(
        storeProducts,
        `${topic} ${keywords}`,
        primaryDomain,
        8
      );

      const candidateProductsText = candidateProducts.length > 0
        ? candidateProducts.map((p, idx) => `${idx + 1}. Title: "${p.title}" | Direct Link: "${p.url}"`).join("\n")
        : "";

      const blogPrompt = `You are a world-class eCommerce SEO copywriter and lifestyle content strategist for "${brandName}".
Write an in-depth, authoritative, and engaging 1,500+ word eCommerce blog article optimized for Google rank and product conversion.

TOPIC: ${topic}
TARGET KEYWORDS: ${keywords || topic}
BRAND NAME: ${brandName}
TONE: ${tone}
STORE DOMAIN: ${primaryDomain}
${targetLocations ? `
TARGET GEOGRAPHIC MARKET MANDATE (COUNTRIES & CITIES):
The eCommerce brand is actively targeting shoppers and customers in: "${targetLocations}".
- Deeply tailor recommendations, regional climate and styling factors, seasonal context, and shopping habits specifically to audiences in (${targetLocations}).
- Naturally incorporate localized references, regional terminology, and city or country mentions of ${targetLocations} within styling tips, subheadings, and FAQ sections.
` : ""}

${candidateProductsText ? `
MANDATORY INTERNAL PRODUCT LINKING REQUIREMENTS (CRITICAL ECOMMERCE CONVERSION ENGINE):
You MUST organically interlink AT LEAST 4 to 5 relevant products from this store into the article body HTML.
Available Store Products to Interlink:
${candidateProductsText}

CRITICAL RULES FOR INTERNAL PRODUCT LINKS:
1. In-Text Mentions: Embed at least 3-4 clickable product links naturally within styling recommendations, accessorizing paragraphs, or outfit breakdowns using standard HTML anchor tags:
   <a href="EXACT_PRODUCT_URL" title="Product Title" target="_blank" rel="noopener noreferrer">Descriptive Anchor Text or Product Name</a>
   (Never use generic "click here" or "check this out". Use descriptive anchor text, e.g. "...pair this look with an ornate <a href=\"EXACT_URL\">Product Name</a> for timeless elegance...")
2. Dedicated "Curated Store Highlights / Featured Pieces" Section:
   Near the conclusion or after the main styling guide, include a dedicated <h3>Curated Store Highlights / Featured Pieces</h3> or <h3>Shop the Story</h3> callout block featuring 4 to 5 of these products with direct links and 1-sentence reasons why each piece completes the ensemble.
3. Strict URL Precision: Only use the EXACT product URLs provided above. Do NOT modify the URL path or invent imaginary links.
` : ""}

MANDATORY LENGTH & COMPREHENSIVE SECTION STRUCTURE (MUST BE 1,500+ WORDS):
You MUST write an extensive, publication-grade editorial article (1,500+ words). Develop at least 6 substantial sections with 2-3 detailed paragraphs each, covering:
- Immersive introduction & cultural / style trends (250+ words).
- Essential styling rules and outfit coordination (250+ words).
- Day-to-night styling transitions and accessorizing secrets (250+ words).
- Material craftsmanship, hypoallergenic metal alloys, and durability (250+ words).
- Curated Store Highlights & Signature Pieces featuring our linked products (300+ words).
- Comprehensive Frequently Asked Questions with 4 detailed Q&As (250+ words).
- Concluding styling verdict & inspiring Call to Action (150+ words).
Do NOT write short overviews or shallow summaries. Provide rich, actionable, editorial paragraphs.

ARTICLE REQUIREMENTS:
1. Compelling H1 Title incorporating primary keywords.
2. Hook paragraph capturing attention and addressing shopper desires or problems.
3. 5-6 detailed sections with clear <h2> and <h3> subheadings providing practical guides, styling advice, or solutions.
4. Curated shopping tips and recommendations linking value directly back to the store's catalog.
5. <h3>Frequently Asked Questions</h3> with 3 clear, schema-ready Q&As.
6. Engaging conclusion with a strong Call to Action (CTA).
7. Pure semantic HTML formatting (<h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <blockquote>).
8. Provide calibrated SEO Meta Title (50-60 characters) and Meta Description (145-155 characters).

Respond ONLY with a valid JSON object matching this schema:
{
  "title": "Full Article Title",
  "seoTitle": "Calibrated SEO Title under 60 characters",
  "seoDescription": "Compelling Meta Description between 145-155 chars",
  "bodyHtml": "<p>Article HTML content with internal product links...</p>",
  "tags": ["keyword1", "keyword2", "keyword3"]
}
Do NOT include markdown code block backticks.`;

      // Run Text Generation and Image Generation in Parallel for minimum latency
      const textPromise = (async () => {
        let result = null;
        if (process.env.OPENAI_API_KEY) {
          try {
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const comp = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: blogPrompt }],
              response_format: { type: "json_object" },
              max_tokens: 4096,
              temperature: 0.7,
            });
            result = JSON.parse(comp.choices[0]?.message?.content || "{}");
          } catch (e) {
            console.warn("OpenAI blog generation fallback:", e.message);
          }
        }

        if (!result && process.env.GEMINI_API_KEY) {
          try {
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const res = await model.generateContent(blogPrompt);
            const text = res.response.text().replace(/```json/gi, "").replace(/```/g, "").trim();
            result = JSON.parse(text);
          } catch (geminiErr) {
            console.error("Gemini blog generation failed:", geminiErr);
          }
        }
        return result;
      })();

      const imagePromise = (async () => {
        let imageBase64 = null;
        let imageUrl = null;

        if (process.env.OPENAI_API_KEY) {
          try {
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const imagePrompt = `Ultra-realistic cinematic editorial lifestyle commercial photograph for eCommerce article about "${topic}". High fashion luxury aesthetic, 8k professional studio lighting, depth of field, award-winning shot, clean product styling.`;
            const imgGen = await openai.images.generate({
              model: "gpt-image-2",
              prompt: imagePrompt,
              size: "1024x1024",
            });
            if (imgGen.data?.[0]?.b64_json) {
              imageBase64 = imgGen.data[0].b64_json;
              // Upload to Supabase Storage bucket so client can pass lightweight URL instead of 2MB payload
              try {
                const imgBuffer = Buffer.from(imageBase64, "base64");
                const imgFileName = `shopify-blog-${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
                const { error: upErr } = await supabase.storage.from("instagram-creatives").upload(imgFileName, imgBuffer, {
                  contentType: "image/png",
                  upsert: true,
                });
                if (!upErr) {
                  const { data: pubData } = supabase.storage.from("instagram-creatives").getPublicUrl(imgFileName);
                  if (pubData?.publicUrl) {
                    imageUrl = pubData.publicUrl;
                  }
                }
              } catch (storageErr) {
                console.warn("Could not upload blog hero image to Supabase storage:", storageErr.message);
              }
            } else if (imgGen.data?.[0]?.url) {
              imageUrl = imgGen.data[0].url;
            }
          } catch (imgErr) {
            console.warn("gpt-image-2 generation failed:", imgErr.message);
          }
        }
        return { imageBase64, imageUrl };
      })();

      const [textResSettled, imgResSettled] = await Promise.allSettled([textPromise, imagePromise]);
      const aiResult = textResSettled.status === "fulfilled" && textResSettled.value ? textResSettled.value : null;
      const imgResult = imgResSettled.status === "fulfilled" && imgResSettled.value ? imgResSettled.value : { imageBase64: null, imageUrl: null };

      if (!aiResult || !aiResult.title) {
        return res.status(500).json({
          ok: false,
          error: "AI failed to generate article content. Please check your topic and try again.",
        });
      }

      return res.status(200).json({
        ok: true,
        generated: {
          ...aiResult,
          imageBase64: imgResult.imageBase64,
          imageUrl: imgResult.imageUrl,
        },
      });
    }

    // ---------------------------------------------------------
    // 6. UPDATE PRODUCT ON SHOPIFY (LIVE PUSH)
    // ---------------------------------------------------------
    if (action === "update-product") {
      const { productId, bodyHtml, tags, seoTitle, seoDescription } = payload;
      if (!productId) {
        return res.status(400).json({ ok: false, error: "Product ID is required." });
      }

      const productUpdatePayload = {};
      if (bodyHtml !== undefined) productUpdatePayload.body_html = bodyHtml;
      if (tags !== undefined) {
        productUpdatePayload.tags = Array.isArray(tags) ? tags.join(", ") : String(tags);
      }

      // Update product body & tags
      const updateResp = await fetch(`https://${shop}/admin/api/2024-01/products/${productId}.json`, {
        method: "PUT",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ product: productUpdatePayload }),
      });

      if (!updateResp.ok) {
        const txt = await updateResp.text();
        return res.status(updateResp.status).json({ ok: false, error: `Shopify Update Error: ${txt}` });
      }

      const updatedProductData = await updateResp.json();

      // Update SEO Title & Meta Description via Metafields if provided
      if (seoTitle || seoDescription) {
        try {
          if (seoTitle) {
            await fetch(`https://${shop}/admin/api/2024-01/products/${productId}/metafields.json`, {
              method: "POST",
              headers: {
                "X-Shopify-Access-Token": accessToken,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                metafield: {
                  namespace: "global",
                  key: "title_tag",
                  value: String(seoTitle).trim(),
                  type: "single_line_text_field",
                },
              }),
            });
          }

          if (seoDescription) {
            await fetch(`https://${shop}/admin/api/2024-01/products/${productId}/metafields.json`, {
              method: "POST",
              headers: {
                "X-Shopify-Access-Token": accessToken,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                metafield: {
                  namespace: "global",
                  key: "description_tag",
                  value: String(seoDescription).trim(),
                  type: "multi_line_text_field",
                },
              }),
            });
          }
        } catch (metaErr) {
          console.warn("Non-fatal metafield SEO tag error:", metaErr.message);
        }
      }

      return res.status(200).json({
        ok: true,
        message: "Shopify product updated successfully!",
        product: updatedProductData.product,
      });
    }

    // ---------------------------------------------------------
    // 6.5 OPTIMIZE EXISTING BLOG ARTICLE (SEO REWRITE & UPGRADE)
    // ---------------------------------------------------------
    if (action === "optimize-article") {
      const {
        articleId,
        blogId,
        title,
        currentBody = "",
        keywords = "",
        tone = "luxury, persuasive, and SEO-optimized",
        targetLocations = "",
      } = payload;

      if (!title) {
        return res.status(400).json({ ok: false, error: "Article title is required." });
      }

      // Fetch store products to identify candidate pieces for internal linking
      let storeProducts = [];
      try {
        const prodResp = await fetch(
          `https://${shop}/admin/api/2024-01/products.json?limit=250&fields=id,title,handle,product_type,tags,variants,status`,
          {
            headers: {
              "X-Shopify-Access-Token": accessToken,
              "Content-Type": "application/json",
            },
          }
        );
        if (prodResp.ok) {
          const pData = await prodResp.json();
          const rawProducts = pData.products || [];
          // EXCLUDE SOLD-OUT AND INACTIVE PRODUCTS (ONLY LINK IN-STOCK PRODUCTS)
          storeProducts = rawProducts.filter(isProductInStock);
        }
      } catch (pErr) {
        console.warn("Could not fetch products for optimize-article internal linking:", pErr.message);
      }

      const primaryDomain = conn.domain || conn.primary_domain || conn.myshopify_domain || shop;
      const candidateProducts = getRelevantProductsForLinking(
        storeProducts,
        `${title} ${keywords} ${currentBody.slice(0, 400)}`,
        primaryDomain,
        8
      );

      const candidateProductsText = candidateProducts.length > 0
        ? candidateProducts.map((p, idx) => `${idx + 1}. Title: "${p.title}" | Direct Link: "${p.url}"`).join("\n")
        : "";

      const prompt = `You are a world-class luxury eCommerce content strategist, copywriter, and SEO specialist.
You are tasked with thoroughly optimizing, upgrading, and rewriting an EXISTING blog article for an eCommerce brand.

EXISTING ARTICLE TITLE: ${title}
STORE/BRAND NAME: ${conn.shopName || "Brand"}
TARGET SEO KEYWORDS: ${keywords || title}
DESIRED TONE: ${tone}
TARGET GEOGRAPHIC LOCATIONS: ${targetLocations || "Global / Worldwide"}
STORE DOMAIN: ${primaryDomain}

EXISTING ARTICLE CONTENT / DRAFT:
${String(currentBody).substring(0, 3000)}

${candidateProductsText ? `
MANDATORY INTERNAL PRODUCT LINKING REQUIREMENTS (ECOMMERCE CONVERSION ENGINE):
You MUST organically interlink AT LEAST 4 to 5 relevant products from this store into the updated article body HTML.
Available Store Products to Interlink:
${candidateProductsText}

CRITICAL RULES FOR INTERNAL PRODUCT LINKS:
1. In-Text Mentions: Embed at least 3-4 clickable product links naturally within styling recommendations, accessorizing paragraphs, or outfit breakdowns using standard HTML anchor tags:
   <a href="EXACT_PRODUCT_URL" title="Product Title" target="_blank" rel="noopener noreferrer">Descriptive Anchor Text or Product Name</a>
   (Never use generic "click here" or "check this out". Use descriptive anchor text, e.g. "...pair this look with an ornate <a href=\"EXACT_URL\">Product Name</a> for timeless elegance...")
2. Dedicated "Curated Store Highlights / Featured Pieces" Section:
   Near the conclusion or after the main styling guide, include a dedicated <h3>Curated Store Highlights / Featured Pieces</h3> or <h3>Shop the Story</h3> callout block featuring 4 to 5 of these products with direct links and 1-sentence reasons why each piece completes the ensemble.
3. Strict URL Precision: Only use the EXACT product URLs provided above. Do NOT modify the URL path or invent imaginary links.
` : ""}

YOUR MISSION:
1. Elevate the title to be irresistible, click-worthy, and optimized for search engine ranking (under 70 chars).
2. Rewrite and dramatically expand the article body to a comprehensive, publication-grade 1,400+ words:
   - An engaging, high-retention introduction hook.
   - At least 5-6 substantial sections with rich semantic subheadings (<h2>, <h3>).
   - Deep styling advice, product pairing suggestions, and valuable consumer insights.
   - Natural incorporation of the target keywords: "${keywords || title}".
   - Natural references to the target market: "${targetLocations || "Global"}".
   - Organic internal product links to 4-5 store products with exact URLs.
   - A dedicated <h3>Curated Store Highlights / Featured Pieces</h3> section with direct links to the matched store products.
   - A dedicated <h3>Frequently Asked Questions</h3> section with 3-4 practical Q&As.
   - A concluding call-to-action encouraging readers to browse the store's curated collections.
3. Provide a concise, high-CTR meta summary (under 160 characters).
4. Provide 4-6 relevant SEO tags.

OUTPUT FORMAT:
Respond ONLY with a valid JSON object matching this structure:
{
  "optimizedTitle": "A captivating, high-ranking SEO article title",
  "summaryHtml": "A compelling meta description under 160 characters",
  "bodyHtml": "Rich semantic HTML using <p>, <h2>, <h3>, <ul>, <li>, <strong>. No markdown code blocks.",
  "suggestedTags": ["tag1", "tag2", "tag3", "tag4"]
}`;

      let aiResult = null;
      if (process.env.OPENAI_API_KEY) {
        try {
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          const comp = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            max_tokens: 4096,
            temperature: 0.7,
          });
          aiResult = JSON.parse(comp.choices[0]?.message?.content || "{}");
        } catch (e) {
          console.warn("OpenAI article optimization fallback:", e.message);
        }
      }

      if (!aiResult || !aiResult.bodyHtml) {
        return res.status(500).json({ ok: false, error: "Failed to generate optimized article content." });
      }

      return res.status(200).json({
        ok: true,
        optimized: aiResult,
      });
    }

    // ---------------------------------------------------------
    // 6.6 PUSH UPDATED ARTICLE LIVE TO SHOPIFY
    // ---------------------------------------------------------
    if (action === "update-article") {
      const {
        articleId,
        blogId,
        title,
        bodyHtml,
        summaryHtml = "",
        tags = "",
      } = payload;

      if (!articleId || !blogId || !title || !bodyHtml) {
        return res.status(400).json({ ok: false, error: "Article ID, Blog ID, Title, and Article HTML are required." });
      }

      const updatePayload = {
        id: articleId,
        title,
        body_html: bodyHtml,
        summary_html: summaryHtml,
        tags: Array.isArray(tags) ? tags.join(", ") : tags,
      };

      const updateResp = await fetch(
        `https://${shop}/admin/api/2024-01/blogs/${blogId}/articles/${articleId}.json`,
        {
          method: "PUT",
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ article: updatePayload }),
        }
      );

      if (!updateResp.ok) {
        const txt = await updateResp.text();
        return res.status(updateResp.status).json({ ok: false, error: `Shopify Article Update Error: ${txt}` });
      }

      const updatedArticleData = await updateResp.json();
      return res.status(200).json({
        ok: true,
        message: "Article updated successfully on Shopify!",
        article: updatedArticleData.article,
      });
    }

    // ---------------------------------------------------------
    // 7. PUBLISH BLOG ARTICLE TO SHOPIFY
    // ---------------------------------------------------------
    if (action === "publish-blog") {
      const {
        blogId,
        title,
        bodyHtml,
        author = "GabbarInfo AI",
        tags = "",
        isDraft = false,
        imageUrl = null,
        imageBase64 = null,
        summaryHtml = "",
      } = payload;

      if (!blogId || !title || !bodyHtml) {
        return res.status(400).json({ ok: false, error: "Blog ID, Title, and Article HTML are required." });
      }

      const articlePayload = {
        title,
        body_html: bodyHtml,
        author,
        tags: Array.isArray(tags) ? tags.join(", ") : tags,
        published: !isDraft,
      };

      if (summaryHtml) {
        articlePayload.summary_html = summaryHtml;
      }

      // Attach high-res AI featured hero image (base64 or url)
      if (imageBase64) {
        articlePayload.image = {
          attachment: imageBase64,
          alt: title,
        };
      } else if (imageUrl) {
        articlePayload.image = {
          src: imageUrl,
          alt: title,
        };
      } else if (process.env.OPENAI_API_KEY) {
        try {
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          const imagePrompt = `Ultra-realistic cinematic editorial lifestyle commercial photograph for article titled "${title}". High fashion luxury aesthetic, 8k professional studio lighting.`;
          const imgGen = await openai.images.generate({
            model: "gpt-image-2",
            prompt: imagePrompt,
            size: "1024x1024",
          });
          if (imgGen.data?.[0]?.b64_json) {
            articlePayload.image = {
              attachment: imgGen.data[0].b64_json,
              alt: title,
            };
          } else if (imgGen.data?.[0]?.url) {
            articlePayload.image = {
              src: imgGen.data[0].url,
              alt: title,
            };
          }
        } catch (imgErr) {
          console.warn("gpt-image-2 featured image fallback failed:", imgErr.message);
        }
      }

      const articleRes = await fetch(`https://${shop}/admin/api/2024-01/blogs/${blogId}/articles.json`, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ article: articlePayload }),
      });

      if (!articleRes.ok) {
        const txt = await articleRes.text();
        return res.status(articleRes.status).json({ ok: false, error: `Shopify Article Creation Error: ${txt}` });
      }

      const data = await articleRes.json();
      const chosenBlogHandle = payload.blogHandle || "news";
      const storeHandle = shop.replace(".myshopify.com", "");
      const adminDraftUrl = `https://admin.shopify.com/store/${storeHandle}/articles/${data.article?.id}`;
      const livePublicUrl = `https://${conn.domain || shop}/blogs/${chosenBlogHandle}/${data.article?.handle}`;

      return res.status(200).json({
        ok: true,
        message: isDraft ? "Article saved as Shopify Draft in your Admin!" : "Article published live to Shopify blog!",
        isDraft: !!isDraft,
        article: data.article,
        articleUrl: isDraft ? adminDraftUrl : livePublicUrl,
        adminUrl: adminDraftUrl,
        publicUrl: livePublicUrl,
      });
    }

    // ---------------------------------------------------------
    // 7.8 SUGGEST AT LEAST 40 STRATEGIC ECOMMERCE TOPICS
    // ---------------------------------------------------------
    if (action === "suggest-topics") {
      const {
        targetKeywords = "",
        targetLocations = "",
        nicheFocus = "",
      } = payload;

      // 1. Fetch store catalog products for intelligent context (in-stock only)
      let sampleProducts = [];
      try {
        const prodResp = await fetch(
          `https://${shop}/admin/api/2024-01/products.json?limit=100&fields=id,title,handle,product_type,tags,variants,status`,
          {
            headers: {
              "X-Shopify-Access-Token": accessToken,
              "Content-Type": "application/json",
            },
          }
        );
        if (prodResp.ok) {
          const pData = await prodResp.json();
          const inStockProds = (pData.products || []).filter(isProductInStock);
          sampleProducts = inStockProds.slice(0, 30).map((p) => ({
            title: p.title,
            tags: p.tags,
            type: p.product_type,
          }));
        }
      } catch (pErr) {
        console.warn("Could not fetch products for topic suggestions:", pErr.message);
      }

      // 2. Fetch existing blog article titles to prevent duplicates
      let existingTitles = [];
      try {
        const blogResp = await fetch(`https://${shop}/admin/api/2024-01/blogs.json`, {
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
        });
        if (blogResp.ok) {
          const bData = await blogResp.json();
          const blogs = bData.blogs || [];
          if (blogs.length > 0) {
            const artResp = await fetch(
              `https://${shop}/admin/api/2024-01/blogs/${blogs[0].id}/articles.json?limit=50&fields=title`,
              {
                headers: {
                  "X-Shopify-Access-Token": accessToken,
                  "Content-Type": "application/json",
                },
              }
            );
            if (artResp.ok) {
              const aData = await artResp.json();
              existingTitles = (aData.articles || []).map((a) => a.title).filter(Boolean);
            }
          }
        }
      } catch (bErr) {
        console.warn("Could not fetch existing articles for topic suggestions:", bErr.message);
      }

      const brandName = conn.shopName || shop.split(".")[0] || "Our Store";
      const targetLoc = (targetLocations || conn.country || "").trim();

      const topicPrompt = `You are a chief eCommerce content strategist and SEO director for brand "${brandName}".
Catalog Snapshot (In-Stock Products & Categories):
${JSON.stringify(sampleProducts.slice(0, 25), null, 2)}

Target Keywords / Niche: "${targetKeywords || nicheFocus || "designer lifestyle & trending accessories"}"
${targetLoc ? `Target Geographic Territory (Cities / Countries): "${targetLoc}"` : ""}
Already Published Titles (DO NOT DUPLICATE):
${existingTitles.slice(0, 25).join("\n")}

YOUR MISSION:
Generate AT LEAST 40 unique, high-ranking, buyer-intent eCommerce blog topic titles.
Cover a balanced mix of:
1. Styling & Outfit Pairing Guides (occasion wear, formal vs casual, layering).
2. Occasion & Seasonal Guides (festivals, weddings, party wear, seasonal trends${targetLoc ? ` in ${targetLoc}` : ""}).
3. Material, Care & Longevity Guides (cleaning, maintenance, anti-tarnish, craftsmanship).
4. Gift Guides & Shopping Checklists (gifts for her, bridal trousseau, milestones).
5. Trend Spotlights & Modern Styling Innovations for 2026.
${targetLoc ? `6. Localized Guides catering specifically to shoppers in ${targetLoc}.` : ""}

Respond ONLY with a valid JSON object matching this schema:
{
  "topics": [
    "Topic 1 Title",
    "Topic 2 Title",
    ...
    "Topic 40 Title"
  ]
}`;

      let topics = [];
      if (process.env.OPENAI_API_KEY) {
        try {
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          const comp = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: topicPrompt }],
            response_format: { type: "json_object" },
            temperature: 0.75,
          });
          const parsed = JSON.parse(comp.choices[0]?.message?.content || "{}");
          if (Array.isArray(parsed.topics)) {
            topics = parsed.topics.filter(Boolean);
          } else if (Array.isArray(parsed)) {
            topics = parsed.filter(Boolean);
          } else {
            const arrVal = Object.values(parsed).find(Array.isArray);
            if (arrVal) topics = arrVal.filter(Boolean);
          }
        } catch (e) {
          console.warn("OpenAI topic suggest error:", e.message);
        }
      }

      // Ensure at least 40 topics are present
      if (topics.length < 40) {
        const fallbacks = getFallbackEcommerceTopics(brandName, targetLoc, targetKeywords || nicheFocus);
        const existingSet = new Set(topics.map((t) => t.toLowerCase()));
        for (const fb of fallbacks) {
          if (!existingSet.has(fb.toLowerCase())) {
            topics.push(fb);
            existingSet.add(fb.toLowerCase());
            if (topics.length >= 45) break;
          }
        }
      }

      return res.status(200).json({ ok: true, topics: topics.slice(0, 50), count: topics.length });
    }

    // ---------------------------------------------------------
    // 8. GET SHOPIFY AUTOPILOT CONFIG
    // ---------------------------------------------------------
    if (action === "get-autopilot-config") {
      const autoMemoryKey = `shopify_autopilot_${shop}`;
      const { data: memRow } = await supabase
        .from("agent_memory")
        .select("content")
        .eq("email", userEmail)
        .eq("memory_type", autoMemoryKey)
        .maybeSingle();

      let config = {
        enabled: false,
        cadence: "daily",
        blogId: null,
        blogHandle: "news",
        isDraft: false,
        targetKeywords: "",
        targetLocations: conn.country || "",
        targetMarket: conn.country || "",
        nicheFocus: "",
        autoShareFacebook: true,
        autoShareInstagram: true,
        topicQueue: [],
        suggestedTopics: [],
        bulkTopicsInput: "",
        lastPublishedAt: null,
        lastArticleTitle: null,
        lastArticleUrl: null,
        recentArticles: [],
      };

      if (memRow?.content) {
        try {
          const parsed = typeof memRow.content === "string" ? JSON.parse(memRow.content) : memRow.content;
          config = { ...config, ...parsed };
          config.targetLocations = config.targetLocations || config.targetMarket || conn.country || "";
          config.targetMarket = config.targetLocations;
          config.autoShareFacebook = parsed.autoShareFacebook === true;
          config.autoShareInstagram = parsed.autoShareInstagram === true;
          config.topicQueue = Array.isArray(parsed.topicQueue) ? parsed.topicQueue : [];
          config.suggestedTopics = Array.isArray(parsed.suggestedTopics) ? parsed.suggestedTopics : [];
          config.bulkTopicsInput = typeof parsed.bulkTopicsInput === "string" ? parsed.bulkTopicsInput : "";
        } catch (_) {}
      }

      // Brand Security & Anti-Exploitation Cross-Check
      let brandSecurity = {
        isMatched: false,
        status: "NO_SOCIAL_CONNECTED",
        reason: "No Meta account connected.",
      };

      try {
        const { data: metaRow } = await supabase
          .from("meta_connections")
          .select("fb_page_id, fb_page_access_token, fb_user_access_token, ig_business_id")
          .eq("email", userEmail)
          .maybeSingle();

        if (metaRow) {
          const metaIdentity = await getMetaIdentity(metaRow);
          if (metaIdentity) {
            brandSecurity = checkBrandMatch({
              storeName: conn.name || "Shopify Store",
              storeDomain: conn.domain || conn.shop,
              shopHandle: conn.shop,
              metaIdentity,
            });

            // If brand mismatch detected, strictly disable social syndication
            if (!brandSecurity.isMatched) {
              config.autoShareFacebook = false;
              config.autoShareInstagram = false;
            }
          }
        }
      } catch (secErr) {
        console.warn("[BrandSecurity] Check error:", secErr.message);
      }

      return res.status(200).json({ ok: true, config, brandSecurity });
    }

    // ---------------------------------------------------------
    // 9. SAVE SHOPIFY AUTOPILOT CONFIG
    // ---------------------------------------------------------
    if (action === "save-autopilot-config") {
      const autoMemoryKey = `shopify_autopilot_${shop}`;
      const existingMem = await supabase
        .from("agent_memory")
        .select("content")
        .eq("email", userEmail)
        .eq("memory_type", autoMemoryKey)
        .maybeSingle();

      let currentConfig = {};
      if (existingMem.data?.content) {
        try {
          currentConfig = typeof existingMem.data.content === "string" ? JSON.parse(existingMem.data.content) : existingMem.data.content;
        } catch (_) {}
      }

      const inputCfg = payload.config || {};
      const targetLoc = (inputCfg.targetLocations || inputCfg.targetMarket || "").trim();

      // Anti-Exploitation Shield: Ensure user cannot force autoShare if brand mismatch exists
      let brandSecurity = { isMatched: true };
      try {
        const { data: metaRow } = await supabase
          .from("meta_connections")
          .select("fb_page_id, fb_page_access_token, fb_user_access_token, ig_business_id")
          .eq("email", userEmail)
          .maybeSingle();

        if (metaRow) {
          const metaIdentity = await getMetaIdentity(metaRow);
          if (metaIdentity) {
            brandSecurity = checkBrandMatch({
              storeName: conn.name || "Shopify Store",
              storeDomain: conn.domain || conn.shop,
              shopHandle: conn.shop,
              metaIdentity,
            });

            if (!brandSecurity.isMatched) {
              // Strictly force false to prevent multi-tenant cross-brand exploitation
              inputCfg.autoShareFacebook = false;
              inputCfg.autoShareInstagram = false;
            }
          }
        }
      } catch (_) {}

      const newConfig = {
        ...currentConfig,
        ...inputCfg,
        targetLocations: targetLoc,
        targetMarket: targetLoc,
        autoShareFacebook: brandSecurity.isMatched ? (inputCfg.autoShareFacebook === true) : false,
        autoShareInstagram: brandSecurity.isMatched ? (inputCfg.autoShareInstagram === true) : false,
        topicQueue: Array.isArray(inputCfg.topicQueue) ? inputCfg.topicQueue : (currentConfig.topicQueue || []),
        suggestedTopics: Array.isArray(inputCfg.suggestedTopics) ? inputCfg.suggestedTopics : (currentConfig.suggestedTopics || []),
        bulkTopicsInput: typeof inputCfg.bulkTopicsInput === "string" ? inputCfg.bulkTopicsInput : (currentConfig.bulkTopicsInput || ""),
        updatedAt: new Date().toISOString(),
      };

      const { error: upsertErr } = await supabase.from("agent_memory").upsert(
        {
          email: userEmail,
          memory_type: autoMemoryKey,
          content: JSON.stringify(newConfig),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email,memory_type" }
      );

      if (upsertErr) {
        return res.status(500).json({ ok: false, error: upsertErr.message });
      }

      return res.status(200).json({
        ok: true,
        message: "Shopify Autopilot configuration saved successfully!",
        config: newConfig,
        brandSecurity,
      });
    }

    // ---------------------------------------------------------
    // 10. TRIGGER IMMEDIATE AUTOPILOT GENERATION
    // ---------------------------------------------------------
    if (action === "trigger-autopilot") {
      const workerUrl = process.env.RAILWAY_WORKER_URL || "https://video-worker-production-96d4.up.railway.app";
      const workerKey = process.env.WORKER_SECRET_KEY || "gabbar_worker_secret_2026";

      // 1. Attempt Railway worker dispatch
      try {
        console.log(`[Shopify Trigger] Forwarding trigger to Railway worker: ${workerUrl}/autopilot/shopify/trigger`);
        const workerRes = await fetch(`${workerUrl}/autopilot/shopify/trigger`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${workerKey}`,
          },
          body: JSON.stringify({
            force: true,
            email: userEmail,
          }),
        });

        if (workerRes.ok) {
          const wData = await workerRes.json();
          return res.status(200).json({
            ok: true,
            engine: "railway",
            message: "Autonomous article generated and published smoothly via Railway!",
            results: wData.results || [],
          });
        }
      } catch (wErr) {
        console.warn("[Shopify Trigger] Railway worker trigger call failed, executing native engine:", wErr.message);
      }

      // 2. Reliable Native Engine Execution: Execute directly without failing silently!
      try {
        console.log(`[Shopify Trigger] Executing native autonomous cycle for ${userEmail}...`);
        const results = await runShopifyAutopilotCycle({
          force: true,
          email: userEmail,
          logger: (msg) => console.log(`[Shopify Native Engine] ${msg}`),
        });

        const successItem = results.find((r) => r.status === "success");
        if (successItem) {
          return res.status(200).json({
            ok: true,
            engine: "native",
            message: `Autonomous article generated and published live: "${successItem.title}"!`,
            results,
          });
        } else {
          const failItem = results.find((r) => r.status === "failed");
          return res.status(500).json({
            ok: false,
            error: failItem?.error || "Autopilot generation failed.",
            results,
          });
        }
      } catch (nativeErr) {
        console.error("[Shopify Trigger] Native execution error:", nativeErr);
        return res.status(500).json({ ok: false, error: nativeErr.message });
      }
    }

    return res.status(400).json({ ok: false, error: `Unknown action: ${action}` });
  } catch (err) {
    console.error("Shopify Sync Handler Error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}
