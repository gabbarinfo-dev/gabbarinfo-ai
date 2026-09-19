/**
 * E-Commerce Merchandising & Product Curation Engine
 * Analyzes store catalogs from Shopify / Merchant Center and curates high-converting
 * product portfolios (Highest-Value Showpieces + Highest-Discount Deal Magnets).
 */

/**
 * Fetch and curate store products based on category, custom URLs, or general catalog.
 */
export async function fetchCuratedStoreProducts({
  shopifyConnection,
  category = null,
  productUrls = [],
  targetCountry = "GB",
  currency = "GBP",
  maxProducts = 8,
}) {
  try {
    const shop = shopifyConnection?.myshopify_domain || shopifyConnection?.shop;
    const token = shopifyConnection?.access_token || shopifyConnection?.accessToken;

    if (!shop || !token) {
      return {
        ok: false,
        reason: "NO_SHOPIFY_AUTH",
        curatedProducts: [],
        itemIds: [],
        productImages: [],
      };
    }

    // 1. Fetch products from Shopify Admin API
    const url = `https://${shop}/admin/api/2024-01/products.json?limit=250&fields=id,title,handle,product_type,tags,variants,images`;
    const resp = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
    });

    if (!resp.ok) {
      return {
        ok: false,
        reason: `Shopify API returned status ${resp.status}`,
        curatedProducts: [],
        itemIds: [],
        productImages: [],
      };
    }

    const json = await resp.json();
    const rawProducts = json.products || [];

    // Parse products into normalized objects
    const normalizedProducts = rawProducts.map((p) => {
      const v = p.variants?.[0] || {};
      const price = parseFloat(v.price || "0");
      const compareAt = parseFloat(v.compare_at_price || "0");
      const discountPercent =
        compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : 0;
      const primaryImage = p.images?.[0]?.src || null;
      const additionalImages = (p.images || []).slice(1, 4).map((img) => img.src);
      const variantId = v.id;
      // Standard Shopify Google Merchant Center feed ID format:
      // shopify_GB_9684434551120_49557766865200
      const gmcItemId = `shopify_${targetCountry.toUpperCase()}_${p.id}_${variantId}`;

      return {
        id: p.id,
        variantId,
        gmcItemId,
        title: p.title,
        handle: p.handle,
        productType: p.product_type || "",
        tags: p.tags || "",
        price,
        compareAtPrice: compareAt,
        discountPercent,
        currency,
        url: `https://${shopifyConnection?.primary_domain || shopifyConnection?.domain || shop}/products/${p.handle}`,
        image: primaryImage,
        additionalImages,
      };
    });

    // -------------------------------------------------------------
    // SCENARIO B: User provided 2 to 5 specific product URLs / links
    // -------------------------------------------------------------
    if (Array.isArray(productUrls) && productUrls.length > 0) {
      const matched = [];
      for (const rawUrl of productUrls) {
        if (!rawUrl) continue;
        const cleanUrl = String(rawUrl).trim().toLowerCase();
        // Extract handle from url e.g. /products/kundan-necklace
        const handleMatch = cleanUrl.match(/\/products\/([a-z0-9-_]+)/i);
        const targetHandle = handleMatch ? handleMatch[1] : null;

        const found = normalizedProducts.find((p) => {
          if (targetHandle && p.handle.toLowerCase() === targetHandle) return true;
          return cleanUrl.includes(p.handle.toLowerCase());
        });

        if (found && !matched.some((m) => m.id === found.id)) {
          matched.push(found);
        }
      }

      if (matched.length > 0) {
        return {
          ok: true,
          mode: "CUSTOM_LINKS",
          totalMatched: matched.length,
          curatedProducts: matched,
          showpieces: matched,
          dealMagnets: [],
          itemIds: matched.map((p) => p.gmcItemId),
          productImages: matched.map((p) => p.image).filter(Boolean),
          summaryText: `Targeting ${matched.length} specific chosen product(s) directly from your store links.`,
        };
      }
    }

    // -------------------------------------------------------------
    // SCENARIO A: Category defined (e.g. "Kundan Jewellery" or "Shoes")
    // -------------------------------------------------------------
    let filteredList = normalizedProducts;
    let cleanCategory = category ? String(category).trim().toLowerCase() : "";

    if (cleanCategory) {
      const keywords = cleanCategory
        .split(/[\s,&|/-]+/)
        .filter((w) => w.length >= 3 && !["and", "the", "for", "with"].includes(w));

      filteredList = normalizedProducts.filter((p) => {
        const titleLower = p.title.toLowerCase();
        const typeLower = p.productType.toLowerCase();
        const tagsLower = p.tags.toLowerCase();

        // Exact category or sub-keyword match
        if (titleLower.includes(cleanCategory) || typeLower.includes(cleanCategory) || tagsLower.includes(cleanCategory)) {
          return true;
        }
        return keywords.some((kw) => titleLower.includes(kw) || typeLower.includes(kw) || tagsLower.includes(kw));
      });

      // If strict filter yielded too few (< 2), fallback to title substring matching
      if (filteredList.length < 2 && keywords.length > 0) {
        filteredList = normalizedProducts.filter((p) =>
          keywords.some((kw) => p.title.toLowerCase().includes(kw))
        );
      }
    }

    // If still no products found, use full catalog
    if (filteredList.length === 0) {
      filteredList = normalizedProducts;
    }

    // DUAL-TIER CURATION:
    // Tier 1: 💎 Showpieces (Highest Value / Luxury Margins)
    const showpieces = [...filteredList]
      .sort((a, b) => b.price - a.price)
      .slice(0, 4);

    // Tier 2: 🔥 Deal Magnets (Highest % Discount)
    const showpieceIds = new Set(showpieces.map((s) => s.id));
    const dealMagnets = [...filteredList]
      .filter((p) => p.discountPercent > 0 && !showpieceIds.has(p.id))
      .sort((a, b) => b.discountPercent - a.discountPercent)
      .slice(0, 4);

    // Combine up to maxProducts total
    const curatedProducts = [...showpieces, ...dealMagnets].slice(0, maxProducts);
    const itemIds = curatedProducts.map((p) => p.gmcItemId);
    const productImages = curatedProducts.map((p) => p.image).filter(Boolean);

    return {
      ok: true,
      mode: cleanCategory ? "CATEGORY_CURATED" : "STORE_BESTSELLERS",
      category: cleanCategory || "Storewide",
      totalAvailableInCategory: filteredList.length,
      curatedProducts,
      showpieces,
      dealMagnets,
      itemIds,
      productImages,
      summaryText: cleanCategory
        ? `Found ${filteredList.length} items in "${category}". Curated top ${showpieces.length} High-Value Showpieces and top ${dealMagnets.length} High-Discount Deal Magnets.`
        : `Curated top ${showpieces.length} High-Value Showpieces and ${dealMagnets.length} High-Discount Deals across your store.`,
    };
  } catch (err) {
    console.error("fetchCuratedStoreProducts exception:", err.message);
    return {
      ok: false,
      error: err.message,
      curatedProducts: [],
      itemIds: [],
      productImages: [],
    };
  }
}
