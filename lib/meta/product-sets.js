// lib/meta/product-sets.js

const API_VERSION = "v21.0";

/**
 * Creates or retrieves a Product Set inside a Meta Product Catalog
 * Supports filters by:
 * - category / product_type / keyword
 * - price max (auto-converted to currency minor units)
 * - on-sale items
 * - specific product URLs or retailer IDs
 * - all products (default catalog set)
 */
export async function createOrResolveProductSet({
  catalogId,
  accessToken,
  activeCurrency = "GBP",
  name,
  filter_type = "all",
  keyword,
  max_price,
  product_urls,
  retailer_ids,
}) {
  if (!catalogId) {
    throw new Error("No Meta Product Catalog ID provided.");
  }
  if (!accessToken) {
    throw new Error("No Meta Access Token provided.");
  }

  const currencyCode = (activeCurrency || "GBP").toUpperCase();

  // If requesting "all", check if an "All Products" set already exists
  if (filter_type === "all" || !filter_type) {
    try {
      const existingRes = await fetch(
        `https://graph.facebook.com/${API_VERSION}/${catalogId}/product_sets?fields=id,name,product_count&access_token=${accessToken}`
      );
      const existingJson = await existingRes.json();
      if (existingJson?.data?.length) {
        const allSet =
          existingJson.data.find((s) => s.name?.toLowerCase().includes("all product")) ||
          existingJson.data[0];
        return {
          ok: true,
          product_set_id: allSet.id,
          product_set_name: allSet.name,
          catalog_id: catalogId,
          product_count: allSet.product_count || 0,
          is_existing: true,
        };
      }
    } catch (e) {
      console.warn("⚠️ Failed to fetch existing product sets:", e.message);
    }
  }

  // Build filter rule object according to Meta Graph API spec
  let filterObj = {};
  let setName = name || "Curated Product Set";

  if (filter_type === "category" || keyword) {
    const term = (keyword || name || "").trim();
    setName = name || `Collection: ${term}`;
    filterObj = {
      or: [
        { product_type: { contains: term } },
        { name: { contains: term } },
      ],
    };
  } else if (filter_type === "price_max" && max_price) {
    // In minor currency units: £40 -> 4000, $50 -> 5000, ₹500 -> 50000 (cents/pence)
    const minorMultiplier = currencyCode === "JPY" || currencyCode === "KRW" ? 1 : 100;
    const minorPrice = Math.round(Number(max_price) * minorMultiplier);
    setName = name || `Under ${currencyCode} ${max_price}`;
    filterObj = {
      price: { "<": minorPrice },
    };
  } else if (filter_type === "sale") {
    setName = name || "On Sale & Discounted Items";
    filterObj = {
      sale_price: { "<": "price" },
    };
  } else if (filter_type === "urls" && Array.isArray(product_urls) && product_urls.length > 0) {
    setName = name || `Selected ${product_urls.length} Products`;
    filterObj = {
      url: { is_any: product_urls },
    };
  } else if (retailer_ids && Array.isArray(retailer_ids) && retailer_ids.length > 0) {
    setName = name || `Selected ${retailer_ids.length} Products`;
    filterObj = {
      retailer_id: { is_any: retailer_ids },
    };
  } else {
    // Default fallback
    setName = name || "Featured Products";
    filterObj = {
      availability: { is_any: ["in stock", "available for order"] },
    };
  }

  // Call Meta Graph API to create the product set
  const createParams = new URLSearchParams({
    access_token: accessToken,
    name: setName,
    filter: JSON.stringify(filterObj),
  });

  console.log(`🛍️ [ProductSet API] Creating Product Set "${setName}" for Catalog ${catalogId}...`);
  const createRes = await fetch(
    `https://graph.facebook.com/${API_VERSION}/${catalogId}/product_sets`,
    {
      method: "POST",
      body: createParams,
    }
  );

  const createJson = await createRes.json();

  if (createRes.ok && createJson.id) {
    console.log(`✅ [ProductSet API] Created Product Set ID: ${createJson.id}`);
    return {
      ok: true,
      product_set_id: createJson.id,
      product_set_name: setName,
      catalog_id: catalogId,
      filter: filterObj,
    };
  }

  console.warn(`⚠️ [ProductSet API] Create failed:`, JSON.stringify(createJson.error));

  // Fallback: If creation fails (e.g. permissions or filter syntax), return first available existing product set
  try {
    const fallbackRes = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${catalogId}/product_sets?fields=id,name,product_count&access_token=${accessToken}`
    );
    const fallbackJson = await fallbackRes.json();
    if (fallbackJson?.data?.length) {
      const fallbackSet = fallbackJson.data[0];
      console.log(`🛡️ [ProductSet API] Using fallback existing set: "${fallbackSet.name}" (${fallbackSet.id})`);
      return {
        ok: true,
        product_set_id: fallbackSet.id,
        product_set_name: fallbackSet.name,
        catalog_id: catalogId,
        product_count: fallbackSet.product_count || 0,
        warning: createJson.error?.message || "Created fallback set",
      };
    }
  } catch (err) {
    console.warn("Fallback resolution also failed:", err.message);
  }

  return {
    ok: false,
    error: createJson.error?.message || "Failed to create or find product set in Meta Catalog.",
  };
}
