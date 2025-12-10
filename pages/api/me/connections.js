// pages/api/me/connections.js
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.email) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const email = session.user.email.toLowerCase().trim();

  const [{ data: google }, { data: meta }] = await Promise.all([
    supabase
      .from("google_connections")
      .select("email, expires_at, updated_at")
      .eq("email", email)
      .maybeSingle(),
    supabase
      .from("meta_connections")
      .select("email, fb_ad_account_id, fb_page_id, ig_business_id, updated_at")
      .eq("email", email)
      .maybeSingle(),
  ]);

  return res.status(200).json({
    email,
    google,
    meta,
  });
}
