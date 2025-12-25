import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseServer } from "../../../lib/supabaseServer";

/* ---------------- WEBSITE HELPERS ---------------- */

async function fetchText(url) {
  const res = await fetch(url, { timeout: 8000 });
  if (!res.ok) throw new Error("Failed to fetch " + url);
  return res.text();
}

function extractText(html) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5000);
}

function extractLinks(html, baseUrl) {
  const links = [];
  const regex = /href=["']([^"']+)["']/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    let link = match[1];
    if (link.startsWith("/")) link = baseUrl + link;
    if (link.startsWith(baseUrl)) links.push(link.split("#")[0]);
  }

  return [...new Set(links)];
}

async function crawlWebsite(startUrl) {
  const visited = new Set();
  const pages = [];
  const queue = [startUrl.replace(/\/$/, "")];

  while (queue.length && pages.length < 10) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);

    try {
      const html = await fetchText(url);
      const text = extractText(html);

      pages.push({ url, text });

      const links = extractLinks(html, startUrl);
      links.forEach((l) => {
        if (!visited.has(l)) queue.push(l);
      });
    } catch (_) {}
  }

  return pages;
}

/* ---------------- MAIN HANDLER ---------------- */

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ ok: false });
    }

    // 🔹 Read stored business info (SYNCED ONCE VIA USER CONSENT)
    const { data: meta } = await supabaseServer
      .from("meta_connections")
      .select("*")
      .eq("email", session.user.email)
      .single();

    if (!meta) {
      return res.json({
        ok: false,
        reason: "BUSINESS_NOT_CONNECTED",
      });
    }

    const websiteUrl =
      meta.business_website || meta.instagram_website || null;

    let websitePages = [];
    let detectedPhone = meta.business_phone || null;
    let detectedServices = [];

    // 🌐 Crawl website if available
    if (websiteUrl) {
      websitePages = await crawlWebsite(websiteUrl);

      // 📞 Phone detection fallback
      if (!detectedPhone) {
        for (const page of websitePages) {
          const match = page.text.match(/(\+?\d[\d\s\-]{8,15})/);
          if (match) {
            detectedPhone = match[1];
            break;
          }
        }
      }

      // 🧾 Simple service detection
      for (const page of websitePages) {
        const text = page.text.toLowerCase();
        if (
          text.includes("service") ||
          text.includes("we offer") ||
          text.includes("our services")
        ) {
          detectedServices.push(page.url);
        }
      }
    }

   // 🧠 FINAL INTAKE OBJECT (AUTHORITATIVE — AGENT READABLE)
return res.json({
  ok: true,
  intake: {
    // 🔑 FLAT KEYS — THIS IS WHAT execute.js EXPECTS
    business_name: meta.business_name || null,
    business_category: meta.business_category || null,
    business_about: meta.business_about || null,

    business_phone: meta.business_phone || detectedPhone || null,
    business_website: meta.business_website || websiteUrl || null,

    instagram_bio: meta.instagram_bio || null,
    instagram_website: meta.instagram_website || null,

    source: "supabase_synced",
    synced_at: meta.updated_at || null,
  },
});

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
}
