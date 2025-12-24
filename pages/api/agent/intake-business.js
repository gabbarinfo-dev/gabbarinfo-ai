import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseServer } from "../../../lib/supabaseServer";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Meta API error");
  return res.json();
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
      const html = await fetch(url, { timeout: 8000 }).then(r => r.text());
      const dom = new JSDOM(html);
      const doc = dom.window.document;

      pages.push({
        url,
        title: doc.title || "",
        text: doc.body?.textContent?.slice(0, 5000) || ""
      });

      const links = [...doc.querySelectorAll("a")]
        .map(a => a.href)
        .filter(h => h.startsWith(startUrl));

      links.forEach(l => {
        if (!visited.has(l)) queue.push(l);
      });

    } catch (_) {}
  }

  return pages;
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

    if (!meta?.access_token || !meta?.fb_page_id) {
      return res.json({ ok: false, reason: "META_NOT_CONNECTED" });
    }

    const accessToken = meta.access_token;

    /* =============================
       FACEBOOK PAGE DATA
    ============================== */
    const fbPage = await fetchJSON(
      `https://graph.facebook.com/v19.0/${meta.fb_page_id}?fields=name,about,category,description,phone,emails,website&access_token=${accessToken}`
    );

    const fbPosts = await fetchJSON(
      `https://graph.facebook.com/v19.0/${meta.fb_page_id}/posts?fields=message,created_time,is_published&limit=10&access_token=${accessToken}`
    );

    /* =============================
       INSTAGRAM BUSINESS DATA
    ============================== */
    let igData = null;
    let igPosts = [];

    if (meta.ig_business_id) {
      igData = await fetchJSON(
        `https://graph.facebook.com/v19.0/${meta.ig_business_id}?fields=name,biography,category,website&access_token=${accessToken}`
      );

      const igMedia = await fetchJSON(
        `https://graph.facebook.com/v19.0/${meta.ig_business_id}/media?fields=caption,timestamp,media_type&limit=10&access_token=${accessToken}`
      );

      igPosts = igMedia.data || [];
    }

    /* =============================
       WEBSITE AUTO-DETECTION
    ============================== */
    const websiteUrl =
      fbPage.website ||
      igData?.website ||
      null;

    let websitePages = [];

    if (websiteUrl) {
      websitePages = await crawlWebsite(websiteUrl);
    }

    /* =============================
       FINAL RAW PAYLOAD
    ============================== */
    return res.json({
      ok: true,
      intake: {
        facebook: {
          name: fbPage.name,
          category: fbPage.category,
          about: fbPage.about || fbPage.description,
          contact: {
            phone: fbPage.phone,
            emails: fbPage.emails,
            website: fbPage.website
          },
          posts: fbPosts.data || []
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
