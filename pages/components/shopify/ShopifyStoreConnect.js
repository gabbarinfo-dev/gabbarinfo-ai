"use client";

import { useEffect, useState } from "react";

export default function ShopifyStoreConnect({ onConnectionChange }) {
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState(null);
  const [shopInput, setShopInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeSubTab, setActiveSubTab] = useState("products"); // "products" | "blogs"

  // Product Suite State
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizedData, setOptimizedData] = useState(null);
  const [pushingProduct, setPushingProduct] = useState(false);
  const [productSuccessMsg, setProductSuccessMsg] = useState("");
  const [targetKeywords, setTargetKeywords] = useState("");
  const [targetTone, setTargetTone] = useState("luxury, persuasive, and conversion-focused");

  // Blog Suite State
  const [blogs, setBlogs] = useState([]);
  const [selectedBlogId, setSelectedBlogId] = useState("");
  const [blogTopic, setBlogTopic] = useState("");
  const [blogKeywords, setBlogKeywords] = useState("");
  const [isDraft, setIsDraft] = useState(false);
  const [publishingBlog, setPublishingBlog] = useState(false);
  const [blogSuccessMsg, setBlogSuccessMsg] = useState("");
  const [publishedArticleUrl, setPublishedArticleUrl] = useState("");

  useEffect(() => {
    fetchConnection();
  }, []);

  const fetchConnection = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/shopify/sync?action=get-connection");
      const data = await res.json();
      if (data.ok && data.connected) {
        setConnection(data.connection);
        if (onConnectionChange) onConnectionChange(true);
        // Pre-fetch products and blogs
        fetchProducts();
        fetchBlogs();
      } else {
        setConnection(null);
        if (onConnectionChange) onConnectionChange(false);
      }
    } catch (e) {
      console.error("Failed to fetch Shopify connection:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = (e) => {
    e.preventDefault();
    if (!shopInput.trim()) {
      setErrorMsg("Please enter your Shopify store domain.");
      return;
    }

    setConnecting(true);
    setErrorMsg("");

    let normalized = shopInput.trim().toLowerCase();
    normalized = normalized.replace(/^https?:\/\//, "").replace(/\/+$/, "").split("/")[0];
    if (!normalized.includes(".")) {
      normalized = `${normalized}.myshopify.com`;
    }

    // Redirect to OAuth initiation endpoint
    window.location.href = `/api/shopify/connect?shop=${encodeURIComponent(normalized)}`;
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect this Shopify store?")) return;
    try {
      const res = await fetch("/api/shopify/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      const data = await res.json();
      if (data.ok) {
        setConnection(null);
        setProducts([]);
        setBlogs([]);
        if (onConnectionChange) onConnectionChange(false);
      } else {
        alert(data.error || "Failed to disconnect");
      }
    } catch (err) {
      alert("Error disconnecting store: " + err.message);
    }
  };

  const fetchProducts = async () => {
    setProductsLoading(true);
    try {
      const res = await fetch("/api/shopify/sync?action=list-products&limit=50");
      const data = await res.json();
      if (data.ok) {
        setProducts(data.products || []);
      }
    } catch (err) {
      console.error("Failed to load Shopify products:", err);
    } finally {
      setProductsLoading(false);
    }
  };

  const fetchBlogs = async () => {
    try {
      const res = await fetch("/api/shopify/sync?action=list-blogs");
      const data = await res.json();
      if (data.ok && data.blogs?.length > 0) {
        setBlogs(data.blogs);
        setSelectedBlogId(String(data.blogs[0].id));
      }
    } catch (err) {
      console.error("Failed to load Shopify blogs:", err);
    }
  };

  const openOptimizeModal = (product) => {
    setSelectedProduct(product);
    setOptimizedData(null);
    setProductSuccessMsg("");
    setTargetKeywords(product.tags ? String(product.tags) : product.title);
  };

  const handleGenerateDescription = async () => {
    if (!selectedProduct) return;
    setOptimizing(true);
    setProductSuccessMsg("");
    try {
      const res = await fetch("/api/shopify/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-product-description",
          productId: selectedProduct.id,
          title: selectedProduct.title,
          currentDescription: selectedProduct.body_html || "",
          category: selectedProduct.product_type || "",
          vendor: selectedProduct.vendor || "",
          keywords: targetKeywords,
          tone: targetTone,
        }),
      });

      const data = await res.json();
      if (data.ok && data.generated) {
        setOptimizedData(data.generated);
      } else {
        alert(data.error || "Failed to generate AI description");
      }
    } catch (err) {
      alert("Error generating product description: " + err.message);
    } finally {
      setOptimizing(false);
    }
  };

  const handlePushToShopify = async () => {
    if (!selectedProduct || !optimizedData) return;
    setPushingProduct(true);
    setProductSuccessMsg("");
    try {
      const res = await fetch("/api/shopify/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-product",
          productId: selectedProduct.id,
          bodyHtml: optimizedData.bodyHtml,
          tags: optimizedData.suggestedTags,
          seoTitle: optimizedData.seoTitle,
          seoDescription: optimizedData.seoDescription,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setProductSuccessMsg("🎉 Successfully pushed live to your Shopify store!");
        // Update local list
        setProducts((prev) =>
          prev.map((p) =>
            p.id === selectedProduct.id
              ? { ...p, body_html: optimizedData.bodyHtml, tags: optimizedData.suggestedTags?.join(", ") }
              : p
          )
        );
      } else {
        alert(data.error || "Failed to push update to Shopify");
      }
    } catch (err) {
      alert("Error updating product: " + err.message);
    } finally {
      setPushingProduct(false);
    }
  };

  const handlePublishShopifyBlog = async (e) => {
    e.preventDefault();
    if (!blogTopic.trim()) {
      alert("Please enter a blog topic.");
      return;
    }
    if (!selectedBlogId) {
      alert("Please select a Shopify Blog channel.");
      return;
    }

    setPublishingBlog(true);
    setBlogSuccessMsg("");
    setPublishedArticleUrl("");

    try {
      // 1. Generate SEO blog content using Gemini
      const genRes = await fetch("/api/shopify/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-product-description",
          title: blogTopic,
          keywords: blogKeywords,
          category: "SEO Blog Article",
          tone: "engaging, authoritative, and helpful",
        }),
      });

      const genData = await genRes.json();
      const articleHtml = genData?.generated?.bodyHtml || `<p>${blogTopic} overview and industry insights.</p>`;

      // 2. Publish to Shopify Blog
      const pubRes = await fetch("/api/shopify/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "publish-blog",
          blogId: selectedBlogId,
          title: blogTopic,
          bodyHtml: articleHtml,
          tags: blogKeywords,
          isDraft,
          author: "GabbarInfo AI",
        }),
      });

      const pubData = await pubRes.json();
      if (pubData.ok) {
        setBlogSuccessMsg(pubData.message || "Article published successfully!");
        if (pubData.articleUrl) setPublishedArticleUrl(pubData.articleUrl);
        setBlogTopic("");
        setBlogKeywords("");
      } else {
        alert(pubData.error || "Failed to publish article");
      }
    } catch (err) {
      alert("Error publishing blog: " + err.message);
    } finally {
      setPublishingBlog(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>⏳</div>
        <div>Loading Shopify engine connection…</div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW A: NOT CONNECTED (1-CLICK OAUTH ONBOARDING)
  // -------------------------------------------------------------
  if (!connection) {
    return (
      <div
        style={{
          background: "linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(8, 13, 22, 0.95) 100%)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 20,
          padding: "clamp(24px, 4vw, 36px)",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "linear-gradient(135deg, rgba(149, 191, 71, 0.2) 0%, rgba(8, 11, 17, 0.9) 100%)",
              border: "1px solid rgba(149, 191, 71, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              boxShadow: "0 0 20px rgba(149, 191, 71, 0.25)",
            }}
          >
            🛍️
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#fff" }}>
                Connect Shopify Store
              </h3>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "rgba(149, 191, 71, 0.15)",
                  color: "#95bf47",
                  border: "1px solid rgba(149, 191, 71, 0.3)",
                }}
              >
                1-Click OAuth
              </span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
              Autonomous SEO blogs, catalog crawler, and AI product description optimization for your store.
            </p>
          </div>
        </div>

        {/* Feature checklist */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 26 }}>
          {[
            { icon: "⚡", title: "1-Click Secure Pairing", desc: "No manual API tokens needed. Authorize directly through Shopify." },
            { icon: "✍️", title: "Autonomous Blog Engine", desc: "Publishes 1,500+ word rank-seeking articles linking back to your products." },
            { icon: "🛍️", title: "AI Product Descriptions", desc: "Rewrites product listings with value hooks, benefit bullets, and FAQs." },
            { icon: "🔍", title: "SEO Metafields Sync", desc: "Updates Google Search preview titles and meta descriptions automatically." },
          ].map((f, i) => (
            <div
              key={i}
              style={{
                padding: "14px 16px",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                borderRadius: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 16 }}>{f.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>{f.title}</span>
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.4 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Store Domain Input & Connect Button */}
        <form onSubmit={handleConnect} style={{ maxWidth: 580 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 8 }}>
            Enter your Shopify Store Domain:
          </label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 260, position: "relative" }}>
              <input
                type="text"
                placeholder="e.g. bellandiva.myshopify.com or yourstore"
                value={shopInput}
                onChange={(e) => setShopInput(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#fff",
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>
            <button
              type="submit"
              disabled={connecting}
              style={{
                padding: "12px 24px",
                borderRadius: 10,
                background: "linear-gradient(135deg, #95bf47 0%, #5e8e3e 100%)",
                border: "none",
                color: "#0f172a",
                fontWeight: 800,
                fontSize: 14,
                cursor: connecting ? "not-allowed" : "pointer",
                boxShadow: "0 4px 15px rgba(149, 191, 71, 0.35)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>{connecting ? "Connecting…" : "Connect Shopify Store ↗"}</span>
            </button>
          </div>

          {errorMsg && (
            <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#fca5a5", fontSize: 13 }}>
              {errorMsg}
            </div>
          )}

          <div style={{ marginTop: 14, fontSize: 11.5, color: "#64748b" }}>
            🔒 Official Shopify App OAuth · 256-Bit SSL Encrypted · You will approve access on Shopify.
          </div>
        </form>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW B: STORE CONNECTED (EXECUTIVE WORKSTATION)
  // -------------------------------------------------------------
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Connected Store Header Card */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(8, 13, 22, 0.95) 100%)",
          border: "1px solid rgba(149, 191, 71, 0.3)",
          borderRadius: 20,
          padding: "20px 24px",
          boxShadow: "0 8px 30px rgba(0, 0, 0, 0.4)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(149, 191, 71, 0.25) 0%, rgba(8, 11, 17, 0.9) 100%)",
              border: "1px solid rgba(149, 191, 71, 0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              boxShadow: "0 0 16px rgba(149, 191, 71, 0.3)",
            }}
          >
            🛍️
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#fff" }}>
                {connection.shopName || connection.shop}
              </h3>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "rgba(16, 185, 129, 0.15)",
                  color: "#34d399",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
                STORE PAIRED
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span>Domain: <strong style={{ color: "#e2e8f0" }}>{connection.domain || connection.shop}</strong></span>
              <span>Currency: <strong style={{ color: "#e2e8f0" }}>{connection.currency}</strong></span>
              {connection.country && <span>Market: <strong style={{ color: "#e2e8f0" }}>{connection.country}</strong></span>}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a
            href={`https://${connection.domain || connection.shop}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#cbd5e1",
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Visit Store ↗
          </a>
          <button
            onClick={handleDisconnect}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              color: "#fca5a5",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* Sub-Tabs Switcher */}
      <div style={{ display: "flex", gap: 10, borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: 12 }}>
        <button
          onClick={() => setActiveSubTab("products")}
          style={{
            padding: "8px 18px",
            borderRadius: 10,
            background: activeSubTab === "products" ? "rgba(149, 191, 71, 0.18)" : "transparent",
            border: activeSubTab === "products" ? "1px solid rgba(149, 191, 71, 0.4)" : "1px solid transparent",
            color: activeSubTab === "products" ? "#95bf47" : "#94a3b8",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>🛍️</span> AI Product Descriptions ({products.length})
        </button>

        <button
          onClick={() => setActiveSubTab("blogs")}
          style={{
            padding: "8px 18px",
            borderRadius: 10,
            background: activeSubTab === "blogs" ? "rgba(59, 130, 246, 0.18)" : "transparent",
            border: activeSubTab === "blogs" ? "1px solid rgba(59, 130, 246, 0.4)" : "1px solid transparent",
            color: activeSubTab === "blogs" ? "#60a5fa" : "#94a3b8",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>✍️</span> Shopify Blog SEO Publisher
        </button>
      </div>

      {/* -------------------------------------------------------------
          SUB-TAB 1: AI PRODUCT DESCRIPTION SUITE
      ------------------------------------------------------------- */}
      {activeSubTab === "products" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>
                Catalog SEO & Product Descriptions
              </h4>
              <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#94a3b8" }}>
                Scan store products and generate conversion-engineered, rank-seeking descriptions with 1-click live push.
              </p>
            </div>
            <button
              onClick={fetchProducts}
              disabled={productsLoading}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#e2e8f0",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {productsLoading ? "Refreshing…" : "🔄 Refresh Products"}
            </button>
          </div>

          {productsLoading && (
            <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
              ⏳ Crawling Shopify catalog…
            </div>
          )}

          {!productsLoading && products.length === 0 && (
            <div style={{ padding: 30, textAlign: "center", color: "#64748b", background: "rgba(0,0,0,0.2)", borderRadius: 12 }}>
              No products found in this store yet.
            </div>
          )}

          {/* Products Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {products.map((p) => {
              const imageSrc = p.images?.[0]?.src || null;
              const hasDescription = Boolean(p.body_html && p.body_html.length > 80);

              return (
                <div
                  key={p.id}
                  style={{
                    background: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: 14,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    transition: "transform 0.15s, border-color 0.15s",
                  }}
                >
                  {/* Thumbnail */}
                  <div
                    style={{
                      height: 140,
                      background: "rgba(0, 0, 0, 0.5)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    {imageSrc ? (
                      <img src={imageSrc} alt={p.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span style={{ fontSize: 36 }}>🛍️</span>
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ padding: 14, flex: 1, display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", lineHeight: 1.3, maxHeight: 36, overflow: "hidden" }}>
                        {p.title}
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: "2px 6px",
                          borderRadius: 6,
                          background: hasDescription ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                          color: hasDescription ? "#34d399" : "#fbbf24",
                          flexShrink: 0,
                        }}
                      >
                        {hasDescription ? "Optimized" : "Needs SEO"}
                      </span>
                    </div>

                    <div style={{ fontSize: 11.5, color: "#64748b", marginBottom: 12 }}>
                      {p.vendor && <span>Vendor: {p.vendor} · </span>}
                      <span>Type: {p.product_type || "Standard"}</span>
                    </div>

                    <div style={{ marginTop: "auto" }}>
                      <button
                        onClick={() => openOptimizeModal(p)}
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          borderRadius: 8,
                          background: "linear-gradient(135deg, rgba(149, 191, 71, 0.2) 0%, rgba(94, 142, 62, 0.25) 100%)",
                          border: "1px solid rgba(149, 191, 71, 0.4)",
                          color: "#95bf47",
                          fontWeight: 700,
                          fontSize: 12.5,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          transition: "all 0.15s",
                        }}
                      >
                        <span>✨</span> Optimize with AI
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          SUB-TAB 2: SHOPIFY BLOG PUBLISHER
      ------------------------------------------------------------- */}
      {activeSubTab === "blogs" && (
        <div
          style={{
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 16,
            padding: "24px",
          }}
        >
          <h4 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 700, color: "#fff" }}>
            Publish Autonomous SEO Article to Shopify Blog
          </h4>
          <p style={{ margin: "0 0 20px 0", fontSize: 13, color: "#94a3b8" }}>
            Creates high-authority articles with structured headers, product mention links, and SEO tags.
          </p>

          <form onSubmit={handlePublishShopifyBlog} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                Target Blog Channel:
              </label>
              <select
                value={selectedBlogId}
                onChange={(e) => setSelectedBlogId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "#0b101b",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#fff",
                  fontSize: 13,
                }}
              >
                {blogs.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} ({b.handle})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                Article Topic / Target Keyword:
              </label>
              <input
                type="text"
                placeholder="e.g. 10 Luxury Style Essentials for the Modern British Wardrobe"
                value={blogTopic}
                onChange={(e) => setBlogTopic(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "#0b101b",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#fff",
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                Secondary Target Keywords (comma-separated):
              </label>
              <input
                type="text"
                placeholder="e.g. designer dresses, luxury fashion UK, premium silk wear"
                value={blogKeywords}
                onChange={(e) => setBlogKeywords(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "#0b101b",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#fff",
                  fontSize: 13,
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="checkbox"
                id="shopifyDraftCheckbox"
                checked={isDraft}
                onChange={(e) => setIsDraft(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "#3b82f6" }}
              />
              <label htmlFor="shopifyDraftCheckbox" style={{ fontSize: 13, color: "#cbd5e1", cursor: "pointer" }}>
                Save as Shopify Draft (uncheck to publish live immediately)
              </label>
            </div>

            <button
              type="submit"
              disabled={publishingBlog}
              style={{
                padding: "12px 20px",
                borderRadius: 10,
                background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                border: "none",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                cursor: publishingBlog ? "not-allowed" : "pointer",
                boxShadow: "0 4px 15px rgba(37, 99, 235, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <span>{publishingBlog ? "Synthesizing & Publishing…" : "🚀 Generate & Publish Article to Shopify"}</span>
            </button>

            {blogSuccessMsg && (
              <div style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#34d399", fontSize: 13 }}>
                <div>{blogSuccessMsg}</div>
                {publishedArticleUrl && (
                  <div style={{ marginTop: 6 }}>
                    <a href={publishedArticleUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", textDecoration: "underline" }}>
                      View Live Article on Shopify ↗
                    </a>
                  </div>
                )}
              </div>
            )}
          </form>
        </div>
      )}

      {/* -------------------------------------------------------------
          AI PRODUCT OPTIMIZER MODAL (SIDE-BY-SIDE BEFORE/AFTER)
      ------------------------------------------------------------- */}
      {selectedProduct && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#0d131f",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: 20,
              width: "100%",
              maxWidth: 900,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.8)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "16px 22px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(255, 255, 255, 0.02)",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#fff" }}>
                  AI SEO Product Optimizer
                </h3>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                  {selectedProduct.title}
                </div>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: 20,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 22, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Target Controls */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 4 }}>
                    Target SEO Keywords:
                  </label>
                  <input
                    type="text"
                    value={targetKeywords}
                    onChange={(e) => setTargetKeywords(e.target.value)}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "#070a10",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#fff",
                      fontSize: 12.5,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 4 }}>
                    Tone & Voice:
                  </label>
                  <select
                    value={targetTone}
                    onChange={(e) => setTargetTone(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "#070a10",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#fff",
                      fontSize: 12.5,
                    }}
                  >
                    <option value="luxury, persuasive, and conversion-focused">Luxury & Persuasive</option>
                    <option value="punchy, trendy, and benefit-driven">Punchy & Modern</option>
                    <option value="technical, authoritative, and informative">Technical & Informative</option>
                    <option value="friendly, casual, and relatable">Friendly & Relatable</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleGenerateDescription}
                disabled={optimizing}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #95bf47 0%, #5e8e3e 100%)",
                  border: "none",
                  color: "#0f172a",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: optimizing ? "not-allowed" : "pointer",
                  boxShadow: "0 2px 10px rgba(149, 191, 71, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <span>{optimizing ? "Generating High-Converting Copy…" : "✨ Generate AI Description"}</span>
              </button>

              {/* Side-by-side Preview */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16 }}>
                {/* Left: Current on Store */}
                <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 8 }}>
                    Current Store Description
                  </div>
                  <div
                    style={{ fontSize: 12, color: "#cbd5e1", maxHeight: 260, overflowY: "auto", lineHeight: 1.5 }}
                    dangerouslySetInnerHTML={{ __html: selectedProduct.body_html || "<em>No description set on Shopify.</em>" }}
                  />
                </div>

                {/* Right: AI Optimized Preview */}
                <div style={{ background: "rgba(149, 191, 71, 0.04)", borderRadius: 12, padding: 14, border: "1px solid rgba(149, 191, 71, 0.25)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#95bf47", textTransform: "uppercase" }}>
                      AI Optimized Preview
                    </span>
                    {optimizedData && (
                      <span style={{ fontSize: 10, color: "#34d399", fontWeight: 700 }}>Ready to Push</span>
                    )}
                  </div>

                  {!optimizedData && !optimizing && (
                    <div style={{ color: "#64748b", fontSize: 12, padding: "30px 0", textAlign: "center" }}>
                      Click "Generate AI Description" above to create rank-seeking product copy.
                    </div>
                  )}

                  {optimizing && (
                    <div style={{ color: "#95bf47", fontSize: 12, padding: "30px 0", textAlign: "center" }}>
                      ⏳ Synthesizing product benefits, specifications, and SEO schema…
                    </div>
                  )}

                  {optimizedData && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {/* Google Search Snippet Preview */}
                      <div style={{ padding: "8px 10px", background: "#0b101b", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700, marginBottom: 2 }}>
                          Google Search Result Preview
                        </div>
                        <div style={{ fontSize: 13, color: "#60a5fa", fontWeight: 600 }}>
                          {optimizedData.seoTitle}
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                          {optimizedData.seoDescription}
                        </div>
                      </div>

                      {/* Body HTML */}
                      <div
                        style={{ fontSize: 12, color: "#e2e8f0", maxHeight: 220, overflowY: "auto", lineHeight: 1.5 }}
                        dangerouslySetInnerHTML={{ __html: optimizedData.bodyHtml }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {productSuccessMsg && (
                <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#34d399", fontSize: 13, textAlign: "center" }}>
                  {productSuccessMsg}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "14px 22px",
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(255, 255, 255, 0.02)",
              }}
            >
              <button
                onClick={() => setSelectedProduct(null)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  color: "#94a3b8",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Close
              </button>

              <button
                onClick={handlePushToShopify}
                disabled={!optimizedData || pushingProduct}
                style={{
                  padding: "10px 22px",
                  borderRadius: 8,
                  background: optimizedData
                    ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                    : "rgba(255, 255, 255, 0.05)",
                  border: "none",
                  color: optimizedData ? "#fff" : "#64748b",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: optimizedData && !pushingProduct ? "pointer" : "not-allowed",
                  boxShadow: optimizedData ? "0 2px 10px rgba(16, 185, 129, 0.35)" : "none",
                }}
              >
                {pushingProduct ? "Pushing Live…" : "🚀 Push to Live Shopify Store"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
