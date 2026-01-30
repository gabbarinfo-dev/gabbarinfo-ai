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
    const { page_id, post_id, goal, budget, duration, email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Missing email parameter" });
    }
    if (!page_id || !post_id) {
      return res.status(400).json({ error: "Missing page_id or post_id" });
    }

    const { data: connection, error: dbError } = await supabase
      .from("meta_connections")
      .select("system_user_token, fb_ad_account_id")
      .eq("email", email)
      .single();

    if (dbError || !connection) {
      return res.status(404).json({ error: "No Meta connection found" });
    }

    const { system_user_token, fb_ad_account_id } = connection;

    if (!system_user_token || !fb_ad_account_id) {
      return res.status(400).json({ error: "Missing Token or Ad Account ID" });
    }

    const payload = {
      object_story_id: `${page_id}_${post_id}`,
      goal: goal || "PAGE_POST_ENGAGEMENT",
      budget_type: "DAILY",
      daily_budget: Number(budget) || 500,
      duration: Number(duration) || 5,
      targeting: {
        geo_locations: {
          countries: ["IN"],
        },
      },
      access_token: system_user_token,
    };

    const url = `https://graph.facebook.com/v19.0/act_${fb_ad_account_id}/promoted_posts`;

    const metaRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!metaRes.ok) {
      const errText = await metaRes.text();
      return res.status(metaRes.status).json({ error: "Meta API Error", details: errText });
    }

    const data = await metaRes.json();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("Create Boost Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
