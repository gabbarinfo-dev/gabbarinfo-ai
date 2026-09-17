"use client";

import { useEffect, useState } from "react";

export default function ShopifyStoreConnect({ onConnectionChange }) {
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState(null);
  const [shopInput, setShopInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeSubTab, setActiveSubTab] = useState("products"); // "products" | "blogs"
  const [connectMode, setConnectMode] = useState("oauth"); // "oauth" | "token"
  const [customToken, setCustomToken] = useState("");
  const [tokenConnecting, setTokenConnecting] = useState(false);

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
  const [blogsLoading, setBlogsLoading] = useState(false);
  const [blogsError, setBlogsError] = useState("");
  const [selectedBlogId, setSelectedBlogId] = useState("");
  const [blogTopic, setBlogTopic] = useState("");
  const [blogKeywords, setBlogKeywords] = useState("");
  const [blogTargetLocations, setBlogTargetLocations] = useState("");
  const [isDraft, setIsDraft] = useState(false);
  const [requireReview, setRequireReview] = useState(true);
  const [generatingBlog, setGeneratingBlog] = useState(false);
  const [previewArticle, setPreviewArticle] = useState(null);
  const [publishingBlog, setPublishingBlog] = useState(false);
  const [blogSuccessMsg, setBlogSuccessMsg] = useState("");
  const [publishedArticleUrl, setPublishedArticleUrl] = useState("");

  // Autopilot Suite State (Railway Engine)
  const [autopilotLoading, setAutopilotLoading] = useState(false);
  const [autopilotSaving, setAutopilotSaving] = useState(false);
  const [autopilotRunning, setAutopilotRunning] = useState(false);
  const [autopilotNotice, setAutopilotNotice] = useState("");
  const [autopilotConfig, setAutopilotConfig] = useState({
    enabled: false,
    cadence: "daily", // "daily" | "3x_week" | "weekly"
    blogId: "",
    blogHandle: "news",
    isDraft: false,
    targetKeywords: "",
    targetLocations: "",
    nicheFocus: "",
    lastPublishedAt: null,
    lastArticleTitle: null,
    lastArticleUrl: null,
    recentArticles: [],
  });

  useEffect(() => {
    fetchConnection();
  }, []);

  const fetchAutopilotConfig = async () => {
    setAutopilotLoading(true);
    try {
      const res = await fetch("/api/shopify/sync?action=get-autopilot-config");
      const data = await res.json();
      if (data.ok && data.config) {
        setAutopilotConfig((prev) => ({
          ...prev,
          ...data.config,
        }));
      }
    } catch (e) {
      console.warn("Failed to fetch Shopify autopilot config:", e);
    } finally {
      setAutopilotLoading(false);
    }
  };

  const handleSaveAutopilot = async (overrideEnabled = null) => {
    setAutopilotSaving(true);
    setAutopilotNotice("");
    const isEnabled = typeof overrideEnabled === "boolean" ? overrideEnabled : autopilotConfig.enabled;
    const toSave = {
      ...autopilotConfig,
      enabled: isEnabled,
      blogId: autopilotConfig.blogId || selectedBlogId,
      blogHandle: blogs.find((b) => String(b.id) === String(autopilotConfig.blogId || selectedBlogId))?.handle || "news",
    };

    try {
      const res = await fetch("/api/shopify/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-autopilot-config",
          config: toSave,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setAutopilotConfig(data.config || toSave);
        setAutopilotNotice(
          `✅ Autopilot schedule saved (${isEnabled ? "Active" : "Paused"}, ${
            toSave.cadence === "daily" ? "Daily" : toSave.cadence === "3x_week" ? "3x / Week" : "Weekly"
          }). Background routine updated on Railway.`
        );
        setTimeout(() => setAutopilotNotice(""), 6000);
      } else {
        alert("Failed to save autopilot settings: " + (data.error || "Unknown"));
      }
    } catch (e) {
      alert("Error saving autopilot settings: " + e.message);
    } finally {
      setAutopilotSaving(false);
    }
  };

  const handleTriggerAutopilot = async () => {
    setAutopilotRunning(true);
    setAutopilotNotice("⚡ Offloading autonomous generation cycle to Railway worker (0 timeouts)...");
    try {
      const res = await fetch("/api/shopify/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "trigger-autopilot",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setAutopilotNotice(`✅ ${data.message || "Autopilot cycle completed successfully!"}`);
        fetchAutopilotConfig();
        setTimeout(() => setAutopilotNotice(""), 8000);
      } else {
        setAutopilotNotice("❌ Cycle trigger failed: " + (data.error || "Unknown"));
      }
    } catch (e) {
      setAutopilotNotice("❌ Trigger error: " + e.message);
    } finally {
      setAutopilotRunning(false);
    }
  };

  const fetchConnection = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/shopify/sync?action=get-connection");
      const data = await res.json();
      if (data.ok && data.connected) {
        setConnection(data.connection);
        if (onConnectionChange) onConnectionChange(true);
        // Pre-fetch products, blogs, and autopilot
        fetchProducts();
        fetchBlogs();
        fetchAutopilotConfig();
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
    let normalized = shopInput.trim().toLowerCase();
    if (normalized.includes("admin.shopify.com/store/")) {
      const match = normalized.match(/admin\.shopify\.com\/store\/([a-zA-Z0-9\-]+)/);
      if (match && match[1]) {
        normalized = `${match[1]}.myshopify.com`;
      }
    } else {
      normalized = normalized.replace(/^https?:\/\//, "").replace(/\/+$/, "");
      if (normalized.includes("/")) {
        normalized = normalized.split("/")[0];
      }
      if (!normalized.includes(".")) {
        normalized = `${normalized}.myshopify.com`;
      }
    }

    // Redirect to OAuth initiation endpoint
    window.location.href = `/api/shopify/connect?shop=${encodeURIComponent(normalized)}`;
  };

  const handleConnectToken = async (e) => {
    e.preventDefault();
    if (!shopInput.trim()) {
      setErrorMsg("Please enter your Shopify store domain (e.g. p0n7tf-yp.myshopify.com).");
      return;
    }
    if (!customToken.trim()) {
      setErrorMsg("Please enter your Shopify Admin API Access Token (shpat_...).");
      return;
    }

    setTokenConnecting(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/shopify/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "connect-token",
          shop: shopInput.trim(),
          accessToken: customToken.trim(),
        }),
      });

      const data = await res.json();
      if (data.ok && data.connection) {
        setConnection(data.connection);
        if (onConnectionChange) onConnectionChange(true);
        fetchProducts();
        fetchBlogs();
      } else {
        setErrorMsg(data.error || "Failed to pair store with access token.");
      }
    } catch (err) {
      setErrorMsg("Error pairing store: " + err.message);
    } finally {
      setTokenConnecting(false);
    }
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
      const res = await fetch("/api/shopify/sync?action=list-products&limit=250");
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
    setBlogsLoading(true);
    setBlogsError("");
    try {
      const res = await fetch("/api/shopify/sync?action=list-blogs");
      const data = await res.json();
      if (data.ok && data.blogs?.length > 0) {
        setBlogs(data.blogs);
        setSelectedBlogId(String(data.blogs[0].id));
      } else if (!data.ok) {
        setBlogsError(data.error || "Failed to load blogs from Shopify store.");
      } else {
        setBlogs([]);
      }
    } catch (err) {
      console.error("Failed to load Shopify blogs:", err);
      setBlogsError(err.message);
    } finally {
      setBlogsLoading(false);
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

    setBlogSuccessMsg("");
    setPublishedArticleUrl("");

    if (requireReview) {
      setGeneratingBlog(true);
      try {
        const genRes = await fetch("/api/shopify/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "generate-blog",
            topic: blogTopic,
            keywords: blogKeywords,
            targetLocations: blogTargetLocations,
            tone: "engaging, authoritative, and conversion-focused",
          }),
        });

        const resText = await genRes.text();
        let genData;
        try {
          genData = JSON.parse(resText);
        } catch {
          throw new Error(
            `Server responded with status ${genRes.status}: ${resText.slice(0, 120)}`
          );
        }

        if (genData.ok && genData.generated) {
          setPreviewArticle({
            title: genData.generated.title || blogTopic,
            bodyHtml: genData.generated.bodyHtml,
            tags: genData.generated.tags || blogKeywords,
            seoDescription: genData.generated.seoDescription || "",
            imageBase64: genData.generated.imageBase64 || null,
            imageUrl: genData.generated.imageUrl || null,
          });
        } else {
          alert(genData.error || "Failed to generate AI blog article");
        }
      } catch (err) {
        alert("Error generating blog article: " + err.message);
      } finally {
        setGeneratingBlog(false);
      }
    } else {
      executeFinalPublish();
    }
  };

  const executeFinalPublish = async (overrideArticle = null) => {
    setPublishingBlog(true);
    setBlogSuccessMsg("");
    setPublishedArticleUrl("");

    try {
      const target = overrideArticle || previewArticle;
      let articleTitle = target?.title || blogTopic;
      let articleHtml = target?.bodyHtml || "";
      let articleTags = target?.tags || blogKeywords;
      let summaryHtml = target?.seoDescription || "";
      let imageBase64 = target?.imageBase64 || null;
      let imageUrl = target?.imageUrl || null;

      if (!articleHtml) {
        // Direct flow without preview
        const genRes = await fetch("/api/shopify/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "generate-blog",
            topic: blogTopic,
            keywords: blogKeywords,
            targetLocations: blogTargetLocations,
            tone: "engaging, authoritative, and conversion-focused",
          }),
        });
        const genText = await genRes.text();
        let genData;
        try {
          genData = JSON.parse(genText);
        } catch {
          throw new Error(`Server returned status ${genRes.status}: ${genText.slice(0, 120)}`);
        }
        if (!genData.ok) {
          throw new Error(genData.error || "Failed to generate blog article");
        }
        articleTitle = genData.generated.title || blogTopic;
        articleHtml = genData.generated.bodyHtml;
        articleTags = genData.generated.tags || blogKeywords;
        summaryHtml = genData.generated.seoDescription || "";
        imageBase64 = genData.generated.imageBase64 || null;
        imageUrl = genData.generated.imageUrl || null;
      }

      const currentBlog = blogs.find((b) => String(b.id) === String(selectedBlogId));
      const blogHandle = currentBlog?.handle || "news";

      const pubRes = await fetch("/api/shopify/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "publish-blog",
          blogId: selectedBlogId,
          blogHandle: blogHandle,
          title: articleTitle,
          bodyHtml: articleHtml,
          summaryHtml: summaryHtml,
          tags: articleTags,
          imageBase64,
          imageUrl,
          isDraft,
          author: "GabbarInfo AI",
        }),
      });

      const pubText = await pubRes.text();
      let pubData;
      try {
        pubData = JSON.parse(pubText);
      } catch {
        throw new Error(`Publish error (${pubRes.status}): ${pubText.slice(0, 120)}`);
      }
      if (pubData.ok) {
        setBlogSuccessMsg(pubData.message || "Article published successfully!");
        if (pubData.articleUrl) setPublishedArticleUrl(pubData.articleUrl);
        setPreviewArticle(null);
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

        {/* Connection Method Selector */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          <button
            type="button"
            onClick={() => { setConnectMode("oauth"); setErrorMsg(""); }}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              border: connectMode === "oauth" ? "1px solid #95bf47" : "1px solid rgba(255,255,255,0.1)",
              background: connectMode === "oauth" ? "rgba(149, 191, 71, 0.15)" : "rgba(255,255,255,0.03)",
              color: connectMode === "oauth" ? "#95bf47" : "#94a3b8",
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            ⚡ 1-Click OAuth Pairing
          </button>
          <button
            type="button"
            onClick={() => { setConnectMode("token"); setErrorMsg(""); }}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              border: connectMode === "token" ? "1px solid #95bf47" : "1px solid rgba(255,255,255,0.1)",
              background: connectMode === "token" ? "rgba(149, 191, 71, 0.15)" : "rgba(255,255,255,0.03)",
              color: connectMode === "token" ? "#95bf47" : "#94a3b8",
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            🔑 Custom App API Token (Zero Redirects)
          </button>
        </div>

        {/* MODE 1: 1-CLICK OAUTH */}
        {connectMode === "oauth" ? (
          <form onSubmit={handleConnect} style={{ maxWidth: 580 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 8 }}>
              Enter your Shopify Store Domain:
            </label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 260, position: "relative" }}>
                <input
                  type="text"
                  placeholder="e.g. p0n7tf-yp.myshopify.com or www.bellandiva.com"
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
        ) : (
          /* MODE 2: CUSTOM APP ACCESS TOKEN (ZERO REDIRECTS) */
          <form onSubmit={handleConnectToken} style={{ maxWidth: 580 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 6 }}>
                  Shopify Store Domain / Handle:
                </label>
                <input
                  type="text"
                  placeholder="e.g. p0n7tf-yp.myshopify.com"
                  value={shopInput}
                  onChange={(e) => setShopInput(e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "rgba(0, 0, 0, 0.4)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#fff",
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 6 }}>
                  Admin API Access Token:
                </label>
                <input
                  type="password"
                  placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={customToken}
                  onChange={(e) => setCustomToken(e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "rgba(0, 0, 0, 0.4)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#fff",
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </div>

              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.07)",
                  fontSize: 12,
                  color: "#94a3b8",
                  lineHeight: 1.5,
                }}
              >
                💡 <strong>Where to get this token in 30 seconds:</strong> In your Shopify Admin, go to <strong>Settings ➔ Apps and sales channels ➔ Develop apps ➔ Create an app ➔ Configure scopes</strong> (select <em>read/write products</em> and <em>read/write content</em>) ➔ Click <strong>Install app</strong> and copy the token.
              </div>

              <button
                type="submit"
                disabled={tokenConnecting}
                style={{
                  padding: "12px 24px",
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #95bf47 0%, #5e8e3e 100%)",
                  border: "none",
                  color: "#0f172a",
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: tokenConnecting ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 15px rgba(149, 191, 71, 0.35)",
                  alignSelf: "flex-start",
                }}
              >
                {tokenConnecting ? "Verifying & Pairing…" : "Pair Store with Token ➔"}
              </button>
            </div>

            {errorMsg && (
              <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#fca5a5", fontSize: 13 }}>
                {errorMsg}
              </div>
            )}
          </form>
        )}
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
      <div style={{ display: "flex", gap: 10, borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: 12, flexWrap: "wrap" }}>
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
          <span>✍️</span> Manual Blog Generator
        </button>

        <button
          onClick={() => {
            setActiveSubTab("autopilot");
            fetchAutopilotConfig();
          }}
          style={{
            padding: "8px 18px",
            borderRadius: 10,
            background: activeSubTab === "autopilot" ? "rgba(16, 185, 129, 0.18)" : "transparent",
            border: activeSubTab === "autopilot" ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid transparent",
            color: activeSubTab === "autopilot" ? "#34d399" : "#94a3b8",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>⚡</span> Autonomous SEO Autopilot
          {autopilotConfig.enabled && (
            <span style={{ fontSize: 9, background: "#10b981", color: "#052e16", padding: "1px 6px", borderRadius: 99, fontWeight: 800 }}>
              ACTIVE
            </span>
          )}
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: "#cbd5e1" }}>
                  Target Blog Channel:
                </label>
                <button
                  type="button"
                  onClick={fetchBlogs}
                  disabled={blogsLoading}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#38bdf8",
                    fontSize: 12,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  {blogsLoading ? "Refreshing..." : "↻ Refresh Channels"}
                </button>
              </div>
              <select
                value={selectedBlogId}
                onChange={(e) => setSelectedBlogId(e.target.value)}
                disabled={blogsLoading}
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
                {blogs.length === 0 && (
                  <option value="">
                    {blogsLoading ? "Loading blog channels..." : "No blogs found (Click Refresh Channels)"}
                  </option>
                )}
                {blogs.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} ({b.handle})
                  </option>
                ))}
              </select>
              {blogsError && (
                <div style={{ marginTop: 6, fontSize: 11.5, color: "#f87171", background: "rgba(239, 68, 68, 0.1)", padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                  ⚠️ {blogsError}
                </div>
              )}
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

            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                🌍 Target Countries or Cities / Regional Market (optional):
              </label>
              <input
                type="text"
                placeholder="e.g. United States, United Kingdom, Canada, or India, Mumbai, Delhi, Dubai, Toronto"
                value={blogTargetLocations}
                onChange={(e) => setBlogTargetLocations(e.target.value)}
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
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "#64748b" }}>Quick Presets:</span>
                {[
                  { label: "🌐 Global", val: "Global Commercial Markets" },
                  { label: "🇺🇸 USA & Canada", val: "United States, Canada" },
                  { label: "🇬🇧 UK & Europe", val: "United Kingdom, London, Germany, France" },
                  { label: "🇮🇳 India", val: "India, Mumbai, Delhi, Bangalore" },
                  { label: "🇦🇪 UAE & Gulf", val: "United Arab Emirates, Dubai, Saudi Arabia" },
                  { label: "🇦🇺 Australia", val: "Australia, Sydney, Melbourne" },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setBlogTargetLocations(p.val)}
                    style={{
                      padding: "3px 8px",
                      borderRadius: 5,
                      border: blogTargetLocations === p.val ? "1px solid #f59e0b" : "1px solid rgba(255, 255, 255, 0.1)",
                      background: blogTargetLocations === p.val ? "rgba(245, 158, 11, 0.15)" : "rgba(255, 255, 255, 0.04)",
                      color: blogTargetLocations === p.val ? "#fbbf24" : "#94a3b8",
                      fontSize: 10.5,
                      cursor: "pointer",
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "4px 0" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#f8fafc", cursor: "pointer", fontWeight: 600 }}>
                <input
                  type="checkbox"
                  id="shopifyReviewCheckbox"
                  checked={requireReview}
                  onChange={(e) => setRequireReview(e.target.checked)}
                  style={{ width: 17, height: 17, accentColor: "#f59e0b", cursor: "pointer" }}
                />
                <span>👁️ Review & Preview on Screen (inspect AI article before publishing)</span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#cbd5e1", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  id="shopifyDraftCheckbox"
                  checked={isDraft}
                  onChange={(e) => setIsDraft(e.target.checked)}
                  style={{ width: 17, height: 17, accentColor: "#3b82f6", cursor: "pointer" }}
                />
                <span>Save as Shopify Draft (uncheck to publish live immediately)</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={generatingBlog || publishingBlog}
              style={{
                padding: "13px 22px",
                borderRadius: 10,
                background: requireReview
                  ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                  : "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                border: "none",
                color: requireReview ? "#000" : "#fff",
                fontWeight: 800,
                fontSize: 14,
                cursor: (generatingBlog || publishingBlog) ? "not-allowed" : "pointer",
                boxShadow: requireReview
                  ? "0 4px 15px rgba(245, 158, 11, 0.35)"
                  : "0 4px 15px rgba(37, 99, 235, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <span>
                {generatingBlog
                  ? "⚡ Generating article for review…"
                  : publishingBlog
                  ? "Publishing to Shopify…"
                  : requireReview
                  ? "⚡ Generate & Review Article First ↗"
                  : "🚀 Generate & Publish Directly to Shopify"}
              </span>
            </button>

            {/* In-Page Review & Approval Workspace */}
            {previewArticle && (
              <div
                style={{
                  marginTop: 18,
                  padding: "22px 20px",
                  borderRadius: 14,
                  background: "linear-gradient(180deg, rgba(17, 24, 39, 0.95) 0%, rgba(10, 15, 26, 0.98) 100%)",
                  border: "1px solid rgba(245, 183, 22, 0.35)",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>📄</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: "#f8fafc" }}>
                      Article Review & Approval Workspace
                    </span>
                  </div>
                  <span style={{ fontSize: 11, background: "rgba(245, 183, 22, 0.15)", color: "#f59e0b", padding: "4px 10px", borderRadius: 999, border: "1px solid rgba(245, 183, 22, 0.3)", fontWeight: 700 }}>
                    Preview Mode (Not yet in Shopify)
                  </span>
                </div>

                {/* Featured Image Preview */}
                {(previewArticle.imageBase64 || previewArticle.imageUrl) && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8" }}>
                        🎨 Featured Hero Image
                      </span>
                      <span style={{ fontSize: 10.5, color: "#34d399", fontWeight: 700 }}>
                        ✓ 1024x1024 Ready for Shopify CDN
                      </span>
                    </div>
                    <img
                      src={
                        previewArticle.imageBase64
                          ? `data:image/jpeg;base64,${previewArticle.imageBase64}`
                          : previewArticle.imageUrl
                      }
                      alt={previewArticle.title}
                      style={{
                        width: "100%",
                        maxHeight: 280,
                        objectFit: "cover",
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}
                    />
                  </div>
                )}

                {/* Editable Title */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>
                    Article Title (H1):
                  </label>
                  <input
                    type="text"
                    value={previewArticle.title}
                    onChange={(e) => setPreviewArticle({ ...previewArticle, title: e.target.value })}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "8px 12px",
                      borderRadius: 6,
                      background: "#080c14",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  />
                </div>

                {/* Editable SEO Meta Description */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>
                    SEO Meta Summary:
                  </label>
                  <textarea
                    rows={2}
                    value={previewArticle.seoDescription || ""}
                    onChange={(e) => setPreviewArticle({ ...previewArticle, seoDescription: e.target.value })}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "8px 12px",
                      borderRadius: 6,
                      background: "#080c14",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      color: "#cbd5e1",
                      fontSize: 12,
                      resize: "vertical",
                    }}
                  />
                </div>

                {/* Scrollable Formatted Content Preview */}
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>
                    Formatted Article Body (1,500+ Words Preview):
                  </label>
                  <div
                    dangerouslySetInnerHTML={{ __html: previewArticle.bodyHtml }}
                    style={{
                      maxHeight: 260,
                      overflowY: "auto",
                      padding: "12px 16px",
                      borderRadius: 8,
                      background: "#070b13",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#cbd5e1",
                      fontSize: 12.5,
                      lineHeight: 1.6,
                    }}
                  />
                </div>

                {/* Actions: Discard vs Publish */}
                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => setPreviewArticle(null)}
                    disabled={publishingBlog}
                    style={{
                      padding: "10px 18px",
                      borderRadius: 8,
                      background: "rgba(239, 68, 68, 0.15)",
                      border: "1px solid rgba(239, 68, 68, 0.35)",
                      color: "#f87171",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    ✕ Discard Draft
                  </button>

                  <button
                    type="button"
                    onClick={() => executeFinalPublish(previewArticle)}
                    disabled={publishingBlog}
                    style={{
                      padding: "10px 22px",
                      borderRadius: 8,
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      border: "none",
                      color: "#ffffff",
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: publishingBlog ? "not-allowed" : "pointer",
                      boxShadow: "0 4px 14px rgba(16, 185, 129, 0.4)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span>{publishingBlog ? "Pushing to Shopify…" : isDraft ? "📝 Save Draft to Shopify ↗" : "🚀 Approve & Publish Live to Shopify ↗"}</span>
                  </button>
                </div>
              </div>
            )}

            {blogSuccessMsg && (
              <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.35)", color: "#34d399", fontSize: 13 }}>
                <div style={{ fontWeight: 700 }}>{blogSuccessMsg}</div>
                {publishedArticleUrl && (
                  <div style={{ marginTop: 8 }}>
                    {publishedArticleUrl.includes("admin.shopify.com") ? (
                      <div>
                        <a href={publishedArticleUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#38bdf8", fontWeight: 700, textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span>📝</span> Open & Review Draft in Shopify Admin ↗
                        </a>
                        <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 4 }}>
                          ℹ️ Draft articles are hidden from the public storefront until you click "Visible" in your Shopify Admin.
                        </div>
                      </div>
                    ) : (
                      <a href={publishedArticleUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", fontWeight: 700, textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span>🌐</span> View Live Article on Shopify Storefront ↗
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </form>
        </div>
      )}

      {/* -------------------------------------------------------------
          SUB-TAB 3: AUTONOMOUS SHOPIFY SEO AUTOPILOT (RAILWAY ENGINE)
      ------------------------------------------------------------- */}
      {activeSubTab === "autopilot" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Main Control Card */}
          <div
            style={{
              background: "rgba(16, 22, 34, 0.78)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: 14,
              padding: 24,
              boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
              <div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 20,
                    background: "rgba(16, 185, 129, 0.15)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    color: "#34d399",
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    marginBottom: 10,
                  }}
                >
                  <span>⚡</span> Railway Autonomous Engine (Unlimited Runtime)
                </div>
                <h3 style={{ margin: "0 0 6px 0", fontSize: 20, color: "#fff", fontWeight: 800 }}>
                  Autonomous Shopify SEO Velocity & Dispatch
                </h3>
                <p style={{ margin: 0, color: "#94a3b8", fontSize: 13.5, maxWidth: 700, lineHeight: 1.5 }}>
                  Every cycle, the Railway background engine analyzes your connected store's catalog ({products.length} products), avoids previously written topics, generates 1,500+ word rank-seeking articles, creates ultra-HD featured images, and posts directly to your Shopify blog with 0 timeout limits.
                </p>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                {/* Master Autopilot Toggle */}
                <button
                  type="button"
                  onClick={() => handleSaveAutopilot(!autopilotConfig.enabled)}
                  disabled={autopilotSaving}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    border: autopilotConfig.enabled ? "1px solid #10b981" : "1px solid rgba(255, 255, 255, 0.18)",
                    background: autopilotConfig.enabled ? "#10b981" : "rgba(255, 255, 255, 0.06)",
                    color: autopilotConfig.enabled ? "#052e16" : "#ffffff",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: autopilotSaving ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: autopilotConfig.enabled ? "0 0 20px rgba(16, 185, 129, 0.35)" : "none",
                    transition: "all 0.2s ease",
                  }}
                >
                  <span>{autopilotConfig.enabled ? "✓" : "▶"}</span>
                  {autopilotSaving
                    ? "Updating…"
                    : autopilotConfig.enabled
                    ? "Active Production Engine"
                    : "Enable Production Routine"}
                </button>

                {/* Immediate Trigger Button */}
                <button
                  type="button"
                  onClick={handleTriggerAutopilot}
                  disabled={autopilotRunning}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                    border: "none",
                    color: "#000",
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: autopilotRunning ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: "0 4px 15px rgba(245, 158, 11, 0.35)",
                  }}
                >
                  <span>⚡</span>
                  {autopilotRunning ? "Generating on Railway…" : "Trigger Immediate Autopilot Generation ↗"}
                </button>
              </div>
            </div>

            {/* Notice Alert */}
            {autopilotNotice && (
              <div
                style={{
                  marginTop: 18,
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: autopilotNotice.startsWith("❌") ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)",
                  border: autopilotNotice.startsWith("❌") ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid rgba(16, 185, 129, 0.35)",
                  color: autopilotNotice.startsWith("❌") ? "#fca5a5" : "#34d399",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {autopilotNotice}
              </div>
            )}
          </div>

          {/* Autopilot Settings Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
            {/* 1. Cadence Setting */}
            <div style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
                📅 Publishing Cadence
              </div>
              <p style={{ margin: "0 0 14px 0", fontSize: 12, color: "#94a3b8" }}>
                How frequently the Railway worker should autonomously dispatch new articles.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { id: "daily", label: "Daily (1 Article / Day at 09:30 AM IST)", desc: "Maximum organic velocity & crawl frequency" },
                  { id: "3x_week", label: "3x Per Week (Mon, Wed, Fri)", desc: "Consistent strategic content pacing" },
                  { id: "weekly", label: "Weekly (1 Article / Week)", desc: "Steady authority building" },
                ].map((c) => (
                  <label
                    key={c.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: autopilotConfig.cadence === c.id ? "rgba(16, 185, 129, 0.1)" : "rgba(255, 255, 255, 0.03)",
                      border: autopilotConfig.cadence === c.id ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(255, 255, 255, 0.08)",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="shopifyCadence"
                      value={c.id}
                      checked={autopilotConfig.cadence === c.id}
                      onChange={() => setAutopilotConfig({ ...autopilotConfig, cadence: c.id })}
                      style={{ marginTop: 2, accentColor: "#10b981", cursor: "pointer" }}
                    />
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: autopilotConfig.cadence === c.id ? "#34d399" : "#e2e8f0" }}>
                        {c.label}
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{c.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* 2. Target Channel & Publishing Mode */}
            <div style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
                🎯 Target Channel & Publish Status
              </div>
              <p style={{ margin: "0 0 14px 0", fontSize: 12, color: "#94a3b8" }}>
                Select where articles are delivered and whether they go live automatically.
              </p>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                  Target Shopify Blog Channel:
                </label>
                <select
                  value={autopilotConfig.blogId || selectedBlogId || ""}
                  onChange={(e) => {
                    const chosenId = e.target.value;
                    const chosen = blogs.find((b) => String(b.id) === String(chosenId));
                    setAutopilotConfig({
                      ...autopilotConfig,
                      blogId: chosenId,
                      blogHandle: chosen?.handle || "news",
                    });
                  }}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "9px 12px",
                    borderRadius: 8,
                    background: "#0b101b",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
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

              <div style={{ marginTop: 14 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#f8fafc", cursor: "pointer", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={autopilotConfig.isDraft}
                    onChange={(e) => setAutopilotConfig({ ...autopilotConfig, isDraft: e.target.checked })}
                    style={{ width: 17, height: 17, accentColor: "#3b82f6", cursor: "pointer" }}
                  />
                  <span>Save as Shopify Draft (review in Shopify Admin before live publish)</span>
                </label>
                <div style={{ fontSize: 11.5, color: "#94a3b8", marginLeft: 27, marginTop: 4 }}>
                  {autopilotConfig.isDraft
                    ? "✓ Autopilot will save articles as hidden drafts for your team to approve."
                    : "⚡ Articles will publish immediately to the live storefront."}
                </div>
              </div>
            </div>

            {/* 3. Catalog Niche Focus & Strategic Keywords */}
            <div style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
                🔍 Catalog Niche & Strategic Keywords
              </div>
              <p style={{ margin: "0 0 14px 0", fontSize: 12, color: "#94a3b8" }}>
                Guide the AI toward specific high-margin categories, collections, or SEO themes.
              </p>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                  Target Secondary Keywords / Themes:
                </label>
                <input
                  type="text"
                  placeholder="e.g. luxury winter streetwear, outdoor jackets, British silk dresses"
                  value={autopilotConfig.targetKeywords || ""}
                  onChange={(e) => setAutopilotConfig({ ...autopilotConfig, targetKeywords: e.target.value })}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "9px 12px",
                    borderRadius: 8,
                    background: "#0b101b",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#fff",
                    fontSize: 13,
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                  Priority Product Line / Niche Focus:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Winter 2026 Collection, High-End Outerwear"
                  value={autopilotConfig.nicheFocus || ""}
                  onChange={(e) => setAutopilotConfig({ ...autopilotConfig, nicheFocus: e.target.value })}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "9px 12px",
                    borderRadius: 8,
                    background: "#0b101b",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#fff",
                    fontSize: 13,
                  }}
                />
              </div>
            </div>

            {/* 4. Target Geographic Markets (Countries & Cities) */}
            <div style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
                🌍 Target Geographic Markets (Countries & Cities)
              </div>
              <p style={{ margin: "0 0 14px 0", fontSize: 12, color: "#94a3b8" }}>
                Specify which countries, states, or cities your eCommerce blogs must target. GabbarInfo AI automatically tailors regional styling nuances, seasonal relevance, currency context, and local shopping patterns to these territories.
              </p>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                  Target Countries or Cities (comma-separated):
                </label>
                <input
                  type="text"
                  placeholder="e.g. United States, United Kingdom, Canada, or India, Mumbai, Delhi, Dubai, Toronto"
                  value={autopilotConfig.targetLocations || ""}
                  onChange={(e) => setAutopilotConfig({ ...autopilotConfig, targetLocations: e.target.value })}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "9px 12px",
                    borderRadius: 8,
                    background: "#0b101b",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#fff",
                    fontSize: 13,
                  }}
                />

                {/* Quick Presets */}
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Quick Presets:</span>
                  {[
                    { label: "🌐 Global", val: "Global Commercial Markets" },
                    { label: "🇺🇸 USA & Canada", val: "United States, Canada" },
                    { label: "🇬🇧 UK & Europe", val: "United Kingdom, London, Germany, France" },
                    { label: "🇮🇳 India", val: "India, Mumbai, Delhi, Bangalore" },
                    { label: "🇦🇪 UAE & Gulf", val: "United Arab Emirates, Dubai, Saudi Arabia" },
                    { label: "🇦🇺 Australia", val: "Australia, Sydney, Melbourne" },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setAutopilotConfig({ ...autopilotConfig, targetLocations: p.val })}
                      style={{
                        padding: "3px 8px",
                        borderRadius: 5,
                        border: autopilotConfig.targetLocations === p.val ? "1px solid #f59e0b" : "1px solid rgba(255, 255, 255, 0.1)",
                        background: autopilotConfig.targetLocations === p.val ? "rgba(245, 158, 11, 0.15)" : "rgba(255, 255, 255, 0.04)",
                        color: autopilotConfig.targetLocations === p.val ? "#fbbf24" : "#94a3b8",
                        fontSize: 10.5,
                        cursor: "pointer",
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 5. Engine Architecture & Verification Status */}
            <div style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
                ⚙️ Engine Infrastructure & Health
              </div>
              <p style={{ margin: "0 0 14px 0", fontSize: 12, color: "#94a3b8" }}>
                Live operational health of your autonomous publishing pipeline.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: "rgba(0,0,0,0.25)", borderRadius: 6 }}>
                  <span style={{ color: "#94a3b8" }}>Railway Worker Engine:</span>
                  <span style={{ color: "#34d399", fontWeight: 700 }}>● Active & Online</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: "rgba(0,0,0,0.25)", borderRadius: 6 }}>
                  <span style={{ color: "#94a3b8" }}>Execution Timeout Limit:</span>
                  <span style={{ color: "#38bdf8", fontWeight: 700 }}>None (Persistent Node)</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: "rgba(0,0,0,0.25)", borderRadius: 6 }}>
                  <span style={{ color: "#94a3b8" }}>Store Catalog Synced:</span>
                  <span style={{ color: "#f8fafc", fontWeight: 700 }}>{products.length} Products</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: "rgba(0,0,0,0.25)", borderRadius: 6 }}>
                  <span style={{ color: "#94a3b8" }}>Scheduled Time:</span>
                  <span style={{ color: "#f59e0b", fontWeight: 700 }}>09:30 AM IST Daily</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Save Bar */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => handleSaveAutopilot()}
              disabled={autopilotSaving}
              style={{
                padding: "11px 26px",
                borderRadius: 8,
                background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                border: "none",
                color: "#fff",
                fontWeight: 800,
                fontSize: 13.5,
                cursor: autopilotSaving ? "not-allowed" : "pointer",
                boxShadow: "0 4px 14px rgba(37, 99, 235, 0.4)",
              }}
            >
              {autopilotSaving ? "Saving Settings…" : "💾 Save Autopilot Routine & Schedule"}
            </button>
          </div>

          {/* Recent Production History Card */}
          <div
            style={{
              background: "rgba(15, 23, 42, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 14,
              padding: 22,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
                📜 Autonomous Dispatch History & Last Generated Post
              </div>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>
                Total Generated: {autopilotConfig.totalArticlesGenerated || (autopilotConfig.lastPublishedAt ? 1 : 0)}
              </span>
            </div>

            {autopilotConfig.lastPublishedAt ? (
              <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(0, 0, 0, 0.3)", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <span style={{ fontSize: 10, background: autopilotConfig.isDraft ? "rgba(59, 130, 246, 0.2)" : "rgba(16, 185, 129, 0.2)", color: autopilotConfig.isDraft ? "#60a5fa" : "#34d399", padding: "2px 8px", borderRadius: 99, fontWeight: 800, textTransform: "uppercase" }}>
                      {autopilotConfig.isDraft ? "Shopify Draft" : "Live Storefront"}
                    </span>
                    <h4 style={{ margin: "8px 0 4px 0", fontSize: 15, color: "#f8fafc", fontWeight: 700 }}>
                      {autopilotConfig.lastArticleTitle || "Latest Autonomous Blog Post"}
                    </h4>
                    <div style={{ fontSize: 11.5, color: "#64748b" }}>
                      Dispatched on: {new Date(autopilotConfig.lastPublishedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                    </div>
                  </div>

                  {autopilotConfig.lastArticleUrl && (
                    <a
                      href={autopilotConfig.lastArticleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: "7px 14px",
                        borderRadius: 6,
                        background: "rgba(59, 130, 246, 0.15)",
                        border: "1px solid rgba(59, 130, 246, 0.3)",
                        color: "#60a5fa",
                        fontSize: 12,
                        fontWeight: 700,
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span>{autopilotConfig.lastArticleUrl.includes("admin.shopify.com") ? "📝 Review in Shopify Admin ↗" : "🌐 View Live on Shopify ↗"}</span>
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ padding: "24px 16px", textAlign: "center", color: "#64748b", background: "rgba(0,0,0,0.2)", borderRadius: 10 }}>
                No autonomous articles generated yet. Enable the production routine or click "Trigger Immediate Autopilot Generation ↗" to generate your first article via Railway.
              </div>
            )}
          </div>
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
