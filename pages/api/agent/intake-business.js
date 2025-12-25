import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseServer } from "../../../lib/supabaseServer";

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
      links.forEach(l => {
        if (!visited.has(l)) queue.push(l);
      });
    } catch (_) {}
  }

  return pages;
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Meta API error");
  return res.json();
}

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ ok: false });
    }

    const { data: meta } = await supabaseServer
      .from("meta_connections")
      .select("*")
      .eq("email", session.user.email)
      .single();

    if (!meta?.system_user_token || !meta?.fb_page_id) {
  return res.json({ ok: false, reason: "META_NOT_CONNECTED" });
}

const token = meta.system_user_token;


    // Facebook Page
  // ✅ Fetch Page info via Business-owned endpoint (system token safe)
const fbPage = await fetchJSON(
  `https://graph.facebook.com/v19.0/${meta.fb_business_id}/owned_pages?fields=name,category,about,description,phone,emails,website&access_token=${token}`
);

// pick the correct page
const pageData =
  fbPage.data?.find(p => p.id === meta.fb_page_id) || fbPage.data?.[0];

if (!pageData) {
  throw new Error("Page data not accessible via business");
}

    const fbPosts = await fetchJSON(
      `https://graph.facebook.com/v19.0/${meta.fb_page_id}/posts?fields=message,created_time&limit=10&access_token=${token}`
    );

    // Instagram
    let igData = null;
    let igPosts = [];

    if (meta.ig_business_id) {
      igData = await fetchJSON(
        `https://graph.facebook.com/v19.0/${meta.ig_business_id}?fields=name,biography,category,website&access_token=${token}`
      );

      const igMedia = await fetchJSON(
        `https://graph.facebook.com/v19.0/${meta.ig_business_id}/media?fields=caption,timestamp&limit=10&access_token=${token}`
      );

      igPosts = igMedia.data || [];
    }

    // Website auto-detect
    const websiteUrl = fbPage.website || igData?.website || null;
    let websitePages = [];

    if (websiteUrl) {
      websitePages = await crawlWebsite(websiteUrl);
    }

    return res.json({
      ok: true,
      intake: {
        facebook: {
          name: pageData.name,
          category: pageData.category,
          about: pageData.about || pageData.description,
          contact: {
            phone: pageData.phone,
            emails: pageData.emails,
            website: pageData.website
          },
          posts: pagePosts.data || []
        },
        instagram: igData
          ? {
              name: igData.name,
              category: igData.category,
              bio: igData.biography,
              website: igData.website,
              posts: igPosts
            }
          : null,
        website: websiteUrl
          ? {
              url: websiteUrl,
              pages: websitePages
            }
          : null
      }
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
}
