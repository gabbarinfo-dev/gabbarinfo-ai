"use client";

import { useEffect, useState } from "react";
import BrandAssetPairingModal from "../brands/BrandAssetPairingModal";

export default function ShopifyStoreConnect({ onConnectionChange }) {
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState(null);
  const [allConnections, setAllConnections] = useState([]);
  const [selectedShop, setSelectedShop] = useState("");
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [showAddStoreModal, setShowAddStoreModal] = useState(false);
  const [modalShopInput, setModalShopInput] = useState("");
  const [modalToken, setModalToken] = useState("");
  const [modalMode, setModalMode] = useState("token"); // "token" | "oauth"
  const [modalConnecting, setModalConnecting] = useState(false);
  const [modalError, setModalError] = useState("");
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
  // Live Store Articles State
  const [storeArticles, setStoreArticles] = useState([]);
  const [articlesLoading, setArticlesLoading] = useState(false);

  // Existing Article Optimizer State
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [optimizingArticle, setOptimizingArticle] = useState(false);
  const [optimizedArticleData, setOptimizedArticleData] = useState(null);
  const [updatingArticle, setUpdatingArticle] = useState(false);
  const [articleSuccessMsg, setArticleSuccessMsg] = useState("");
  const [articleKeywords, setArticleKeywords] = useState("");
  const [articleTone, setArticleTone] = useState("luxury, persuasive, and SEO-optimized");
  const [articleTargetLocations, setArticleTargetLocations] = useState("");
  const [articleSearchQuery, setArticleSearchQuery] = useState("");
  const [articlesError, setArticlesError] = useState("");

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
    autoShareFacebook: true,
    autoShareInstagram: true,
    topicQueue: [],
    suggestedTopics: [],
    bulkTopicsInput: "",
    lastPublishedAt: null,
    lastArticleTitle: null,
    lastArticleUrl: null,
    recentArticles: [],
  });

  // Topic Lineup Suite State
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [bulkInput, setBulkInput] = useState("");

  // Social Media Sharing Suite State (Facebook & Instagram)
  const [socialModalOpen, setSocialModalOpen] = useState(false);
  const [socialShareData, setSocialShareData] = useState(null);
  const [socialPlatform, setSocialPlatform] = useState("both"); // "both" | "facebook" | "instagram"
  const [socialCustomCaption, setSocialCustomCaption] = useState("");
  const [socialCustomHashtags, setSocialCustomHashtags] = useState("#eCommerce #Shopify #OnlineShopping #TrendingStyles");
  const [socialSharing, setSocialSharing] = useState(false);
  const [socialShareStatus, setSocialShareStatus] = useState(null);
  const [showMetaConnectNotice, setShowMetaConnectNotice] = useState(false);
  const [brandSecurity, setBrandSecurity] = useState(null);

  useEffect(() => {
    fetchConnection();
  }, []);

  const fetchAutopilotConfig = async (targetShop = null) => {
    const shopToUse = targetShop || selectedShop || connection?.shop;
    setAutopilotLoading(true);
    try {
      const q = shopToUse ? `&shop=${encodeURIComponent(shopToUse)}` : "";
      const res = await fetch(`/api/shopify/sync?action=get-autopilot-config${q}`);
      const data = await res.json();
      if (data.ok && data.config) {
        if (data.brandSecurity) {
          setBrandSecurity(data.brandSecurity);
        }
        setAutopilotConfig((prev) => ({
          ...prev,
          ...data.config,
          autoShareFacebook: data.config.autoShareFacebook === true,
          autoShareInstagram: data.config.autoShareInstagram === true,
          topicQueue: Array.isArray(data.config.topicQueue) ? data.config.topicQueue : [],
          suggestedTopics: Array.isArray(data.config.suggestedTopics) ? data.config.suggestedTopics : [],
          bulkTopicsInput: data.config.bulkTopicsInput || "",
        }));

        // If no topics suggested yet, automatically trigger topic generation
        if (!data.config.suggestedTopics || data.config.suggestedTopics.length === 0) {
          handleAutoSuggestTopics(shopToUse);
        }
      }
    } catch (e) {
      console.warn("Failed to fetch Shopify autopilot config:", e);
    } finally {
      setAutopilotLoading(false);
    }
  };

  const handleAutoSuggestTopics = async (targetShop = null) => {
    const shopToUse = targetShop || selectedShop || connection?.shop;
    setLoadingTopics(true);
    try {
      const res = await fetch("/api/shopify/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "suggest-topics",
          shop: shopToUse,
          targetKeywords: autopilotConfig.targetKeywords,
          targetLocations: autopilotConfig.targetLocations,
          nicheFocus: autopilotConfig.nicheFocus,
        }),
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.topics) && data.topics.length > 0) {
        const newTopics = data.topics;
        setAutopilotConfig((prev) => {
          const currentQueue = new Set(prev.topicQueue || []);
          // Ensure all topics are selected into active queue
          newTopics.forEach((t) => currentQueue.add(t));
          return {
            ...prev,
            suggestedTopics: newTopics,
            topicQueue: Array.from(currentQueue),
          };
        });
      }
    } catch (e) {
      console.warn("Error suggesting topics:", e.message);
    } finally {
      setLoadingTopics(false);
    }
  };

  const handleToggleTopic = (topic) => {
    setAutopilotConfig((prev) => {
      const queue = prev.topicQueue || [];
      const exists = queue.includes(topic);
      const newQueue = exists ? queue.filter((t) => t !== topic) : [...queue, topic];
      return { ...prev, topicQueue: newQueue };
    });
  };

  const handleSelectAllTopics = () => {
    setAutopilotConfig((prev) => {
      const all = prev.suggestedTopics || [];
      const set = new Set([...(prev.topicQueue || []), ...all]);
      return { ...prev, topicQueue: Array.from(set) };
    });
  };

  const handleDeselectAllTopics = () => {
    setAutopilotConfig((prev) => ({
      ...prev,
      topicQueue: [],
    }));
  };

  const handleAddBulkTopics = () => {
    if (!bulkInput.trim()) {
      alert("Please enter topics separated by commas or new lines.");
      return;
    }
    const rawItems = bulkInput.split(/[\n,]+/);
    const cleaned = rawItems
      .map((t) => t.trim().replace(/^["']|["']$/g, ""))
      .filter((t) => t.length > 5);

    if (cleaned.length === 0) {
      alert("Please enter complete topic titles.");
      return;
    }

    setAutopilotConfig((prev) => {
      const currentList = prev.suggestedTopics || [];
      const currentQueue = new Set(prev.topicQueue || []);

      const updatedSuggested = [...currentList];
      cleaned.forEach((topic) => {
        if (!updatedSuggested.includes(topic)) {
          updatedSuggested.push(topic);
        }
        currentQueue.add(topic);
      });

      return {
        ...prev,
        suggestedTopics: updatedSuggested,
        topicQueue: Array.from(currentQueue),
      };
    });

    setBulkInput("");
    alert(`✅ Added ${cleaned.length} custom topics directly to your Autopilot queue!`);
  };

  const openSocialShareModal = (postData) => {
    setSocialShareData(postData);
    setSocialCustomCaption(postData.caption || postData.title || "");
    const brandTag = connection?.shopName
      ? `#${connection.shopName.replace(/[^a-zA-Z0-9]/g, "")}`
      : "#Shopify";
    setSocialCustomHashtags(`${brandTag} #Shopify #OnlineShopping #TrendingStyles`);
    setSocialShareStatus(null);
    setShowMetaConnectNotice(false);
    setSocialModalOpen(true);
  };

  const handleExecuteSocialShare = async () => {
    if (!socialShareData?.postUrl) {
      alert("Post URL is required for social sharing.");
      return;
    }

    setSocialSharing(true);
    setSocialShareStatus(null);
    setShowMetaConnectNotice(false);

    try {
      const res = await fetch("/api/shopify/social-share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: socialPlatform,
          shop: connection?.shop || selectedShop,
          businessName: connection?.shopName || connection?.name,
          title: socialShareData.title,
          postUrl: socialShareData.postUrl,
          featuredImageUrl: socialShareData.featuredImageUrl,
          caption: socialCustomCaption,
          hashtags: socialCustomHashtags,
        }),
      });

      const data = await res.json();
      if (data.require_connect) {
        setShowMetaConnectNotice(true);
      } else if (data.ok) {
        const platLabel =
          socialPlatform === "both"
            ? "Facebook Page & Instagram"
            : socialPlatform === "facebook"
            ? "Facebook Page"
            : "Instagram";
        setSocialShareStatus({
          ok: true,
          message: `✅ Successfully shared to ${platLabel}!`,
        });
      } else {
        setSocialShareStatus({
          ok: false,
          message: `❌ Failed: ${data.error || "Please verify Meta permissions."}`,
        });
      }
    } catch (e) {
      setSocialShareStatus({
        ok: false,
        message: `❌ Share error: ${e.message}`,
      });
    } finally {
      setSocialSharing(false);
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
          shop: selectedShop || connection?.shop,
          config: toSave,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setAutopilotConfig(data.config || toSave);
        setAutopilotNotice(
          `✅ Autopilot schedule saved for ${connection?.shopName || selectedShop} (${isEnabled ? "Active" : "Paused"}, ${
            toSave.cadence === "daily" ? "Daily" : toSave.cadence === "3x_week" ? "3x / Week" : "Weekly"
          }). ${toSave.topicQueue?.length || 0} topics in queue. Background routine updated on Railway.`
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
          shop: selectedShop || connection?.shop,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setAutopilotNotice(`✅ ${data.message || "Autopilot cycle completed successfully!"}`);
        fetchAutopilotConfig(selectedShop);
        fetchArticles(selectedShop);
        setTimeout(() => setAutopilotNotice(""), 10000);
      } else {
        setAutopilotNotice("❌ Cycle trigger failed: " + (data.error || "Unknown"));
      }
    } catch (e) {
      setAutopilotNotice("❌ Trigger error: " + e.message);
    } finally {
      setAutopilotRunning(false);
    }
  };

  const fetchConnection = async (targetShop = null) => {
    setLoading(true);
    try {
      const q = targetShop ? `&shop=${encodeURIComponent(targetShop)}` : "";
      const res = await fetch(`/api/shopify/sync?action=get-connection${q}`);
      const data = await res.json();
      if (data.ok && data.connected) {
        setConnection(data.connection);
        const stores = data.allConnections && data.allConnections.length > 0
          ? data.allConnections
          : [data.connection];
        setAllConnections(stores);
        const activeShop = data.connection?.shop || "";
        setSelectedShop(activeShop);
        if (onConnectionChange) onConnectionChange(true);
        // Pre-fetch products, blogs, live articles, and autopilot for active store
        fetchProducts(activeShop);
        fetchBlogs(activeShop);
        fetchArticles(activeShop);
        fetchAutopilotConfig(activeShop);
      } else {
        setConnection(null);
        setAllConnections([]);
        setSelectedShop("");
        if (onConnectionChange) onConnectionChange(false);
      }
    } catch (e) {
      console.error("Failed to fetch Shopify connection:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectStore = (newShop) => {
    if (!newShop || newShop === selectedShop) return;
    setSelectedShop(newShop);
    setSelectedProduct(null);
    setOptimizedData(null);
    setPreviewArticle(null);
    setSelectedArticle(null);
    setOptimizedArticleData(null);
    fetchConnection(newShop);
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
        const stores = data.allConnections && data.allConnections.length > 0
          ? data.allConnections
          : [data.connection];
        setAllConnections(stores);
        setSelectedShop(data.connection.shop);
        if (onConnectionChange) onConnectionChange(true);
        fetchProducts(data.connection.shop);
        fetchBlogs(data.connection.shop);
        fetchArticles(data.connection.shop);
        fetchAutopilotConfig(data.connection.shop);
      } else {
        setErrorMsg(data.error || "Failed to pair store with access token.");
      }
    } catch (err) {
      setErrorMsg("Error pairing store: " + err.message);
    } finally {
      setTokenConnecting(false);
    }
  };

  const handleModalAddStoreToken = async (e) => {
    e.preventDefault();
    if (!modalShopInput.trim()) {
      setModalError("Please enter the Shopify store domain.");
      return;
    }
    if (!modalToken.trim()) {
      setModalError("Please enter the Shopify Admin API Access Token (shpat_...).");
      return;
    }

    setModalConnecting(true);
    setModalError("");

    try {
      const res = await fetch("/api/shopify/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "connect-token",
          shop: modalShopInput.trim(),
          accessToken: modalToken.trim(),
        }),
      });

      const data = await res.json();
      if (data.ok && data.connection) {
        setConnection(data.connection);
        const stores = data.allConnections && data.allConnections.length > 0
          ? data.allConnections
          : [data.connection];
        setAllConnections(stores);
        setSelectedShop(data.connection.shop);
        setShowAddStoreModal(false);
        setModalShopInput("");
        setModalToken("");
        if (onConnectionChange) onConnectionChange(true);
        fetchProducts(data.connection.shop);
        fetchBlogs(data.connection.shop);
        fetchArticles(data.connection.shop);
        fetchAutopilotConfig(data.connection.shop);
      } else {
        setModalError(data.error || "Failed to pair store with access token.");
      }
    } catch (err) {
      setModalError("Error pairing store: " + err.message);
    } finally {
      setModalConnecting(false);
    }
  };

  const handleModalAddStoreOAuth = (e) => {
    e.preventDefault();
    if (!modalShopInput.trim()) {
      setModalError("Please enter your Shopify store domain.");
      return;
    }

    setModalConnecting(true);
    let normalized = modalShopInput.trim().toLowerCase();
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

    window.location.href = `/api/shopify/connect?shop=${encodeURIComponent(normalized)}`;
  };

  const handleDisconnect = async () => {
    const currentName = connection?.shopName || connection?.shop || "this store";
    if (!confirm(`Are you sure you want to disconnect "${currentName}"?`)) return;
    try {
      const targetDisconnectShop = selectedShop || connection?.shop;
      const res = await fetch("/api/shopify/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "disconnect",
          shop: targetDisconnectShop,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        const remaining = allConnections.filter(
          (c) => c.shop.toLowerCase() !== (targetDisconnectShop || "").toLowerCase()
        );
        if (remaining.length > 0) {
          setAllConnections(remaining);
          handleSelectStore(remaining[0].shop);
        } else {
          setConnection(null);
          setAllConnections([]);
          setSelectedShop("");
          setProducts([]);
          setBlogs([]);
          setStoreArticles([]);
          if (onConnectionChange) onConnectionChange(false);
        }
      } else {
        alert(data.error || "Failed to disconnect");
      }
    } catch (err) {
      alert("Error disconnecting store: " + err.message);
    }
  };

  const fetchProducts = async (targetShop = null) => {
    const shopToUse = targetShop || selectedShop || connection?.shop;
    setProductsLoading(true);
    try {
      const q = shopToUse ? `&shop=${encodeURIComponent(shopToUse)}` : "";
      const res = await fetch(`/api/shopify/sync?action=list-products&limit=250${q}`);
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

  const fetchBlogs = async (targetShop = null) => {
    const shopToUse = targetShop || selectedShop || connection?.shop;
    setBlogsLoading(true);
    setBlogsError("");
    try {
      const q = shopToUse ? `&shop=${encodeURIComponent(shopToUse)}` : "";
      const res = await fetch(`/api/shopify/sync?action=list-blogs${q}`);
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

  const fetchArticles = async (targetShop = null) => {
    const shopToUse = targetShop || selectedShop || connection?.shop;
    setArticlesLoading(true);
    setArticlesError("");
    try {
      const q = shopToUse ? `&shop=${encodeURIComponent(shopToUse)}` : "";
      const res = await fetch(`/api/shopify/sync?action=list-articles${q}`);
      const data = await res.json();
      if (data.ok) {
        setStoreArticles(data.articles || []);
      } else {
        setArticlesError(data.error || "Failed to load articles from Shopify.");
      }
    } catch (err) {
      console.error("Failed to load Shopify articles:", err);
      setArticlesError(err.message);
    } finally {
      setArticlesLoading(false);
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
          shop: selectedShop || connection?.shop,
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
          shop: selectedShop || connection?.shop,
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

  const openOptimizeArticleModal = (art) => {
    setSelectedArticle(art);
    setOptimizedArticleData(null);
    setArticleSuccessMsg("");
    setArticleKeywords(art.tags ? String(art.tags) : art.title);
    setArticleTargetLocations(blogTargetLocations || "");
  };

  const handleGenerateArticleOptimization = async () => {
    if (!selectedArticle) return;
    setOptimizingArticle(true);
    setArticleSuccessMsg("");
    try {
      const res = await fetch("/api/shopify/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "optimize-article",
          shop: selectedShop || connection?.shop,
          articleId: selectedArticle.id,
          blogId: selectedArticle.blog_id,
          title: selectedArticle.title,
          currentBody: selectedArticle.body_html || selectedArticle.summary_html || "",
          keywords: articleKeywords,
          tone: articleTone,
          targetLocations: articleTargetLocations,
        }),
      });

      const data = await res.json();
      if (data.ok && data.optimized) {
        setOptimizedArticleData(data.optimized);
      } else {
        alert(data.error || "Failed to generate AI blog optimization");
      }
    } catch (err) {
      alert("Error optimizing article: " + err.message);
    } finally {
      setOptimizingArticle(false);
    }
  };

  const handlePushUpdatedArticleToShopify = async () => {
    if (!selectedArticle || !optimizedArticleData) return;
    setUpdatingArticle(true);
    setArticleSuccessMsg("");
    try {
      const res = await fetch("/api/shopify/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-article",
          shop: selectedShop || connection?.shop,
          articleId: selectedArticle.id,
          blogId: selectedArticle.blog_id,
          title: optimizedArticleData.optimizedTitle || selectedArticle.title,
          bodyHtml: optimizedArticleData.bodyHtml,
          summaryHtml: optimizedArticleData.summaryHtml || "",
          tags: optimizedArticleData.suggestedTags || selectedArticle.tags,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setArticleSuccessMsg("✅ Article successfully updated on Shopify live storefront!");
        // Update local article state
        setStoreArticles((prev) =>
          prev.map((a) =>
            a.id === selectedArticle.id
              ? {
                  ...a,
                  title: optimizedArticleData.optimizedTitle || a.title,
                  body_html: optimizedArticleData.bodyHtml,
                  summary_html: optimizedArticleData.summaryHtml,
                  tags: optimizedArticleData.suggestedTags?.join(", ") || a.tags,
                }
              : a
          )
        );
      } else {
        alert(data.error || "Failed to push updated article to Shopify");
      }
    } catch (err) {
      alert("Error updating article: " + err.message);
    } finally {
      setUpdatingArticle(false);
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
            shop: selectedShop || connection?.shop,
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
            shop: selectedShop || connection?.shop,
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
          shop: selectedShop || connection?.shop,
          blogId: selectedBlogId,
          blogHandle: blogHandle,
          title: articleTitle,
          bodyHtml: articleHtml,
          summaryHtml: summaryHtml,
          tags: articleTags,
          imageBase64: imageUrl ? null : imageBase64,
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
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
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

            {/* Multi-Store Switcher Dropdown */}
            {allConnections.length > 1 && (
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700 }}>Switch Store:</span>
                <select
                  value={selectedShop || connection.shop}
                  onChange={(e) => handleSelectStore(e.target.value)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: 8,
                    background: "#0d131f",
                    border: "1px solid rgba(149, 191, 71, 0.4)",
                    color: "#95bf47",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  {allConnections.map((c) => (
                    <option key={c.shop} value={c.shop} style={{ background: "#0d131f", color: "#f8fafc" }}>
                      {c.shopName || c.shop} ({c.shop})
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: 11, color: "#64748b" }}>
                  ({allConnections.length} connected)
                </span>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => {
              setModalError("");
              setModalShopInput("");
              setModalToken("");
              setShowAddStoreModal(true);
            }}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              background: "linear-gradient(135deg, rgba(149, 191, 71, 0.2) 0%, rgba(94, 142, 62, 0.25) 100%)",
              border: "1px solid rgba(149, 191, 71, 0.45)",
              color: "#95bf47",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>➕</span> Connect Another Store
          </button>
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
            Disconnect {allConnections.length > 1 ? "This Store" : ""}
          </button>
        </div>
      </div>

      {/* ADD STORE MODAL */}
      {showAddStoreModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(8px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 540,
              background: "linear-gradient(135deg, #0d131f 0%, #080d16 100%)",
              border: "1px solid rgba(149, 191, 71, 0.4)",
              borderRadius: 20,
              padding: 24,
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>🛍️</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#fff" }}>
                    Connect Another Shopify Store
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94a3b8" }}>
                    Manage multiple stores with isolated SEO, Autopilot, and catalogues.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddStoreModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: 18,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            {/* Method Tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => { setModalMode("token"); setModalError(""); }}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: modalMode === "token" ? "1px solid #95bf47" : "1px solid rgba(255,255,255,0.1)",
                  background: modalMode === "token" ? "rgba(149, 191, 71, 0.15)" : "rgba(255,255,255,0.03)",
                  color: modalMode === "token" ? "#95bf47" : "#94a3b8",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                🔑 Admin API Token (Instant)
              </button>
              <button
                type="button"
                onClick={() => { setModalMode("oauth"); setModalError(""); }}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: modalMode === "oauth" ? "1px solid #95bf47" : "1px solid rgba(255,255,255,0.1)",
                  background: modalMode === "oauth" ? "rgba(149, 191, 71, 0.15)" : "rgba(255,255,255,0.03)",
                  color: modalMode === "oauth" ? "#95bf47" : "#94a3b8",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                ⚡ 1-Click OAuth
              </button>
            </div>

            {modalMode === "token" ? (
              <form onSubmit={handleModalAddStoreToken}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                      Store Domain / myshopify URL:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. second-store.myshopify.com or secondstore.com"
                      value={modalShopInput}
                      onChange={(e) => setModalShopInput(e.target.value)}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "10px 14px",
                        borderRadius: 8,
                        background: "rgba(0,0,0,0.4)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        color: "#fff",
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                      Admin API Access Token:
                    </label>
                    <input
                      type="password"
                      placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxx"
                      value={modalToken}
                      onChange={(e) => setModalToken(e.target.value)}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "10px 14px",
                        borderRadius: 8,
                        background: "rgba(0,0,0,0.4)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        color: "#fff",
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                      Create in Shopify Admin &gt; Settings &gt; Apps &gt; Develop apps. Requires <strong>read/write products and blogs</strong> permissions.
                    </div>
                  </div>

                  {modalError && (
                    <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#fca5a5", fontSize: 12 }}>
                      {modalError}
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={() => setShowAddStoreModal(false)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 8,
                        background: "transparent",
                        border: "1px solid rgba(255,255,255,0.15)",
                        color: "#94a3b8",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={modalConnecting}
                      style={{
                        padding: "8px 18px",
                        borderRadius: 8,
                        background: "linear-gradient(135deg, #95bf47 0%, #5e8e3e 100%)",
                        border: "none",
                        color: "#0f172a",
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: modalConnecting ? "not-allowed" : "pointer",
                      }}
                    >
                      {modalConnecting ? "Connecting…" : "Pair Store"}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <form onSubmit={handleModalAddStoreOAuth}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                      Store Domain:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. yourstore.myshopify.com"
                      value={modalShopInput}
                      onChange={(e) => setModalShopInput(e.target.value)}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "10px 14px",
                        borderRadius: 8,
                        background: "rgba(0,0,0,0.4)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        color: "#fff",
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                  </div>
                  {modalError && (
                    <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#fca5a5", fontSize: 12 }}>
                      {modalError}
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={() => setShowAddStoreModal(false)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 8,
                        background: "transparent",
                        border: "1px solid rgba(255,255,255,0.15)",
                        color: "#94a3b8",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={modalConnecting}
                      style={{
                        padding: "8px 18px",
                        borderRadius: 8,
                        background: "linear-gradient(135deg, #95bf47 0%, #5e8e3e 100%)",
                        border: "none",
                        color: "#0f172a",
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: modalConnecting ? "not-allowed" : "pointer",
                      }}
                    >
                      {modalConnecting ? "Redirecting…" : "Continue with OAuth ➔"}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

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
          onClick={() => {
            setActiveSubTab("existing-blogs");
            if (storeArticles.length === 0) fetchArticles();
          }}
          style={{
            padding: "8px 18px",
            borderRadius: 10,
            background: activeSubTab === "existing-blogs" ? "rgba(56, 189, 248, 0.18)" : "transparent",
            border: activeSubTab === "existing-blogs" ? "1px solid rgba(56, 189, 248, 0.4)" : "1px solid transparent",
            color: activeSubTab === "existing-blogs" ? "#38bdf8" : "#94a3b8",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>📰</span> Optimize Existing Blogs ({storeArticles.length})
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
          <span>✍️</span> Create New Blog Post
        </button>

        <button
          onClick={() => {
            setActiveSubTab("autopilot");
            fetchAutopilotConfig(selectedShop || connection?.shop);
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
          SUB-TAB 2: OPTIMIZE EXISTING BLOG ARTICLES (AI REWRITE & UPGRADE)
      ------------------------------------------------------------- */}
      {activeSubTab === "existing-blogs" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              background: "rgba(15, 23, 42, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: 16,
              padding: "24px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h4 style={{ margin: "0 0 6px 0", fontSize: 18, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
                  <span>📰</span> Optimize Existing Blog Articles
                  <span style={{ fontSize: 12, background: "rgba(56, 189, 248, 0.18)", color: "#38bdf8", padding: "3px 10px", borderRadius: 12, border: "1px solid rgba(56, 189, 248, 0.35)", fontWeight: 700 }}>
                    {storeArticles.length} Live on Store
                  </span>
                </h4>
                <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>
                  Scan your live Shopify articles and use AI to rewrite, upgrade headings, improve search rankings, and push updates with 1 click.
                </p>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="Filter articles by title..."
                  value={articleSearchQuery}
                  onChange={(e) => setArticleSearchQuery(e.target.value)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    background: "#0b101b",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#fff",
                    fontSize: 12.5,
                    width: 200,
                  }}
                />
                <button
                  type="button"
                  onClick={fetchArticles}
                  disabled={articlesLoading}
                  style={{
                    background: "rgba(255, 255, 255, 0.06)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#38bdf8",
                    padding: "8px 14px",
                    borderRadius: 8,
                    fontSize: 12.5,
                    cursor: "pointer",
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>↻</span> {articlesLoading ? "Syncing..." : "Refresh Articles"}
                </button>
              </div>
            </div>

            {articlesError && (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#f87171", fontSize: 13, marginBottom: 14 }}>
                ⚠️ {articlesError}
              </div>
            )}

            {articlesLoading && storeArticles.length === 0 ? (
              <div style={{ padding: "60px 0", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
                ⏳ Syncing live blog articles from your Shopify store...
              </div>
            ) : storeArticles.length === 0 ? (
              <div style={{ padding: "60px 0", textAlign: "center", color: "#64748b", fontSize: 14 }}>
                No published articles found in your store. Use the "Create New Blog Post" tab to publish your first article!
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                  gap: 18,
                }}
              >
                {storeArticles
                  .filter((art) => !articleSearchQuery.trim() || art.title.toLowerCase().includes(articleSearchQuery.toLowerCase()))
                  .map((art) => (
                    <div
                      key={art.id}
                      style={{
                        background: "rgba(11, 16, 27, 0.8)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: 12,
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        transition: "border-color 0.15s ease",
                      }}
                    >
                      {art.image?.src ? (
                        <div style={{ width: "100%", height: 160, overflow: "hidden", background: "#050811" }}>
                          <img
                            src={art.image.src}
                            alt={art.title}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        </div>
                      ) : (
                        <div style={{ width: "100%", height: 90, background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: 28 }}>
                          📰
                        </div>
                      )}
                      <div style={{ padding: 16, display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between", gap: 14 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", padding: "3px 8px", borderRadius: 4, background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" }}>
                              {art.blog_title || "News"}
                            </span>
                            {art.published_at && (
                              <span style={{ fontSize: 11.5, color: "#64748b" }}>
                                {new Date(art.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                            )}
                          </div>
                          <h4 style={{ fontSize: 14.5, fontWeight: 700, color: "#f1f5f9", margin: 0, lineHeight: 1.4 }}>
                            {art.title}
                          </h4>
                          {art.summary_html && (
                            <div style={{ marginTop: 8, fontSize: 12, color: "#94a3b8", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                              {art.summary_html.replace(/<[^>]+>/g, "")}
                            </div>
                          )}
                        </div>

                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <button
                            type="button"
                            onClick={() => openOptimizeArticleModal(art)}
                            style={{
                              flex: 1,
                              padding: "9px 12px",
                              borderRadius: 8,
                              background: "linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(14, 165, 233, 0.25) 100%)",
                              border: "1px solid rgba(56, 189, 248, 0.4)",
                              color: "#38bdf8",
                              fontWeight: 700,
                              fontSize: 12.5,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                            }}
                          >
                            <span>✨</span> Optimize with AI
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              openSocialShareModal({
                                title: art.title,
                                postUrl: art.live_url,
                                featuredImageUrl: art.image?.src || null,
                                caption: art.summary_html ? art.summary_html.replace(/<[^>]+>/g, "") : art.title,
                              })
                            }
                            title="Share to Facebook & Instagram"
                            style={{
                              padding: "9px 12px",
                              borderRadius: 8,
                              background: "rgba(24, 119, 242, 0.15)",
                              border: "1px solid rgba(24, 119, 242, 0.35)",
                              color: "#60a5fa",
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <span>📢</span> Share
                          </button>
                          <a
                            href={art.live_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: "9px 12px",
                              borderRadius: 8,
                              background: "rgba(255, 255, 255, 0.05)",
                              border: "1px solid rgba(255, 255, 255, 0.12)",
                              color: "#94a3b8",
                              fontSize: 12,
                              fontWeight: 600,
                              textDecoration: "none",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <span>👁️</span> View ↗
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          SUB-TAB 2: SHOPIFY BLOG SUITE (MANUAL ENGINE & LIVE ARTICLES)
      ------------------------------------------------------------- */}
      {activeSubTab === "blogs" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
                  onClick={() => {
                    fetchBlogs();
                    fetchArticles();
                  }}
                  disabled={blogsLoading || articlesLoading}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#38bdf8",
                    fontSize: 12,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  {blogsLoading || articlesLoading ? "Refreshing..." : "↻ Refresh Channels & Articles"}
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
                    {b.title} ({b.handle}) {typeof b.article_count === "number" ? `— ${b.article_count} published ${b.article_count === 1 ? "article" : "articles"}` : ""}
                  </option>
                ))}
              </select>
              <div style={{ marginTop: 6, fontSize: 11.5, color: "#94a3b8" }}>
                💡 <strong>Target Blog Channel</strong> is the category where new articles will publish (e.g. selecting <strong>News</strong> publishes live to <code>{connection?.domain || "yourstore.com"}/blogs/news</code> alongside your existing articles).
              </div>
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
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
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
                      <a href={publishedArticleUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#38bdf8", fontWeight: 700, textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span>🌐</span> View Published Article on Shopify Storefront ↗
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        openSocialShareModal({
                          title: blogTopic || "New Shopify Blog Article",
                          postUrl: publishedArticleUrl,
                          featuredImageUrl: previewArticle?.imageUrl || null,
                          caption: previewArticle?.seoDescription || blogTopic,
                        })
                      }
                      style={{
                        padding: "7px 14px",
                        borderRadius: 8,
                        background: "linear-gradient(135deg, #1877f2 0%, #0d6efd 100%)",
                        border: "none",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        boxShadow: "0 2px 10px rgba(24, 119, 242, 0.35)",
                      }}
                    >
                      <span>📢</span> Share to Facebook & Instagram ↗
                    </button>
                  </div>
                )}
              </div>
            )}
          </form>
        </div>
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

          {/* Social Asset Pairing Prompt / Verification Banner */}
          {brandSecurity && brandSecurity.isMatched ? (
            <div
              style={{
                marginBottom: 20,
                padding: "14px 18px",
                borderRadius: 12,
                background: "rgba(16, 185, 129, 0.12)",
                border: "1px solid rgba(16, 185, 129, 0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>✅</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#34d399" }}>
                    Social Syndication Linked: {brandSecurity.meta?.pageName || "Facebook"} &amp; {brandSecurity.meta?.igUsername ? `@${brandSecurity.meta.igUsername}` : "Instagram"}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 2 }}>
                    New articles published to this Shopify store will automatically cross-post to your verified Meta channels.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPairingModal(true)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  background: "rgba(56, 189, 248, 0.15)",
                  border: "1px solid rgba(56, 189, 248, 0.35)",
                  color: "#38bdf8",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ⚙️ Switch / Manage Pairing ↗
              </button>
            </div>
          ) : (
            <div
              style={{
                marginBottom: 20,
                padding: "16px 20px",
                borderRadius: 14,
                background: "linear-gradient(135deg, rgba(168, 85, 247, 0.18) 0%, rgba(56, 189, 248, 0.12) 100%)",
                border: "1.5px solid rgba(168, 85, 247, 0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
                boxShadow: "0 8px 30px rgba(168, 85, 247, 0.15)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: "rgba(168, 85, 247, 0.25)",
                    border: "1px solid rgba(168, 85, 247, 0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    flexShrink: 0,
                  }}
                >
                  ⚡
                </div>
                <div>
                  <h4 style={{ margin: "0 0 3px", fontSize: 14.5, fontWeight: 800, color: "#fff" }}>
                    Action Recommended: Pair Social Channels for 1-Click Blog Syndication
                  </h4>
                  <p style={{ margin: 0, fontSize: 12.5, color: "#cbd5e1", lineHeight: 1.4 }}>
                    Link <strong>{connection?.name || "this store"}</strong> with its official Facebook Page &amp; Instagram account so newly generated blogs cross-post autonomously.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPairingModal(true)}
                style={{
                  padding: "9px 18px",
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #a855f7 0%, #38bdf8 100%)",
                  border: "none",
                  color: "#080c14",
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: "0 4px 15px rgba(168, 85, 247, 0.35)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  flexShrink: 0,
                }}
              >
                <span>⚙️</span> Pair Social Assets Now ↗
              </button>
            </div>
          )}

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

          {/* 5. Strategic Topic Lineup & Content Pipeline (At least 40 Topics) */}
          <div
            style={{
              background: "rgba(16, 22, 34, 0.8)",
              border: "1px solid rgba(56, 189, 248, 0.25)",
              borderRadius: 14,
              padding: 24,
              boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14, marginBottom: 16 }}>
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 20, background: "rgba(56, 189, 248, 0.15)", border: "1px solid rgba(56, 189, 248, 0.3)", color: "#38bdf8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                  <span>📋</span> Content Queue & Pipeline
                </div>
                <h3 style={{ margin: "0 0 6px 0", fontSize: 18, color: "#fff", fontWeight: 800 }}>
                  Strategic Topic Lineup & Suggestions (40+ Topics)
                </h3>
                <p style={{ margin: 0, color: "#94a3b8", fontSize: 13, maxWidth: 740, lineHeight: 1.5 }}>
                  Select the topics you want your Autonomous Autopilot to write and publish in order. The Railway worker will consume from your selected queue first. You can also paste 30+ custom topics in bulk below.
                </p>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: "6px 12px",
                    borderRadius: 8,
                    background: "rgba(56, 189, 248, 0.12)",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                    color: "#38bdf8",
                  }}
                >
                  {autopilotConfig.topicQueue?.length || 0} Queued for Autopilot
                </span>
                <button
                  type="button"
                  onClick={handleAutoSuggestTopics}
                  disabled={loadingTopics}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 8,
                    background: "linear-gradient(135deg, rgba(56, 189, 248, 0.25) 0%, rgba(14, 165, 233, 0.3) 100%)",
                    border: "1px solid rgba(56, 189, 248, 0.4)",
                    color: "#38bdf8",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: loadingTopics ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>{loadingTopics ? "⏳ Analyzing Catalog…" : "⚡ Re-Generate 40 Store Topics"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSelectAllTopics}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 8,
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#cbd5e1",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  ✓ Select All
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAllTopics}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 8,
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#94a3b8",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  ✕ Deselect All
                </button>
              </div>
            </div>

            {/* Topics Checklist Grid */}
            <div
              style={{
                maxHeight: 340,
                overflowY: "auto",
                background: "#080c14",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: 10,
                padding: 12,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
                gap: 10,
                marginBottom: 16,
              }}
            >
              {loadingTopics && (!autopilotConfig.suggestedTopics || autopilotConfig.suggestedTopics.length === 0) ? (
                <div style={{ gridColumn: "1 / -1", padding: 30, textAlign: "center", color: "#38bdf8", fontSize: 13 }}>
                  ⏳ Analyzing store catalog and synthesizing 40+ high-ranking eCommerce topic titles…
                </div>
              ) : (!autopilotConfig.suggestedTopics || autopilotConfig.suggestedTopics.length === 0) ? (
                <div style={{ gridColumn: "1 / -1", padding: 30, textAlign: "center", color: "#64748b", fontSize: 13 }}>
                  No topic suggestions loaded yet. Click <strong>"⚡ Re-Generate 40 Store Topics"</strong> above to ideate rank-seeking topics for your store.
                </div>
              ) : (
                autopilotConfig.suggestedTopics.map((top, idx) => {
                  const isSelected = (autopilotConfig.topicQueue || []).includes(top);
                  return (
                    <label
                      key={idx}
                      onClick={() => handleToggleTopic(top)}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: isSelected ? "rgba(56, 189, 248, 0.08)" : "rgba(255, 255, 255, 0.02)",
                        border: isSelected ? "1px solid rgba(56, 189, 248, 0.35)" : "1px solid rgba(255, 255, 255, 0.06)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // handled by parent onClick
                        style={{ marginTop: 2, accentColor: "#38bdf8", cursor: "pointer", width: 16, height: 16, flexShrink: 0 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: isSelected ? "#38bdf8" : "#64748b" }}>
                            #{idx + 1}
                          </span>
                          {isSelected && (
                            <span style={{ fontSize: 9.5, padding: "1px 5px", borderRadius: 4, background: "rgba(16, 185, 129, 0.2)", color: "#34d399", fontWeight: 700 }}>
                              IN QUEUE
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12.5, fontWeight: isSelected ? 600 : 400, color: isSelected ? "#f8fafc" : "#94a3b8", lineHeight: 1.4 }}>
                          {top}
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            {/* Bulk Suggest Box */}
            <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: "#e2e8f0" }}>
                  ✍️ Or Suggest Custom Blog Topics in Bulk (Separated by Commas or Newlines):
                </label>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>
                  Paste 30+ titles all together
                </span>
              </div>
              <textarea
                rows={3}
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder="e.g. 10 Essential Kundan Pieces for London Brides, Everyday Anti-Tarnish Jewellery Care Guide, How to Pair Statement Necklaces with Evening Gowns, Trending Western Party Styling Tips 2026..."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "#080c14",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#fff",
                  fontSize: 12.5,
                  lineHeight: 1.5,
                  resize: "vertical",
                  marginBottom: 10,
                }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={handleAddBulkTopics}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 8,
                    background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                    border: "none",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: "pointer",
                    boxShadow: "0 2px 10px rgba(2, 132, 199, 0.3)",
                  }}
                >
                  + Add Custom Topics to Queue ↗
                </button>
              </div>
            </div>
          </div>

          {/* 6. Instant Multichannel Social Syndication (Syndication Protocol) */}
          <div
            style={{
              background: "rgba(16, 22, 34, 0.78)",
              border: brandSecurity && !brandSecurity.isMatched ? "1.5px solid rgba(239, 68, 68, 0.4)" : "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: 14,
              padding: 24,
              boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 20, background: "rgba(56, 189, 248, 0.15)", border: "1px solid rgba(56, 189, 248, 0.3)", color: "#38bdf8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  <span>⚡</span> Syndication Protocol
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowPairingModal(true)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 12px",
                      borderRadius: 8,
                      background: "rgba(168, 85, 247, 0.15)",
                      border: "1px solid rgba(168, 85, 247, 0.35)",
                      color: "#c084fc",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <span>⚙️</span> Pair / Switch Social Assets ↗
                  </button>
                  {brandSecurity && !brandSecurity.isMatched && (
                    <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "rgba(239, 68, 68, 0.2)", border: "1px solid rgba(239, 68, 68, 0.4)", color: "#fca5a5", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <span>🛡️</span> Cross-Brand Shield Active
                    </span>
                  )}
                </div>
              </div>

              <h3 style={{ margin: "0 0 6px 0", fontSize: 18, color: "#fff", fontWeight: 800 }}>
                Instant Multichannel Social Syndication
              </h3>
              <p style={{ margin: 0, color: "#94a3b8", fontSize: 13, lineHeight: 1.5 }}>
                Amplify every live blog post immediately. The moment an article goes live on your Shopify blog, GabbarInfo AI automatically distributes it across your connected social networks.
              </p>
            </div>

            {/* Anti-Exploitation & Brand Integrity Guard Shield Banner */}
            {brandSecurity && !brandSecurity.isMatched && (
              <div
                style={{
                  marginBottom: 20,
                  padding: "16px 20px",
                  borderRadius: 12,
                  background: "linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(185, 28, 28, 0.08) 100%)",
                  border: "1.5px solid rgba(239, 68, 68, 0.4)",
                  boxShadow: "0 8px 24px rgba(239, 68, 68, 0.15)",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ fontSize: 28, flexShrink: 0, marginTop: 2 }}>🛡️</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#fca5a5" }}>
                        Brand Isolation & Anti-Exploitation Guard Active
                      </h4>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "rgba(239, 68, 68, 0.3)", color: "#fee2e2", fontWeight: 800, textTransform: "uppercase" }}>
                        Cross-Business Syndication Locked
                      </span>
                    </div>

                    <div style={{ margin: "8px 0 12px 0", color: "#e2e8f0", fontSize: 12.5, lineHeight: 1.6 }}>
                      Our AI security engine identified an entity mismatch:
                      <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
                        <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(0, 0, 0, 0.3)", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
                          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>Connected Meta Asset:</div>
                          <div style={{ fontSize: 13, color: "#38bdf8", fontWeight: 800, marginTop: 2 }}>
                            {brandSecurity.meta?.display || "GABBARinfo (@gabbarinfo)"}
                          </div>
                          {brandSecurity.meta?.website && (
                            <div style={{ fontSize: 11, color: "#64748b" }}>{brandSecurity.meta.website}</div>
                          )}
                        </div>

                        <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(0, 0, 0, 0.3)", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
                          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>Current Shopify Store:</div>
                          <div style={{ fontSize: 13, color: "#34d399", fontWeight: 800, marginTop: 2 }}>
                            {connection?.name || connection?.shopName || "This Store"}
                          </div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>{connection?.domain || connection?.shop || ""}</div>
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(0, 0, 0, 0.4)", border: "1px solid rgba(239, 68, 68, 0.3)", fontSize: 11.8, color: "#fca5a5", lineHeight: 1.5 }}>
                      ⛔ <strong>Cross-Business Syndication Blocked:</strong> To protect your brand authority and prevent unauthorized multi-business account exploitation, blogs from <strong>{connection?.name || connection?.shopName || "this store"}</strong> cannot be broadcast onto <strong>{brandSecurity.meta?.display || "another business profile"}</strong>.
                    </div>

                    <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => setShowPairingModal(true)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "7px 14px",
                          borderRadius: 8,
                          background: "rgba(56, 189, 248, 0.15)",
                          border: "1px solid rgba(56, 189, 248, 0.4)",
                          color: "#38bdf8",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        <span>⚙️</span> Pair {connection?.name || connection?.shopName || "Store"}'s Social Media in Pairing Wizard ↗
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              {/* Facebook Option Card */}
              <div
                onClick={() => {
                  if (brandSecurity && !brandSecurity.isMatched) {
                    alert(`Brand Mismatch: Connected Meta profile belongs to ${brandSecurity.meta?.display || "another business"}, not ${connection?.name || connection?.shopName || "this store"}. Cross-business syndication is locked.`);
                    return;
                  }
                  setAutopilotConfig({ ...autopilotConfig, autoShareFacebook: !autopilotConfig.autoShareFacebook });
                }}
                style={{
                  background: (brandSecurity && !brandSecurity.isMatched)
                    ? "rgba(239, 68, 68, 0.05)"
                    : (autopilotConfig.autoShareFacebook ? "rgba(24, 119, 242, 0.1)" : "rgba(13, 20, 35, 0.7)"),
                  border: (brandSecurity && !brandSecurity.isMatched)
                    ? "1px solid rgba(239, 68, 68, 0.3)"
                    : (autopilotConfig.autoShareFacebook ? "1.5px solid #1877f2" : "1px solid rgba(255, 255, 255, 0.1)"),
                  borderRadius: 12,
                  padding: 18,
                  cursor: (brandSecurity && !brandSecurity.isMatched) ? "not-allowed" : "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 14,
                  opacity: (brandSecurity && !brandSecurity.isMatched) ? 0.75 : 1,
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: "#1877f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#ffffff">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      📘 Facebook Page:
                      <span style={{ color: "#38bdf8", background: "rgba(56, 189, 248, 0.12)", padding: "2px 8px", borderRadius: 6, border: "1px solid rgba(56, 189, 248, 0.25)" }}>
                        {brandSecurity?.meta?.pageName || "No Page Linked"}
                      </span>
                      {brandSecurity && !brandSecurity.isMatched ? (
                        <span style={{ fontSize: 9.5, padding: "1px 6px", borderRadius: 4, background: "rgba(239, 68, 68, 0.25)", color: "#f87171", fontWeight: 700 }}>
                          UNPAIRED
                        </span>
                      ) : autopilotConfig.autoShareFacebook ? (
                        <span style={{ fontSize: 9.5, padding: "1px 6px", borderRadius: 4, background: "rgba(16, 185, 129, 0.2)", color: "#34d399", fontWeight: 700 }}>
                          ACTIVE
                        </span>
                      ) : (
                        <span style={{ fontSize: 9.5, padding: "1px 6px", borderRadius: 4, background: "rgba(148, 163, 184, 0.2)", color: "#94a3b8", fontWeight: 700 }}>
                          MUTED
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: brandSecurity?.meta?.pageId ? "#38bdf8" : "#94a3b8", marginTop: 4, fontWeight: 600 }}>
                      {brandSecurity?.meta?.pageId ? `✓ Target ID: ${brandSecurity.meta.pageId}` : "Unpaired with Social Pilot"}
                    </div>
                    <p style={{ margin: "4px 0 0 0", color: (brandSecurity && !brandSecurity.isMatched) ? "#f87171" : "#94a3b8", fontSize: 11.5, lineHeight: 1.4 }}>
                      {brandSecurity && !brandSecurity.isMatched
                        ? `Locked: No matching Facebook Page paired with ${connection?.name || "this store"}. Click 'Pair Assets' to link.`
                        : `Broadcasts an interactive preview card with article synopsis, artwork, and store link to ${brandSecurity?.meta?.pageName || "your page"}.`}
                    </p>
                  </div>
                </div>

                {/* Toggle Switch */}
                <div
                  style={{
                    width: 42,
                    height: 22,
                    borderRadius: 12,
                    background: (brandSecurity && !brandSecurity.isMatched) ? "#1e293b" : (autopilotConfig.autoShareFacebook ? "#10b981" : "#334155"),
                    position: "relative",
                    flexShrink: 0,
                    transition: "background 0.2s ease",
                  }}
                >
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      background: (brandSecurity && !brandSecurity.isMatched) ? "#64748b" : "#fff",
                      position: "absolute",
                      top: 3,
                      left: (brandSecurity && !brandSecurity.isMatched) ? 3 : (autopilotConfig.autoShareFacebook ? 23 : 3),
                      transition: "left 0.2s ease",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 9,
                    }}
                  >
                    {brandSecurity && !brandSecurity.isMatched ? "🔒" : null}
                  </div>
                </div>
              </div>

              {/* Instagram Option Card */}
              <div
                onClick={() => {
                  if (brandSecurity && !brandSecurity.isMatched) {
                    alert(`Brand Mismatch: Connected Meta profile belongs to ${brandSecurity.meta?.display || "another business"}, not ${connection?.name || connection?.shopName || "this store"}. Cross-business syndication is locked.`);
                    return;
                  }
                  setAutopilotConfig({ ...autopilotConfig, autoShareInstagram: !autopilotConfig.autoShareInstagram });
                }}
                style={{
                  background: (brandSecurity && !brandSecurity.isMatched)
                    ? "rgba(239, 68, 68, 0.05)"
                    : (autopilotConfig.autoShareInstagram ? "rgba(225, 48, 108, 0.1)" : "rgba(13, 20, 35, 0.7)"),
                  border: (brandSecurity && !brandSecurity.isMatched)
                    ? "1px solid rgba(239, 68, 68, 0.3)"
                    : (autopilotConfig.autoShareInstagram ? "1.5px solid #e1306c" : "1px solid rgba(255, 255, 255, 0.1)"),
                  borderRadius: 12,
                  padding: 18,
                  cursor: (brandSecurity && !brandSecurity.isMatched) ? "not-allowed" : "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 14,
                  opacity: (brandSecurity && !brandSecurity.isMatched) ? 0.75 : 1,
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#ffffff">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      📸 Instagram:
                      <span style={{ color: "#f472b6", background: "rgba(244, 114, 182, 0.12)", padding: "2px 8px", borderRadius: 6, border: "1px solid rgba(244, 114, 182, 0.25)" }}>
                        {brandSecurity?.meta?.igUsername ? `@${brandSecurity.meta.igUsername}` : (brandSecurity?.meta?.igId ? `ID: ${brandSecurity.meta.igId}` : "No Account Linked")}
                      </span>
                      {brandSecurity && !brandSecurity.isMatched ? (
                        <span style={{ fontSize: 9.5, padding: "1px 6px", borderRadius: 4, background: "rgba(239, 68, 68, 0.25)", color: "#f87171", fontWeight: 700 }}>
                          UNPAIRED
                        </span>
                      ) : autopilotConfig.autoShareInstagram ? (
                        <span style={{ fontSize: 9.5, padding: "1px 6px", borderRadius: 4, background: "rgba(16, 185, 129, 0.2)", color: "#34d399", fontWeight: 700 }}>
                          ACTIVE
                        </span>
                      ) : (
                        <span style={{ fontSize: 9.5, padding: "1px 6px", borderRadius: 4, background: "rgba(148, 163, 184, 0.2)", color: "#94a3b8", fontWeight: 700 }}>
                          MUTED
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: brandSecurity?.meta?.igUsername ? "#e879f9" : "#94a3b8", marginTop: 4, fontWeight: 600 }}>
                      {brandSecurity?.meta?.igUsername ? `✓ Target Account: @${brandSecurity.meta.igUsername}` : "Unpaired with Social Pilot"}
                    </div>
                    <p style={{ margin: "4px 0 0 0", color: (brandSecurity && !brandSecurity.isMatched) ? "#f87171" : "#94a3b8", fontSize: 11.5, lineHeight: 1.4 }}>
                      {brandSecurity && !brandSecurity.isMatched
                        ? `Locked: No matching Instagram account paired with ${connection?.name || "this store"}. Click 'Pair Assets' to link.`
                        : `Auto-formats your article's featured hero image with an AI-crafted caption and posts to @${brandSecurity?.meta?.igUsername || "Instagram"}.`}
                    </p>
                  </div>
                </div>

                {/* Toggle Switch */}
                <div
                  style={{
                    width: 42,
                    height: 22,
                    borderRadius: 12,
                    background: (brandSecurity && !brandSecurity.isMatched) ? "#1e293b" : (autopilotConfig.autoShareInstagram ? "#10b981" : "#334155"),
                    position: "relative",
                    flexShrink: 0,
                    transition: "background 0.2s ease",
                  }}
                >
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      background: (brandSecurity && !brandSecurity.isMatched) ? "#64748b" : "#fff",
                      position: "absolute",
                      top: 3,
                      left: (brandSecurity && !brandSecurity.isMatched) ? 3 : (autopilotConfig.autoShareInstagram ? 23 : 3),
                      transition: "left 0.2s ease",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 9,
                    }}
                  >
                    {brandSecurity && !brandSecurity.isMatched ? "🔒" : null}
                  </div>
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
              {autopilotSaving ? "Saving Settings…" : "💾 Save Autopilot Routine & Topic Lineup"}
            </button>
          </div>

          {/* ── UPCOMING 7-DAY AUTONOMOUS DISPATCH CADENCE ── */}
          <div
            style={{
              background: "rgba(16, 22, 34, 0.78)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: 14,
              padding: 24,
              boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "rgba(56, 189, 248, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#38bdf8",
                  fontSize: 16,
                }}
              >
                📅
              </div>
              <div>
                <h4 style={{ fontSize: 16, color: "#fff", margin: 0, fontWeight: 700 }}>
                  Upcoming 7-Day Velocity Cadence (Projected Dispatch Schedule)
                </h4>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                  Preview of automated publishing days based on your chosen velocity (
                  {autopilotConfig.cadence === "daily"
                    ? "Daily Rollout"
                    : autopilotConfig.cadence === "weekly"
                    ? "Weekly Rollout"
                    : autopilotConfig.cadence === "monthly"
                    ? "Monthly Rollout"
                    : "Paced Rollout"}
                  ). Articles are generated and published autonomously on active dates.
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
              {[0, 1, 2, 3, 4, 5, 6].map((offset) => {
                const d = new Date();
                d.setDate(d.getDate() + offset);
                const isToday = offset === 0;

                // Determine if this day is scheduled based on cadence
                let isScheduled = false;
                if (autopilotConfig.enabled) {
                  if (autopilotConfig.cadence === "daily") {
                    isScheduled = true;
                  } else if (autopilotConfig.cadence === "weekly" || autopilotConfig.cadence === "monthly") {
                    isScheduled = offset === 0;
                  } else if (autopilotConfig.cadence === "alternate") {
                    isScheduled = offset % 2 === 0;
                  } else {
                    isScheduled = true;
                  }
                }

                return (
                  <div
                    key={offset}
                    style={{
                      background: isToday ? "rgba(30, 41, 59, 0.9)" : "rgba(19, 27, 46, 0.7)",
                      border: isToday ? "1.5px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: 10,
                      padding: 16,
                      textAlign: "center",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      minHeight: 110,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: isToday ? "#38bdf8" : "#94a3b8",
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {isToday ? "TODAY" : d.toLocaleDateString("en-US", { weekday: "short" })}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginTop: 4 }}>
                        {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        marginTop: 10,
                        fontWeight: 600,
                        padding: "4px 8px",
                        borderRadius: 6,
                        background: isScheduled ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.04)",
                        color: isScheduled ? "#34d399" : "#64748b",
                        border: isScheduled ? "1px solid rgba(16, 185, 129, 0.25)" : "1px solid transparent",
                      }}
                    >
                      {isScheduled ? "🟢 Active Dispatch Day" : "⚪ Rest / Buffer Day"}
                    </div>
                  </div>
                );
              })}
            </div>
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

      {/* -------------------------------------------------------------
          AI EXISTING BLOG ARTICLE OPTIMIZER MODAL
      ------------------------------------------------------------- */}
      {selectedArticle && (
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
              maxWidth: 960,
              maxHeight: "92vh",
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
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
                  <span>📰</span> AI Blog Article Optimizer & Upgrader
                  <span style={{ fontSize: 11, background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", padding: "2px 8px", borderRadius: 4 }}>
                    {selectedArticle.blog_title || "News"}
                  </span>
                </h3>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                  {selectedArticle.title}
                </div>
              </div>
              <button
                onClick={() => setSelectedArticle(null)}
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
                    value={articleKeywords}
                    onChange={(e) => setArticleKeywords(e.target.value)}
                    placeholder="e.g. Kundan Jewellery, bridal choker, Indian artificial jewellery UK"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
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
                    Desired Tone & Angle:
                  </label>
                  <select
                    value={articleTone}
                    onChange={(e) => setArticleTone(e.target.value)}
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
                    <option value="luxury, persuasive, and SEO-optimized">Luxury & High-Fashion</option>
                    <option value="expert styling authority and educational guide">Styling Guide & Authority</option>
                    <option value="punchy, trending, and benefit-driven">Modern & Viral Trend</option>
                    <option value="conversational, warm, and story-driven">Warm Storytelling</option>
                  </select>
                </div>
              </div>

              {/* Geographic Targeting with Presets */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 4 }}>
                  🌍 Target Countries or Cities / Regional Market:
                </label>
                <input
                  type="text"
                  value={articleTargetLocations}
                  onChange={(e) => setArticleTargetLocations(e.target.value)}
                  placeholder="e.g. United Kingdom, London, Birmingham, USA, India, Dubai"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "#070a10",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "#fff",
                    fontSize: 12.5,
                  }}
                />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                  {[
                    { label: "🌐 Global", val: "Global / Worldwide" },
                    { label: "🇬🇧 UK & Europe", val: "United Kingdom, London, Manchester, Western Europe" },
                    { label: "🇺🇸 USA & Canada", val: "United States, New York, California, Canada, Toronto" },
                    { label: "🇮🇳 India", val: "India, Mumbai, Delhi, Bangalore" },
                    { label: "🇦🇪 UAE & Gulf", val: "United Arab Emirates, Dubai, Abu Dhabi, Saudi Arabia" },
                    { label: "🇦🇺 Australia", val: "Australia, Sydney, Melbourne, New Zealand" },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setArticleTargetLocations(p.val)}
                      style={{
                        padding: "3px 8px",
                        borderRadius: 6,
                        background: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        color: "#94a3b8",
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerateArticleOptimization}
                disabled={optimizingArticle}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)",
                  border: "none",
                  color: "#070a10",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: optimizingArticle ? "not-allowed" : "pointer",
                  boxShadow: "0 2px 10px rgba(56, 189, 248, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <span>{optimizingArticle ? "Synthesizing SEO Upgrade, Headings & FAQs…" : "⚡ Generate AI SEO Upgrade"}</span>
              </button>

              {/* Side-by-side Preview */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 16 }}>
                {/* Left: Current Article on Store */}
                <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: 14, border: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
                    Current Store Article
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                    {selectedArticle.title}
                  </div>
                  <div
                    style={{ fontSize: 12, color: "#cbd5e1", maxHeight: 300, overflowY: "auto", lineHeight: 1.5 }}
                    dangerouslySetInnerHTML={{ __html: selectedArticle.body_html || selectedArticle.summary_html || "<em>No body content found.</em>" }}
                  />
                </div>

                {/* Right: AI Optimized Preview */}
                <div style={{ background: "rgba(56, 189, 248, 0.04)", borderRadius: 12, padding: 14, border: "1px solid rgba(56, 189, 248, 0.25)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: "#38bdf8", textTransform: "uppercase" }}>
                      AI Optimized Article Preview
                    </span>
                    {optimizedArticleData && (
                      <span style={{ fontSize: 10, color: "#34d399", fontWeight: 700 }}>Ready to Push Live</span>
                    )}
                  </div>

                  {!optimizedArticleData && !optimizingArticle && (
                    <div style={{ color: "#64748b", fontSize: 12, padding: "40px 0", textAlign: "center" }}>
                      Click "Generate AI SEO Upgrade" above to rewrite and upgrade this article with high-ranking SEO schema, richer headings, and FAQs.
                    </div>
                  )}

                  {optimizingArticle && (
                    <div style={{ color: "#38bdf8", fontSize: 12, padding: "40px 0", textAlign: "center" }}>
                      ⏳ Elevating title, structuring H2/H3 subheadings, expanding content, and crafting FAQs…
                    </div>
                  )}

                  {optimizedArticleData && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ padding: "8px 10px", background: "#0b101b", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700, marginBottom: 2 }}>
                          Optimized Search Title
                        </div>
                        <div style={{ fontSize: 13, color: "#60a5fa", fontWeight: 700 }}>
                          {optimizedArticleData.optimizedTitle}
                        </div>
                        {optimizedArticleData.summaryHtml && (
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                            {optimizedArticleData.summaryHtml}
                          </div>
                        )}
                      </div>

                      <div
                        style={{ fontSize: 12, color: "#e2e8f0", maxHeight: 260, overflowY: "auto", lineHeight: 1.5, padding: "8px 10px", background: "rgba(0,0,0,0.2)", borderRadius: 8 }}
                        dangerouslySetInnerHTML={{ __html: optimizedArticleData.bodyHtml }}
                      />

                      {optimizedArticleData.suggestedTags?.length > 0 && (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                          {optimizedArticleData.suggestedTags.map((t, idx) => (
                            <span key={idx} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(255,255,255,0.06)", color: "#cbd5e1" }}>
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {articleSuccessMsg && (
                <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#34d399", fontSize: 13, textAlign: "center" }}>
                  <div>{articleSuccessMsg}</div>
                  <a
                    href={selectedArticle.live_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#38bdf8", fontWeight: 700, textDecoration: "underline", marginTop: 6, display: "inline-block" }}
                  >
                    View Updated Live Article on Shopify Storefront ↗
                  </a>
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
                type="button"
                onClick={() => setSelectedArticle(null)}
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
                type="button"
                onClick={handlePushUpdatedArticleToShopify}
                disabled={!optimizedArticleData || updatingArticle}
                style={{
                  padding: "10px 22px",
                  borderRadius: 8,
                  background: optimizedArticleData
                    ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                    : "rgba(255, 255, 255, 0.05)",
                  border: "none",
                  color: optimizedArticleData ? "#fff" : "#64748b",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: optimizedArticleData && !updatingArticle ? "pointer" : "not-allowed",
                  boxShadow: optimizedArticleData ? "0 2px 10px rgba(16, 185, 129, 0.35)" : "none",
                }}
              >
                {updatingArticle ? "Pushing Live Updates to Shopify…" : "🚀 Push Updates Live to Shopify ↗"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          1-CLICK SOCIAL MEDIA SHARING MODAL (FACEBOOK & INSTAGRAM)
      ------------------------------------------------------------- */}
      {socialModalOpen && socialShareData && (
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
              maxWidth: 640,
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.8)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "18px 22px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(255, 255, 255, 0.02)",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
                  <span>📢</span> Share Blog to Social Media
                </h3>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                  1-Click Direct Publishing to Connected Facebook Page & Instagram
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSocialModalOpen(false)}
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

            {/* Body */}
            <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16, maxHeight: "78vh", overflowY: "auto" }}>
              {/* Article Target Preview */}
              <div style={{ padding: "12px 14px", background: "#080c14", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 10, display: "flex", gap: 12, alignItems: "center" }}>
                {socialShareData.featuredImageUrl ? (
                  <img src={socialShareData.featuredImageUrl} alt={socialShareData.title} style={{ width: 60, height: 60, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 60, height: 60, borderRadius: 8, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                    🛍️
                  </div>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.3 }}>
                    {socialShareData.title}
                  </div>
                  <div style={{ fontSize: 11, color: "#38bdf8", marginTop: 4, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                    🔗 {socialShareData.postUrl}
                  </div>
                </div>
              </div>

              {/* Explicit Target Account Card */}
              <div style={{ background: "rgba(10, 14, 23, 0.6)", borderRadius: 8, padding: "10px 14px", border: "1px solid rgba(255, 255, 255, 0.08)", fontSize: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#e2e8f0", marginBottom: 6 }}>
                  <span>📘</span>
                  <strong>Facebook Target:</strong>
                  <span style={{ color: "#38bdf8" }}>
                    {brandSecurity?.meta?.pageName || brandSecurity?.meta?.display || "Connected Facebook Page"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#e2e8f0" }}>
                  <span>📸</span>
                  <strong>Instagram Target:</strong>
                  <span style={{ color: "#e879f9" }}>
                    {brandSecurity?.meta?.igUsername ? `@${brandSecurity.meta.igUsername}` : "Connected Instagram Account"}
                  </span>
                </div>
              </div>

              {/* Target Platform Select */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 8 }}>
                  Target Destination Channel:
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  {[
                    { id: "both", label: "Facebook + IG", icon: "🚀" },
                    { id: "facebook", label: "Facebook Page", icon: "🌐" },
                    { id: "instagram", label: "Instagram Feed", icon: "📸" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSocialPlatform(p.id)}
                      style={{
                        padding: "10px",
                        borderRadius: 8,
                        background: socialPlatform === p.id ? "rgba(24, 119, 242, 0.2)" : "rgba(255, 255, 255, 0.03)",
                        border: socialPlatform === p.id ? "1.5px solid #1877f2" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: socialPlatform === p.id ? "#60a5fa" : "#94a3b8",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span style={{ fontSize: 16 }}>{p.icon}</span>
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Caption */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                  Post Caption & Teaser:
                </label>
                <textarea
                  rows={3}
                  value={socialCustomCaption}
                  onChange={(e) => setSocialCustomCaption(e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "9px 12px",
                    borderRadius: 8,
                    background: "#080c14",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#fff",
                    fontSize: 12.5,
                    lineHeight: 1.5,
                    resize: "vertical",
                  }}
                />
              </div>

              {/* Hashtags */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                  Search & Discovery Hashtags:
                </label>
                <input
                  type="text"
                  value={socialCustomHashtags}
                  onChange={(e) => setSocialCustomHashtags(e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "9px 12px",
                    borderRadius: 8,
                    background: "#080c14",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#fff",
                    fontSize: 12.5,
                  }}
                />
              </div>

              {/* Brand Mismatch Alert in Modal */}
              {brandSecurity && !brandSecurity.isMatched && (
                <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(239, 68, 68, 0.15)", border: "1.5px solid rgba(239, 68, 68, 0.4)", color: "#fca5a5", fontSize: 12.5, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 800, color: "#fee2e2", display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span>🛡️</span> Brand Mismatch Guard Active
                  </div>
                  Connected Meta profile belongs to <strong>{brandSecurity.meta?.display || "another business profile"}</strong>, whereas this article belongs to <strong>{connection?.name || connection?.shopName || "this store"}</strong>.
                  <div style={{ marginTop: 4, fontSize: 11.5, color: "#f87171" }}>
                    Social publishing is locked to prevent brand contamination and unauthorized multi-business asset sharing.
                  </div>
                </div>
              )}

              {/* Meta Connect Notice */}
              {showMetaConnectNotice && (
                <div style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.35)", color: "#fca5a5", fontSize: 12.5, lineHeight: 1.5 }}>
                  ⚠️ <strong>Meta Account Not Linked:</strong> Your Facebook Page or Instagram Business Account is not yet connected to GabbarInfo AI.
                  <div style={{ marginTop: 8 }}>
                    <a
                      href="/social-pilot"
                      style={{ color: "#38bdf8", fontWeight: 700, textDecoration: "underline" }}
                    >
                      Connect Meta in Social Pilot Tab ↗
                    </a>
                  </div>
                </div>
              )}

              {/* Status Notice */}
              {socialShareStatus && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: socialShareStatus.ok ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                    border: socialShareStatus.ok ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
                    color: socialShareStatus.ok ? "#34d399" : "#fca5a5",
                    fontSize: 13,
                    textAlign: "center",
                    fontWeight: 600,
                  }}
                >
                  {socialShareStatus.message}
                </div>
              )}
            </div>

            {/* Footer */}
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
                type="button"
                onClick={() => setSocialModalOpen(false)}
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
                type="button"
                onClick={handleExecuteSocialShare}
                disabled={socialSharing || (brandSecurity && !brandSecurity.isMatched)}
                style={{
                  padding: "10px 22px",
                  borderRadius: 8,
                  background: (brandSecurity && !brandSecurity.isMatched)
                    ? "rgba(239, 68, 68, 0.2)"
                    : "linear-gradient(135deg, #1877f2 0%, #0d6efd 100%)",
                  border: (brandSecurity && !brandSecurity.isMatched) ? "1px solid rgba(239, 68, 68, 0.4)" : "none",
                  color: (brandSecurity && !brandSecurity.isMatched) ? "#fca5a5" : "#fff",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: (socialSharing || (brandSecurity && !brandSecurity.isMatched)) ? "not-allowed" : "pointer",
                  boxShadow: (brandSecurity && !brandSecurity.isMatched) ? "none" : "0 2px 10px rgba(24, 119, 242, 0.35)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>
                  {brandSecurity && !brandSecurity.isMatched
                    ? "🔒 Blocked: Brand Mismatch"
                    : (socialSharing ? "Publishing to Social Media…" : "🚀 Publish to Social Media Now ↗")}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showPairingModal && (
        <BrandAssetPairingModal
          onClose={() => setShowPairingModal(false)}
          onSaved={() => fetchAutopilotConfig(selectedShop)}
        />
      )}
    </div>
  );
}
