import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const email = session.user.email.toLowerCase().trim();

    const { data: connection, error: dbError } = await supabase
      .from("meta_connections")
      .select("system_user_token, fb_page_id")
      .eq("email", email)
      .single();

    if (dbError || !connection) {
      return res.status(404).json({ error: "No Meta connection found in Supabase" });
    }

    const { system_user_token, fb_page_id } = connection;

    if (!system_user_token) {
      return res.status(400).json({ error: "Missing System User Token" });
    }

    // Call Meta API
    const metaRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${system_user_token}`
    );

    if (!metaRes.ok) {
      const errText = await metaRes.text();
      return res.status(metaRes.status).json({ error: "Meta API Error", details: errText });
    }

    const metaData = await metaRes.json();
    const allPages = metaData.data || [];

    // Filter: Only pages whose id exists in meta_connections.fb_page_id
    // fb_page_id in DB is usually a string.
    const validPages = allPages.filter((p) => p.id === fb_page_id);

    return res.status(200).json({ pages: validPages });
  } catch (err) {
    console.error("List Pages Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
