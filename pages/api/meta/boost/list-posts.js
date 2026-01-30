import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { page_id, email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Missing email parameter" });
    }
    if (!page_id) {
      return res.status(400).json({ error: "Missing page_id" });
    }

    const { data: connection, error: dbError } = await supabase
      .from("meta_connections")
      .select("fb_page_access_token")
      .eq("email", email)
      .single();

    if (dbError || !connection) {
      return res.status(404).json({ error: "No Meta connection found" });
    }

    const { fb_page_access_token } = connection;

    if (!fb_page_access_token) {
      return res.status(400).json({ error: "Missing Page Access Token" });
    }

    const url = `https://graph.facebook.com/v19.0/${page_id}/posts?fields=id,message,created_time,is_eligible_for_promotion&limit=20&access_token=${fb_page_access_token}`;

    const metaRes = await fetch(url);
    if (!metaRes.ok) {
      const errText = await metaRes.text();
      return res.status(metaRes.status).json({ error: "Meta API Error", details: errText });
    }

    const metaData = await metaRes.json();
    const posts = metaData.data || [];

    const eligiblePosts = posts.filter((p) => p.is_eligible_for_promotion === true);
    const lastThree = eligiblePosts.slice(0, 3);

    return res.status(200).json({ posts: lastThree });
  } catch (err) {
    console.error("List Posts Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
