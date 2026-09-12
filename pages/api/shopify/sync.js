// pages/api/shopify/sync.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
    const { shop, access_token: accessToken } = conn;

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
      return res.status(200).json({ ok: true, blogs: data.blogs || [] });
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

      if (imageUrl) {
        articlePayload.image = { src: imageUrl };
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
      return res.status(200).json({
        ok: true,
        message: isDraft ? "Article saved as Shopify Draft!" : "Article published live to Shopify blog!",
        article: data.article,
        articleUrl: `https://${conn.domain || shop}/blogs/${blogId}/${data.article?.handle}`,
      });
    }

    return res.status(400).json({ ok: false, error: `Unknown action: ${action}` });
  } catch (err) {
    console.error("Shopify Sync Handler Error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}
