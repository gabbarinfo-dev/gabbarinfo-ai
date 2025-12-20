import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: "Email required" });
    }

    // 1️⃣ Get stored token safely
    const { data, error } = await supabase
      .from("meta_connections")
      .select("access_token")
      .eq("user_email", email)
      .single();

    if (error || !data || !data.access_token) {
      return res.status(401).json({
        error: "No Meta connection found for this user",
      });
    }

    const token = data.access_token;

    // 2️⃣ Fetch Ad Accounts
    const adAccountsRes = await fetch(
      `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,account_status&access_token=${token}`
    );
    const adAccountsJson = await adAccountsRes.json();

    if (adAccountsJson.error) {
      return res.status(400).json({
        error: "Failed to fetch ad accounts",
        details: adAccountsJson.error,
      });
    }

    // 3️⃣ Fetch Pages
    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${token}`
    );
    const pagesJson = await pagesRes.json();

    if (pagesJson.error) {
      return res.status(400).json({
        error: "Failed to fetch pages",
        details: pagesJson.error,
      });
    }

    // 4️⃣ Save assets safely
    await supabase.from("meta_assets").upsert({
      user_email: email,
      ad_accounts: adAccountsJson.data || [],
      pages: pagesJson.data || [],
      updated_at: new Date().toISOString(),
    });

    return res.json({
      success: true,
      ad_accounts: adAccountsJson.data || [],
      pages: pagesJson.data || [],
    });
  } catch (err) {
    console.error("FETCH ASSETS ERROR:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
