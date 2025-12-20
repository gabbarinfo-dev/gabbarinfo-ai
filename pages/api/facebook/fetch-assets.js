import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }

  // 1️⃣ Get stored token
  const { data } = await supabase
    .from("meta_connections")
    .select("access_token")
    .eq("user_email", email)
    .single();

  if (!data?.access_token) {
    return res.status(401).json({ error: "No Meta connection found" });
  }

  const token = data.access_token;

  // 2️⃣ Fetch Ad Accounts
  const adAccountsRes = await fetch(
    `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,account_status&access_token=${token}`
  );
  const adAccounts = await adAccountsRes.json();

  // 3️⃣ Fetch Pages
  const pagesRes = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?access_token=${token}`
  );
  const pages = await pagesRes.json();

  // 4️⃣ Save assets
  await supabase.from("meta_assets").upsert({
    user_email: email,
    ad_accounts: adAccounts.data || [],
    pages: pages.data || [],
    updated_at: new Date().toISOString(),
  });

  res.json({
    success: true,
    ad_accounts: adAccounts.data || [],
    pages: pages.data || [],
  });
}
