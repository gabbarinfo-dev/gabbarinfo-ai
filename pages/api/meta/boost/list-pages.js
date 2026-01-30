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
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Missing email parameter" });
    }

    const { data: connection, error: dbError } = await supabase
      .from("meta_connections")
      .select("system_user_token, fb_page_id")
      .eq("email", email)
      .single();

    if (dbError || !connection) {
      return res.status(404).json({ error: "No Meta connection found" });
    }

    const { system_user_token, fb_page_id } = connection;

    if (!system_user_token) {
      return res.status(400).json({ error: "Missing System User Token" });
    }

    const metaRes = await fetch("https://graph.facebook.com/v19.0/me/accounts", {
      headers: {
        Authorization: `Bearer ${system_user_token}`,
      },
    });

    if (!metaRes.ok) {
      const errText = await metaRes.text();
      return res.status(metaRes.status).json({ error: "Meta API Error", details: errText });
    }

    const metaData = await metaRes.json();
    const allPages = metaData.data || [];

    const validPages = allPages.filter((p) => p.id === fb_page_id);

    return res.status(200).json({ pages: validPages });
  } catch (err) {
    console.error("List Pages Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
