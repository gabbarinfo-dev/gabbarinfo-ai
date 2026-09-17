// pages/api/shopify/sync.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getValidShopifyAccessToken } from "../../../lib/shopify/token-service";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const maxDuration = 60;
export const config = {
  maxDuration: 60,
};

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

      return res.status(200).json({ ok: true, blogs });
    }

    // ---------------------------------------------------------
    // 4. LIST PRODUCTS
    // ---------------------------------------------------------
    if (action === "list-products") {
      const limit = Math.min(Number(payload.limit) || 50, 100);
      const resp = await fetch(
        `https://${shop}/admin/api/2024-01/products.json?limit=${limit}&fields=id,title,body_html,vendor,product_type,handle,images,variants,tags,status`,
        {
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
        }
      );

      if (!resp.ok) {
        const txt = await resp.text();
        return res.status(resp.status).json({ ok: false, error: `Shopify Products API Error: ${txt}` });
      }

      const data = await resp.json();
      return res.status(200).json({ ok: true, products: data.products || [] });
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
        tone = "engaging, authoritative, and conversion-focused",
        brandName = conn.shopName || "Our Store",
      } = payload;

      if (!topic) {
        return res.status(400).json({ ok: false, error: "Blog topic is required." });
      }

      const blogPrompt = `You are a world-class eCommerce SEO copywriter and lifestyle content strategist for "${brandName}".
Write an in-depth, authoritative, and engaging 1,500+ word eCommerce blog article optimized for Google rank and product conversion.

TOPIC: ${topic}
TARGET KEYWORDS: ${keywords || topic}
BRAND NAME: ${brandName}
TONE: ${tone}

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
  "bodyHtml": "<p>Article HTML content...</p>",
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

    return res.status(400).json({ ok: false, error: `Unknown action: ${action}` });
  } catch (err) {
    console.error("Shopify Sync Handler Error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}
