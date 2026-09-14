// pages/api/meta/product-sets/create.js

import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { createOrResolveProductSet } from "../../../../lib/meta/product-sets";

/**
 * Creates or retrieves a Product Set inside a Meta Product Catalog
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    const userEmail = session?.user?.email?.toLowerCase() || req.headers["x-client-email"]?.toLowerCase();

    if (!userEmail) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    // 1. Fetch Meta credentials from database
    const { data: metaRow, error: metaErr } = await supabaseServer
      .from("meta_connections")
      .select("*")
      .eq("email", userEmail)
      .maybeSingle();

    if (metaErr || !metaRow) {
      return res.status(400).json({ ok: false, error: "Meta connection not found for this user." });
    }

    const catalogId = req.body.catalog_id || metaRow.fb_catalog_id;
    const accessToken = metaRow.fb_user_access_token || metaRow.system_user_token;

    if (!catalogId) {
      return res.status(400).json({
        ok: false,
        error: "No Meta Product Catalog connected. Please connect Facebook Business with Commerce permissions.",
      });
    }

    if (!accessToken) {
      return res.status(400).json({
        ok: false,
        error: "Missing Meta access token. Please reconnect Facebook Business.",
      });
    }

    const {
      name,
      filter_type,
      keyword,
      max_price,
      currency,
      product_urls,
      retailer_ids,
    } = req.body;

    const result = await createOrResolveProductSet({
      catalogId,
      accessToken,
      activeCurrency: currency || metaRow.account_currency || "GBP",
      name,
      filter_type,
      keyword,
      max_price,
      product_urls,
      retailer_ids,
    });

    if (result.ok) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error("❌ [ProductSet API] Handler error:", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
