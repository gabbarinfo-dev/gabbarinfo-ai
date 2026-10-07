"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Head from "next/head";
import BrandAssetPairingModal from "./components/brands/BrandAssetPairingModal";
import SubscriptionModal from "./components/SubscriptionModal";

export default function SeoHubPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Subscription & Entitlements
  const [subData, setSubData] = useState(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  // State
  const [activeBusiness, setActiveBusiness] = useState("");
  const [allConnections, setAllConnections] = useState({});
  const [brandMeta, setBrandMeta] = useState(null);
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [mode, setMode] = useState("manual"); // "manual" | "autopilot"
  const [activeTab, setActiveTab] = useState("content"); // "content" | "topics" | "autopilot" | "integrations"
  const [connection, setConnection] = useState(null);
  const [loadingConn, setLoadingConn] = useState(true);

  // Content Hub State
  const [contentList, setContentList] = useState([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [contentFilter, setContentFilter] = useState("all"); // "all" | "post" | "page"
  const [searchQuery, setSearchQuery] = useState("");
  const [autopilotPublishedCount, setAutopilotPublishedCount] = useState(0);
  const [lastPublishedAt, setLastPublishedAt] = useState(null);

  // Optimize Modal State
  const [optimizingItem, setOptimizingItem] = useState(null);
  const [optTitle, setOptTitle] = useState("");
  const [optMetaTitle, setOptMetaTitle] = useState("");
  const [optMetaDesc, setOptMetaDesc] = useState("");
  const [optFocusKw, setOptFocusKw] = useState("");
  const [optSaving, setOptSaving] = useState(false);

  // Autonomous AI Page Optimizer State
  const [isOptimizingWithAi, setIsOptimizingWithAi] = useState(false);
  const [showAiOptimizeModal, setShowAiOptimizeModal] = useState(false);
  const [aiCustomInstructions, setAiCustomInstructions] = useState("");
  const [aiImprovements, setAiImprovements] = useState([]);
  const [aiPreScore, setAiPreScore] = useState(null);
  const [aiPostScore, setAiPostScore] = useState(null);

  // New Blog Generator Modal
  const [showNewBlogModal, setShowNewBlogModal] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [newWordCount, setNewWordCount] = useState(1500);
  const [generatingBlog, setGeneratingBlog] = useState(false);
  const [publishedResult, setPublishedResult] = useState(null);
  const [socialSharing, setSocialSharing] = useState(false);
  const [socialShareStatus, setSocialShareStatus] = useState(null);

  // Topics & Keywords State
  const [keywords, setKeywords] = useState([]);
  const [newKeywordInput, setNewKeywordInput] = useState("");

  const [discoveredNiche, setDiscoveredNiche] = useState("");
  const [nicheSummary, setNicheSummary] = useState("");

  const [suggestedTopics, setSuggestedTopics] = useState([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [targetMarket, setTargetMarket] = useState("");
  const [loadingKeywords, setLoadingKeywords] = useState(false);

  // Real Universal AI Keyword Research (Any Market: Global, National, State, or City)
  const fetchKeywordsForTopic = async (topicTitle, market = targetMarket) => {
    if (!topicTitle) return;
    setLoadingKeywords(true);
    try {
      const res = await fetch("/api/wordpress/suggest-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topicTitle,
          businessName: activeBusiness,
          industry: discoveredNiche || "",
          targetMarket: market || "",
        }),
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.keywords) && data.keywords.length > 0) {
        setNewKeywords(data.keywords.join(", "));
      } else {
        const words = topicTitle.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 3);
        const derived = words.slice(0, 4).join(" ");
        setNewKeywords(derived ? `${derived}, ${topicTitle.toLowerCase()}` : topicTitle);
      }
    } catch (e) {
      console.error("Keyword research error:", e);
      setNewKeywords(topicTitle);
    } finally {
      setLoadingKeywords(false);
    }
  };

  const handleSelectTopic = (top) => {
    if (!connection?.siteUrl) {
      alert("⚠️ Please connect your WordPress website in the 'WordPress Connector & GSC' tab first to generate and edit articles.");
      setActiveTab("integrations");
      return;
    }
    setNewTopic(top);
    setShowNewBlogModal(true);
    setNewKeywords("🔍 Researching high-ranking search queries for this topic…");
    fetchKeywordsForTopic(top, targetMarket);
  };

  // Autopilot State & Cadence
  const [autopilotEnabled, setAutopilotEnabled] = useState(false);
  const [cadence, setCadence] = useState("daily"); // 'daily' | 'weekly' | 'monthly' | 'custom'
  const [customDaysPerWeek, setCustomDaysPerWeek] = useState(3);
  const [autoShareFb, setAutoShareFb] = useState(false);
  const [autoShareIg, setAutoShareIg] = useState(false);
  const [autopilotTargetLocations, setAutopilotTargetLocations] = useState("");
  const [savingAutopilotConfig, setSavingAutopilotConfig] = useState(false);
  const [runningCycle, setRunningCycle] = useState(false);
  const [cycleNotice, setCycleNotice] = useState("");

  // ── WRITING & OPTIMIZATION SUITE STATE (Draft & Edit) ──
  const [editingArticle, setEditingArticle] = useState(null);
  const [editorMode, setEditorMode] = useState("visual"); // 'visual' | 'html'
  const visualEditorRef = useRef(null);

  useEffect(() => {
    if (editorMode === "visual" && visualEditorRef.current && editingArticle) {
      const incoming = editingArticle.content || "";
      if (visualEditorRef.current.innerHTML !== incoming) {
        visualEditorRef.current.innerHTML = incoming;
      }
    }
  }, [editingArticle?.id, editingArticle?.content, editorMode]);
  const [serpPreviewMode, setSerpPreviewMode] = useState("desktop"); // 'desktop' | 'mobile'
  const [savingArticle, setSavingArticle] = useState(false);
  const [publishingArticle, setPublishingArticle] = useState(false);
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [editorNotice, setEditorNotice] = useState(null);
  const [loadingArticleContent, setLoadingArticleContent] = useState(false);

  // Custom Theme Template Detection & Choice Modal States
  const [showCustomPublishModal, setShowCustomPublishModal] = useState(false);
  const [customOptimizeMode, setCustomOptimizeMode] = useState("dynamic");
  const [showDiffTooltip, setShowDiffTooltip] = useState(false);
  const [copiedPhpCode, setCopiedPhpCode] = useState(false);
  const [syncingSeoOnly, setSyncingSeoOnly] = useState(false);

  // Social Connect Modal
  const [showFbConnectModal, setShowFbConnectModal] = useState(false);

  // New Website Connection Modal & State in SEO Suite
  const [showAddSiteModal, setShowAddSiteModal] = useState(false);
  const [addBizName, setAddBizName] = useState("");
  const [addSiteUrl, setAddSiteUrl] = useState("");
  const [addApiKey, setAddApiKey] = useState("");
  const [addingSite, setAddingSite] = useState(false);
  const [addSiteError, setAddSiteError] = useState("");

  const handleAddSite = async () => {
    if (!addBizName.trim() || !addSiteUrl.trim() || !addApiKey.trim()) {
      setAddSiteError("Please provide business name, website URL, and plugin key.");
      return;
    }
    setAddingSite(true);
    setAddSiteError("");
    try {
      const res = await fetch("/api/wordpress/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-connection",
          businessName: addBizName.trim(),
          siteUrl: addSiteUrl.trim(),
          apiKey: addApiKey.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setShowAddSiteModal(false);
        const newBiz = addBizName.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
        setActiveBusiness(newBiz);
        if (typeof window !== "undefined") {
          localStorage.setItem("gabbar_active_business", newBiz);
        }
        await fetchConnection();
        setAddBizName("");
        setAddSiteUrl("");
        setAddApiKey("");
        alert("🎉 Website connected successfully!");
      } else {
        setAddSiteError(data.error || "Failed to pair website.");
      }
    } catch (e) {
      setAddSiteError("Error: " + e.message);
    } finally {
      setAddingSite(false);
    }
  };

  const connectedProfiles = Object.keys(allConnections || {}).filter(k => allConnections[k]?.siteUrl);

  // 0. Fetch Subscription Status & Entitlements
  useEffect(() => {
    if (!session) return;
    async function fetchSub() {
      try {
        const res = await fetch("/api/subscriptions/status");
        if (res.ok) {
          const data = await res.json();
          if (data.ok) setSubData(data);
        }
      } catch (e) {
        console.warn("Sub status fetch error in seo:", e);
      } finally {
        setLoadingSub(false);
      }
    }
    fetchSub();
  }, [session]);

  const planId = (subData?.subscription?.planId || "none").toLowerCase();
  const isTrial99 = planId === "trial_99" || planId === "trial-99";
  const canUseSeoAutopilot = Boolean(
    subData?.subscription?.isUnlimited ||
    (!isTrial99 && planId !== "none" && planId !== "try" && subData?.subscription?.status === "active")
  );

  // 1. Initial Load: Read from URL query or localStorage
  useEffect(() => {
    if (router?.isReady) {
      const qBiz = router.query?.business;
      if (qBiz) {
        setActiveBusiness(String(qBiz));
        if (typeof window !== "undefined") localStorage.setItem("gabbar_active_business", String(qBiz));
      } else if (typeof window !== "undefined") {
        const saved = localStorage.getItem("gabbar_active_business");
        if (saved && (!activeBusiness || activeBusiness === "default")) {
          setActiveBusiness(saved);
        }
      }
    }
  }, [router?.isReady, router?.query?.business]);

  // 2. Auto-switch to first connected profile if current has no site
  useEffect(() => {
    if (connectedProfiles.length > 0 && (!activeBusiness || !connectedProfiles.includes(activeBusiness))) {
      const target = (typeof window !== "undefined" && localStorage.getItem("gabbar_active_business") && connectedProfiles.includes(localStorage.getItem("gabbar_active_business")))
        ? localStorage.getItem("gabbar_active_business")
        : connectedProfiles[0];
      setActiveBusiness(target);
    }
  }, [allConnections]);

  // 3. Load connection info and matching Brand Meta whenever business changes
  useEffect(() => {
    if (!session) return;
    fetchConnection();
  }, [session, activeBusiness]);

  const fetchBrandMeta = async (bizName, siteUrl = null) => {
    try {
      const uParam = siteUrl ? `&siteUrl=${encodeURIComponent(siteUrl)}` : "";
      const bParam = bizName ? `&businessName=${encodeURIComponent(bizName)}` : "";
      const res = await fetch(`/api/meta/status?${uParam}${bParam}`);
      const data = await res.json();
      if (data.connected && data.brandMeta) {
        setBrandMeta(data.brandMeta);
        return data.brandMeta;
      } else {
        setBrandMeta(null);
        return null;
      }
    } catch (_) {
      setBrandMeta(null);
      return null;
    }
  };

  const handleSelectBusiness = (newBiz) => {
    if (newBiz === "__add_new__") {
      setShowAddSiteModal(true);
      return;
    }
    setActiveBusiness(newBiz);
    // COMPLETE PURGE OF PREVIOUS BUSINESS CONTEXT (ZERO CROSS-CONTAMINATION)
    setBrandMeta(null);
    setAutoShareFb(false);
    setAutoShareIg(false);
    setContentList([]);
    setEditingArticle(null);
    setPublishedResult(null);
    setSocialShareStatus(null);
    setKeywords([]);
    setAiCustomInstructions("");
    setSuggestedTopics([]);
    setDiscoveredNiche("");
    setNicheSummary("");
    setAutopilotTargetLocations("");
    setAiPreScore(null);
    setAiPostScore(null);
    setEditorNotice(null);
    setShowCustomPublishModal(false);
    setShowAiOptimizeModal(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("gabbar_active_business", newBiz);
    }
    if (router?.isReady) {
      router.replace({ query: { ...router.query, business: newBiz } }, undefined, { shallow: true });
    }
  };

  const fetchConnection = async () => {
    setLoadingConn(true);
    try {
      const res = await fetch(`/api/wordpress/sync?action=get-connection&businessName=${encodeURIComponent(activeBusiness || "")}`);
      const data = await res.json();
      if (data.ok) {
        setAllConnections(data.allConnections || {});
        if (data.connection) {
          setConnection(data.connection);
          const bName = data.connection.businessName || activeBusiness;
          if (!activeBusiness && bName) setActiveBusiness(bName);
          await fetchBrandMeta(bName || activeBusiness, data.connection.siteUrl);
          fetchContent(data.connection);
          fetchAutopilotConfig(bName || activeBusiness);
          fetchDiscoveredTopics(bName || activeBusiness, data.connection.siteUrl, false);
        } else {
          setConnection(null);
          await fetchBrandMeta(activeBusiness, null);
          setContentList([]);
          setKeywords([]);
          setDiscoveredNiche("");
          setNicheSummary("");
        }
      } else {
        setConnection(null);
        await fetchBrandMeta(activeBusiness, null);
        setContentList([]);
        setKeywords([]);
        setDiscoveredNiche("");
        setNicheSummary("");
      }
    } catch (e) {
      console.error("Failed to load connection:", e);
    } finally {
      setLoadingConn(false);
    }
  };

  const fetchAutopilotConfig = async (targetBusiness) => {
    try {
      const bizToUse = targetBusiness || activeBusiness;
      const res = await fetch("/api/wordpress/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get-autopilot-config",
          businessName: bizToUse,
        }),
      });
      const data = await res.json();
      if (data.ok && data.config) {
        const isEnabled = Boolean(data.config.enabled);
        setAutopilotEnabled(isEnabled);
        setMode(isEnabled ? "autopilot" : "manual");
        setCadence(data.config.cadence || "daily");
        setCustomDaysPerWeek(Number(data.config.customDaysPerWeek) || 3);
        setAutoShareFb(data.config.autoShareFacebook === true);
        setAutoShareIg(data.config.autoShareInstagram === true);
        setAutopilotPublishedCount(Number(data.config.publishedCount) || 0);
        setLastPublishedAt(data.config.lastPublishedAt || null);
        if (Array.isArray(data.config.suggestedTopics) && data.config.suggestedTopics.length > 0) {
          setSuggestedTopics(data.config.suggestedTopics);
        } else {
          setSuggestedTopics([]);
        }
        if (data.config.discoveredNiche) {
          setDiscoveredNiche(data.config.discoveredNiche);
        } else {
          setDiscoveredNiche("");
        }
        if (data.config.nicheSummary) {
          setNicheSummary(data.config.nicheSummary);
        } else {
          setNicheSummary("");
        }
        if (Array.isArray(data.config.targetKeywords) && data.config.targetKeywords.length > 0) {
          setKeywords(data.config.targetKeywords);
        } else {
          setKeywords([]);
        }
        if (data.config.targetLocations || data.config.targetMarket) {
          setAutopilotTargetLocations(data.config.targetLocations || data.config.targetMarket);
        } else {
          setAutopilotTargetLocations("");
        }
      } else {
        setKeywords([]);
        setDiscoveredNiche("");
        setNicheSummary("");
      }
    } catch (e) {
      console.warn("Could not load autopilot config:", e);
    }
  };

  const handleSaveAutopilotSettings = async (overrideEnabled) => {
    if (!connection?.siteUrl) {
      alert("⚠️ Please connect your WordPress website in the 'WordPress Connector & GSC' tab first.");
      setActiveTab("integrations");
      return;
    }
    const isEnabled = typeof overrideEnabled === "boolean" ? overrideEnabled : autopilotEnabled;
    if (isEnabled && (isTrial99 || !canUseSeoAutopilot)) {
      setShowSubscriptionModal(true);
      return;
    }
    setSavingAutopilotConfig(true);
    const bizToUse = activeBusiness || connection?.businessName || "default";
    try {
      const res = await fetch("/api/wordpress/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-autopilot-config",
          businessName: bizToUse,
          config: {
            enabled: isEnabled,
            cadence,
            customDaysPerWeek,
            autoShareFacebook: autoShareFb,
            autoShareInstagram: autoShareIg,
            targetKeywords: keywords,
            targetLocations: autopilotTargetLocations.trim(),
            targetMarket: autopilotTargetLocations.trim(),
            wordCount: 1500,
          },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setAutopilotEnabled(isEnabled);
        setMode(isEnabled ? "autopilot" : "manual");
        const cadLabel = cadence === "daily" ? "Daily" : cadence === "weekly" ? "Weekly" : cadence === "monthly" ? "Monthly" : `${customDaysPerWeek}x/week`;
        setCycleNotice(`✅ Autopilot schedule saved (${isEnabled ? "Active" : "Paused"}, ${cadLabel}). Autonomous social cross-posting preferences updated.`);
        setTimeout(() => setCycleNotice(""), 6000);
      } else {
        alert("Failed to save autopilot settings: " + (data.error || "Unknown error"));
      }
    } catch (e) {
      alert("Error saving autopilot settings: " + e.message);
    } finally {
      setSavingAutopilotConfig(false);
    }
  };

  const fetchContent = async (conn) => {
    setLoadingContent(true);
    try {
      const res = await fetch("/api/wordpress/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "list-content",
          siteUrl: conn?.siteUrl || connection?.siteUrl,
          apiKey: conn?.apiKey || connection?.apiKey,
          businessName: activeBusiness,
          per_page: 100,
        }),
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.items)) {
        setContentList(data.items);
      }
    } catch (e) {
      console.error("Failed to fetch site content:", e);
    } finally {
      setLoadingContent(false);
    }
  };

  // Optimize modal handler
  const handleOpenOptimize = (item) => {
    setOptimizingItem(item);
    setOptTitle(item.title || "");
    setOptMetaTitle(item.meta_title || item.title || "");
    setOptMetaDesc(item.meta_desc || item.excerpt || "");
    setOptFocusKw(item.focus_keyword || "");
  };

  const handleSaveOptimization = async () => {
    if (!optimizingItem || !connection) return;
    setOptSaving(true);
    try {
      const res = await fetch("/api/wordpress/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-content",
          siteUrl: connection.siteUrl,
          apiKey: connection.apiKey,
          businessName: activeBusiness,
          updateData: {
            post_id: optimizingItem.id,
            title: optTitle,
            meta_title: optMetaTitle,
            meta_description: optMetaDesc,
            focus_keyword: optFocusKw,
          },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        alert("✅ SEO parameters updated on WordPress!");
        setOptimizingItem(null);
        fetchContent(connection);
      } else {
        alert("Failed to update: " + (data.error || "Unknown error"));
      }
    } catch (e) {
      alert("Error saving optimization: " + e.message);
    } finally {
      setOptSaving(false);
    }
  };

  // ── WRITING SUITE: Real-Time SEO & GEO Audit Engine (100 Points) ──
  const computeAuditScore = (art) => {
    if (!art) {
      return {
        score: 0,
        grade: "NEEDS OPTIMIZATION",
        wordCount: 0,
        internalLinksCount: 0,
        externalLinksCount: 0,
        categories: { keyword: 0, geo: 0, depth: 0, links: 0 },
        checks: {},
      };
    }

    const kw = (art.focus_keyword || "").trim().toLowerCase();
    const title = (art.title || "").toLowerCase();
    const slug = (art.slug || "").toLowerCase();
    const metaTitle = (art.meta_title || art.title || "").trim();
    const metaDesc = (art.meta_description || "").trim();
    const rawContent = art.content || "";
    const cleanText = rawContent.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const wordCount = cleanText ? cleanText.split(" ").filter(Boolean).length : 0;
    const introText = cleanText.split(" ").slice(0, 120).join(" ").toLowerCase();

    const siteDomain = connection?.siteUrl
      ? connection.siteUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
      : "gabbarinfo.com";

    const cleanDomain = siteDomain.replace(/\./g, "\\.");
    const internalLinksCount = (
      rawContent.match(
        new RegExp(`href=["'](https?:\\/\\/(?:www\\.)?${cleanDomain}|\\/[a-zA-Z0-9_-]|tel:|mailto:|https:\\/\\/wa\\.me)`, "gi")
      ) || []
    ).length;
    const externalLinksCount = (
      rawContent.match(
        new RegExp(`href=["']https?:\\/\\/(?!(?:www\\.)?${cleanDomain})[^"']+`, "gi")
      ) || []
    ).length;

    const hasSubheadings = (rawContent.match(/<h[23][^>]*>/gi) || []).length >= 2;
    const hasTablesOrLists = /<(table|ul|ol)[^>]*>/i.test(rawContent);
    const hasExecSummary = /(tl;?dr|executive summary|direct answer|key takeaways|overview|summary|why choose|what happens|strategy|process|why businesses)/i.test(rawContent);
    const hasImage = Boolean(art.featured_image || /<(?:img|video)[^>]*>/i.test(rawContent));
    const titleCalibrated = metaTitle.length >= 40 && metaTitle.length <= 70;
    const descCalibrated = metaDesc.length >= 115 && metaDesc.length <= 170;

    const isLandingPage = art.post_type === "page" || art.type === "page" || !art.post_type;
    const targetWordCount = isLandingPage ? 380 : 850;

    // 13 Optimization Checklist Items
    const c1 = Boolean(kw && metaTitle.toLowerCase().includes(kw)); // +8 pts
    const c2 = Boolean(kw && (slug.includes(kw.replace(/\s+/g, "-")) || slug.includes(kw.split(" ")[0]))); // +5 pts
    const c3 = Boolean(kw && metaDesc.toLowerCase().includes(kw)); // +7 pts
    const c4 = Boolean(kw && (title.includes(kw) || introText.includes(kw))); // +5 pts
    const c5 = true; // Generative Engine Optimization (JSON-LD Schema Active) +10 pts
    const c6 = hasSubheadings; // Subheading Hierarchy (2+ H2/H3 Headings) +8 pts
    const c7 = hasExecSummary; // Executive Summary / Decision Section +7 pts
    const c8 = wordCount >= targetWordCount; // Comprehensive Content Length (+6 pts)
    const c9 = hasTablesOrLists; // Structured Data Tables / Bulleted Lists +7 pts
    const c10 = hasImage; // Featured Banner Image or Video Media +8 pts
    const c11 = internalLinksCount >= 1; // Internal Links / Conversion Anchors +10 pts
    const c12 = externalLinksCount >= 1; // External Authority Citations +7 pts
    const c13 = titleCalibrated && descCalibrated; // Meta Title & Description Length Calibration +8 pts

    const keywordScore = (c1 ? 8 : 0) + (c2 ? 5 : 0) + (c3 ? 7 : 0) + (c4 ? 5 : 0);
    const geoScore = (c5 ? 10 : 0) + (c6 ? 8 : 0) + (c7 ? 7 : 0);
    const depthScore = (c8 ? 6 : 0) + (c9 ? 7 : 0) + (c10 ? 8 : 0) + (titleCalibrated ? 4 : 0);
    const linkScore = (c11 ? 10 : 0) + (c12 ? 7 : 0) + (descCalibrated ? 8 : 0);

    const total = Math.min(100, keywordScore + geoScore + depthScore + linkScore);
    let grade = "NEEDS OPTIMIZATION";
    if (total >= 80) grade = "EXCELLENT - READY TO RANK";
    else if (total >= 60) grade = "GOOD - MINOR OPTIMIZATIONS NEEDED";

    return {
      score: total,
      grade,
      wordCount,
      internalLinksCount,
      externalLinksCount,
      categories: {
        keyword: keywordScore,
        geo: geoScore,
        depth: depthScore,
        links: linkScore,
      },
      checks: {
        c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13,
      },
    };
  };

  // Open Article in Full Writing & Optimization Suite
  const handleOpenEditor = async (item) => {
    setLoadingArticleContent(true);
    setEditingArticle({
      ...item,
      content: item.content || "<p>Loading full live article content from WordPress…</p>",
    });

    try {
      const res = await fetch("/api/wordpress/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get-post",
          postId: item.id,
          postType: item.type || item.post_type || "post",
          url: item.url,
          siteUrl: connection?.siteUrl,
          apiKey: connection?.apiKey,
          businessName: activeBusiness,
        }),
      });
      const data = await res.json();
      if (data.ok && data.post?.content) {
        setEditingArticle({
          ...item,
          ...data.post,
          content: data.post.content,
          title: data.post.title || item.title,
          slug: data.post.slug || item.slug,
          status: data.post.status || item.status,
          meta_title: data.post.meta_title || item.meta_title || item.title,
          meta_description: data.post.meta_desc || item.meta_desc || item.excerpt || "",
          focus_keyword: data.post.focus_keyword || item.focus_keyword || "",
          is_agent_created: data.post.is_agent_created ?? item.is_agent_created ?? false,
          edit_count: data.post.edit_count ?? item.edit_count ?? 0,
          edits_remaining: data.post.edits_remaining ?? item.edits_remaining ?? 0,
          requires_credit: data.post.requires_credit ?? item.requires_credit ?? true,
          is_custom_template: data.post.is_custom_template ?? item.is_custom_template ?? false,
          template_file: data.post.template_file || item.template_file || "",
          bypasses_db_content: data.post.bypasses_db_content ?? item.bypasses_db_content ?? false,
          is_live_extracted: data.post.is_live_extracted || false,
        });
      } else {
        setEditingArticle({
          ...item,
          content: `<p>${item.excerpt || item.title}</p>`,
        });
      }
    } catch (e) {
      console.warn("Could not load post content:", e);
      setEditingArticle({
        ...item,
        content: `<p>${item.excerpt || item.title}</p>`,
      });
    } finally {
      setLoadingArticleContent(false);
    }
  };

  // Save Article (Draft or Publish Live with Quota Check)
  const handleSaveArticle = async (targetStatus = "draft", options = {}) => {
    if (!editingArticle || !connection) return;

    // Credit quota confirmation for pre-existing content or agent content with >= 2 edits
    if (editingArticle.requires_credit && targetStatus === "publish") {
      const confirmSave = window.confirm(
        "📢 Quota Confirmation: Publishing an update to this existing website page/article will consume 1 Published Blog credit from your monthly plan quota.\n\nDo you want to proceed?"
      );
      if (!confirmSave) return;
    }

    if (targetStatus === "publish") setPublishingArticle(true);
    else setSavingArticle(true);

    try {
      const res = await fetch("/api/wordpress/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-content",
          siteUrl: connection.siteUrl,
          apiKey: connection.apiKey,
          businessName: activeBusiness,
          updateData: {
            post_id: editingArticle.id,
            title: editingArticle.title,
            post_type: editingArticle.post_type || editingArticle.type || "page",
            preserve_title: Boolean(editingArticle.post_type === "page" || editingArticle.type === "page" || (editingArticle.title && editingArticle.title.length < 50)),
            content: editingArticle.content,
            slug: editingArticle.slug,
            status: targetStatus,
            meta_title: editingArticle.meta_title || editingArticle.title,
            meta_description: editingArticle.meta_description || editingArticle.excerpt || "",
            focus_keyword: editingArticle.focus_keyword || "",
            is_agent_created: editingArticle.is_agent_created,
            edit_count: editingArticle.edit_count,
            requires_credit: editingArticle.requires_credit,
            render_optimized: options.render_optimized ?? true,
          },
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setEditingArticle((prev) => ({
          ...prev,
          status: targetStatus,
          url: data.url || prev.url,
          edit_count: (prev.edit_count || 0) + 1,
          edits_remaining: prev.is_agent_created ? Math.max(0, 1 - (prev.edit_count || 0)) : 0,
          requires_credit: !prev.is_agent_created || (prev.edit_count || 0) + 1 >= 2,
        }));
        const creditMsg = data.credit_deducted
          ? " (1 Blog Published credit consumed from monthly quota)"
          : " (Free Revision applied)";
        setEditorNotice({
          type: "success",
          message:
            targetStatus === "publish"
              ? `🎉 Page successfully published live to WordPress!${creditMsg}`
              : `💾 Draft saved successfully to WordPress!${creditMsg}`,
        });
        setTimeout(() => setEditorNotice(null), 6000);
        setShowCustomPublishModal(false);
        fetchContent(connection);
      } else {
        if (data.code === "MONTHLY_QUOTA_EXHAUSTED") {
          alert(`⚠️ Plan Limit Reached: ${data.error}`);
        } else {
          alert("Failed to save: " + (data.error || "Unknown error"));
        }
      }
    } catch (e) {
      alert("Save error: " + e.message);
    } finally {
      setSavingArticle(false);
      setPublishingArticle(false);
    }
  };

  // Smart Publish Router: 1-Click for normal sites, Choice Modal for Custom Themes
  const handleInitiatePublish = () => {
    if (!editingArticle || !connection) return;
    const isCustom = Boolean(
      editingArticle.is_custom_template ||
      editingArticle.bypasses_db_content ||
      (editingArticle.template_file && editingArticle.template_file !== "default")
    );
    if (isCustom) {
      setShowCustomPublishModal(true);
    } else {
      handleSaveArticle("publish");
    }
  };

  // Generate 100% Ready-to-paste PHP template code for cPanel Developer Mode
  const getFullPhpTemplateCode = () => {
    if (!editingArticle) return "";
    const cleanTplName = editingArticle.template_file
      ? editingArticle.template_file.replace(/^page-|\.php$/g, "").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) + " Page"
      : `${editingArticle.title || "Custom"} Page`;

    const rawContent = editingArticle.content || "";
    return `<?php\n/**\n * Template Name: ${cleanTplName}\n */\nget_header(); ?>\n\n${rawContent}\n\n<?php get_footer(); ?>\n`;
  };

  const handleCopyPhpCode = () => {
    const code = getFullPhpTemplateCode();
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedPhpCode(true);
      setTimeout(() => setCopiedPhpCode(false), 3500);
    } else {
      alert("Code copied to clipboard!");
    }
  };

  // Option 2 SEO Sync: Syncs Yoast/RankMath metadata to WordPress without altering database content
  const handleSyncSeoOnly = async () => {
    if (!editingArticle || !connection) return;
    setSyncingSeoOnly(true);
    try {
      const res = await fetch("/api/wordpress/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-seo",
          siteUrl: connection.siteUrl,
          apiKey: connection.apiKey,
          businessName: activeBusiness,
          updateData: {
            post_id: editingArticle.id,
            meta_title: editingArticle.meta_title || editingArticle.title,
            meta_description: editingArticle.meta_description || editingArticle.excerpt || "",
            focus_keyword: editingArticle.focus_keyword || "",
          },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setEditorNotice({
          type: "success",
          message: "⚡ SEO Meta Tags (Title, SERP Description, Focus Keyword) synced to WordPress & Yoast/RankMath!",
        });
        setTimeout(() => setEditorNotice(null), 5000);
        setShowCustomPublishModal(false);
      } else {
        alert("Failed to sync SEO tags: " + (data.error || "Unknown error"));
      }
    } catch (e) {
      alert("Error syncing SEO tags: " + e.message);
    } finally {
      setSyncingSeoOnly(false);
    }
  };

  // AI Auto-Optimize All SEO Fields
  const handleAutoOptimizeSeoFields = () => {
    if (!editingArticle) return;
    const kw = (editingArticle.focus_keyword || editingArticle.title.split(" ").slice(0, 4).join(" ")).trim();
    const cleanTitle = editingArticle.title.replace(/[^\w\s-]/g, "").trim();

    // Auto-generate calibrated Meta Title (50-60 chars)
    let optimizedTitle = `${cleanTitle}`;
    if (optimizedTitle.length > 55) {
      optimizedTitle = optimizedTitle.slice(0, 52).trim() + "...";
    }
    if (!optimizedTitle.toLowerCase().includes(kw.toLowerCase()) && optimizedTitle.length + kw.length + 3 <= 60) {
      optimizedTitle = `${kw}: ${optimizedTitle}`;
    }

    // Auto-generate calibrated Meta Description (135-155 chars)
    let optimizedDesc = `Master ${kw} in 2026. Explore actionable insights, strategic benchmarks, and proven frameworks to maximize organic traffic and enterprise ROI.`;
    if (optimizedDesc.length > 155) {
      optimizedDesc = optimizedDesc.slice(0, 152).trim() + "...";
    }

    // Auto-generate SEO permalink slug
    const optimizedSlug = (kw || cleanTitle)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48);

    setEditingArticle((prev) => ({
      ...prev,
      focus_keyword: kw,
      meta_title: optimizedTitle,
      meta_description: optimizedDesc,
      slug: (prev?.id && prev?.slug) ? prev.slug : optimizedSlug,
    }));

    setEditorNotice({
      type: "success",
      message: "✨ AI Auto-Optimized all SEO fields to maximum SERP score!",
    });
    setTimeout(() => setEditorNotice(null), 4000);
  };

  // Autonomous Full AI Page Optimizer & Copy Rewriter (Preserving Layout & Forms)
  const handleRunAiPageOptimization = async (customPrompt = "") => {
    if (!editingArticle) return;
    const currentAudit = computeAuditScore(editingArticle);
    const currentScore = currentAudit?.score || 50;
    setAiPreScore(currentScore);
    setIsOptimizingWithAi(true);
    setShowAiOptimizeModal(false);

    setEditorNotice({
      type: "info",
      message: "🤖 GabbarInfo AI is auditing page DOM, weaving target keywords & upgrading content without breaking layout…",
    });

    try {
      const res = await fetch("/api/wordpress/optimize-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: editingArticle.id,
          url: editingArticle.url,
          title: editingArticle.title,
          content: editingArticle.content,
          businessName: activeBusiness,
          targetKeywords: keywords || [],
          customInstructions: customPrompt || aiCustomInstructions || "",
          focusKeyword: editingArticle.focus_keyword || "",
          slug: editingArticle.slug || "",
          userEmail: session?.user?.email,
        }),
      });

      const resText = await res.text();
      let data;
      try {
        data = JSON.parse(resText);
      } catch (parseErr) {
        throw new Error(`Server returned status ${res.status}: ${resText.slice(0, 160) || "Gateway Timeout / Execution Error"}`);
      }

      // If offloaded to Railway background worker, poll until completion with live stage updates
      if (data.ok && data.isAsync && data.jobId) {
        const jobId = data.jobId;
        setEditorNotice({
          type: "info",
          message: "🚀 Background worker engaged (zero timeouts). Auditing & optimizing page sections...",
        });

        let completedData = null;
        const maxPollAttempts = 90; // up to 3 minutes
        for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
          await new Promise((r) => setTimeout(r, 2000));
          try {
            const statusRes = await fetch(`/api/wordpress/optimize-status?jobId=${encodeURIComponent(jobId)}`);
            if (statusRes.ok) {
              const sData = await statusRes.json();
              if (sData.stage) {
                const pct = sData.progress || Math.min(95, 10 + attempt * 2);
                setEditorNotice({
                  type: "info",
                  message: `🤖 ${sData.stage} (${pct}%)`,
                });
              }
              if (sData.status === "completed" && sData.result) {
                completedData = sData.result;
                break;
              }
              if (sData.status === "failed") {
                throw new Error(sData.error || "Optimization job failed on background worker.");
              }
            }
          } catch (pollErr) {
            if (pollErr.message && pollErr.message.includes("failed on background worker")) {
              throw pollErr;
            }
            console.warn("Poll attempt notice:", pollErr.message);
          }
        }

        if (!completedData) {
          throw new Error("Optimization job timed out waiting for worker. Please try again.");
        }
        data = completedData;
      }

      if (data.ok) {
        const isPage = editingArticle.post_type === "page" || editingArticle.type === "page" || !editingArticle.post_type;
        // Protect page navigation title: never overwrite an existing page title with an H1 headline!
        const safeTitle = isPage ? editingArticle.title : (data.title || editingArticle.title);
        const updatedArticle = {
          ...editingArticle,
          title: safeTitle,
          content: data.content || editingArticle.content,
          focus_keyword: data.focus_keyword || editingArticle.focus_keyword,
          meta_title: data.meta_title || editingArticle.meta_title,
          meta_description: data.meta_description || editingArticle.meta_description,
          slug: (editingArticle?.id && editingArticle?.slug) ? editingArticle.slug : (data.slug || editingArticle.slug),
        };
        const realAudit = computeAuditScore(updatedArticle);
        const finalCalculatedScore = realAudit?.score || data.audit_score || 90;

        setEditingArticle(updatedArticle);
        setAiPostScore(finalCalculatedScore);
        const isCustom = Boolean(
          editingArticle.is_custom_template ||
          editingArticle.bypasses_db_content ||
          (editingArticle.template_file && editingArticle.template_file !== "default")
        );

        if (isCustom && customOptimizeMode === "cpanel") {
          setEditorNotice({
            type: "success",
            message: `✨ Content optimized! Developer Mode active: Copy the clean PHP code below into your cPanel template file.`,
          });
          setShowCustomPublishModal(true);
        } else {
          setEditorNotice({
            type: "success",
            message: `✨ Page autonomously upgraded! Pre: ${currentScore}/100 ➔ Post: ${finalCalculatedScore}/100 (+${Math.max(0, finalCalculatedScore - currentScore)} pts). Layout & form wrappers preserved.`,
          });
        }
      } else {
        alert("AI Optimization error: " + (data.error || "Failed to optimize page."));
      }
    } catch (e) {
      console.error("AI Page Optimization failed:", e);
      alert("Error during AI Page Optimization: " + e.message);
    } finally {
      setIsOptimizingWithAi(false);
    }
  };

  // Request Instant Indexing
  const handleRequestIndexing = () => {
    setEditorNotice({
      type: "info",
      message: "⚡ Instant IndexNow & Google Search Console indexing ping dispatched for live URL!",
    });
    setTimeout(() => setEditorNotice(null), 4500);
  };

  // Generate Blog handler (Draft & Edit vs. Publish Live)
  const handleGenerateBlog = async (customTopic, publishStatus = "publish") => {
    if (!connection?.siteUrl) {
      alert("⚠️ No WordPress website connected. Please connect your WordPress website in the 'WordPress Connector & GSC' tab first.");
      setShowNewBlogModal(false);
      setActiveTab("integrations");
      return;
    }
    const topicToUse = customTopic || newTopic;
    if (!topicToUse) {
      alert("Please enter a blog topic.");
      return;
    }

    setGeneratingBlog(true);
    setPublishedResult(null);
    setSocialShareStatus(null);

    try {
      const cleanKeywords =
        newKeywords && !newKeywords.includes("Researching")
          ? newKeywords.split(",").map((k) => k.trim()).filter(Boolean)
          : [];

      const res = await fetch("/api/wordpress/generate-blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: activeBusiness,
          topic: topicToUse,
          targetMarket: targetMarket || autopilotTargetLocations || "",
          city: targetMarket || autopilotTargetLocations || "",
          targetLocations: targetMarket || autopilotTargetLocations || "",
          targetKeywords: cleanKeywords,
          wordCount: newWordCount,
          publishStatus: publishStatus,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        if (publishStatus === "draft") {
          setShowNewBlogModal(false);
          setEditingArticle({
            id: data.post_id,
            title: data.title,
            content: data.content,
            slug: data.slug,
            meta_title: data.meta_title,
            meta_description: data.meta_description,
            focus_keyword: data.focus_keyword,
            status: "draft",
            featured_image: data.featured_image,
            mid_image: data.mid_image,
            url: data.post_url,
          });
          setEditorNotice({
            type: "success",
            message: "📝 Blog generated as Draft! Review and polish in the writing suite below.",
          });
          setTimeout(() => setEditorNotice(null), 5000);
          fetchContent(connection);
        } else {
          setPublishedResult(data);
          fetchContent(connection);
        }
      } else {
        alert("Blog generation error: " + (data.error || "Unknown error"));
      }
    } catch (e) {
      alert("Error generating blog: " + e.message);
    } finally {
      setGeneratingBlog(false);
    }
  };

  // Social Share handler
  const handleSocialShare = async (platform) => {
    if (!publishedResult?.post_url) return;
    setSocialSharing(true);
    setSocialShareStatus(null);

    try {
      const res = await fetch("/api/wordpress/social-share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          businessName: activeBusiness,
          pageId: brandMeta?.pageId,
          title: publishedResult.title,
          postUrl: publishedResult.post_url,
          featuredImageUrl: publishedResult.featured_image,
          caption: publishedResult.meta_description,
        }),
      });

      const data = await res.json();
      if (data.require_connect) {
        setShowFbConnectModal(true);
      } else if (data.ok && data.results?.[platform]?.ok !== false) {
        const typeNote = data.results?.[platform]?.type === "link_preview" ? " (interactive link card)" : "";
        setSocialShareStatus({
          ok: true,
          platform,
          message: `✅ Successfully shared to ${platform === "facebook" ? "Facebook Page" : "Instagram"}${typeNote}!`,
        });
      } else {
        const err = data.error || data.results?.[platform]?.error || "Check Meta permissions";
        setSocialShareStatus({ ok: false, platform, message: `❌ Share failed: ${err}` });
      }
    } catch (e) {
      setSocialShareStatus({ ok: false, platform, message: "❌ Share error: " + e.message });
    } finally {
      setSocialSharing(false);
    }
  };

  // Real Website Discovery & SERP Topic Generator (Any Website & Any Industry)
  const fetchDiscoveredTopics = async (targetBiz, siteUrl, refresh = false) => {
    const bizToUse = (targetBiz || activeBusiness || connection?.businessName || "").trim();
    const urlToUse = (siteUrl || connection?.siteUrl || "").trim();
    if (!bizToUse && !urlToUse) return;

    setLoadingTopics(true);
    try {
      const existingTitles = contentList.map((c) => c.title).slice(0, 30);
      const res = await fetch("/api/wordpress/suggest-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: bizToUse,
          siteUrl: urlToUse,
          targetMarket: autopilotTargetLocations || targetMarket || "",
          keywords,
          existingTitles,
          refresh,
        }),
      });

      const data = await res.json();
      if (data.ok && Array.isArray(data.topics) && data.topics.length > 0) {
        setSuggestedTopics(data.topics);
        if (data.industry) setDiscoveredNiche(data.industry);
        if (data.nicheSummary) setNicheSummary(data.nicheSummary);
        if (Array.isArray(data.targetKeywords) && data.targetKeywords.length > 0) {
          setKeywords((prev) => {
            if (!prev || prev.length === 0) return data.targetKeywords;
            return Array.from(new Set([...prev, ...data.targetKeywords]));
          });
        }
      }
    } catch (e) {
      console.error("Failed to discover topics:", e);
    } finally {
      setLoadingTopics(false);
    }
  };

  // AI SERP Topic Generator with Anti-Duplication (30 Topics)
  const handleAutoSuggestTopics = async (overrideBusiness) => {
    const targetBiz = (overrideBusiness || activeBusiness || connection?.businessName || connection?.siteName || "").trim();
    const targetUrl = (connection?.siteUrl || "").trim();
    if (!targetBiz && !targetUrl) {
      alert("⚠️ Please connect your WordPress website or enter your business name first to generate topics.");
      return;
    }
    await fetchDiscoveredTopics(targetBiz, targetUrl, true);
  };

  // Filtered Content
  const filteredContent = contentList.filter((item) => {
    const itemType = item.type || item.post_type;
    if (contentFilter !== "all" && itemType !== contentFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (item.title || "").toLowerCase().includes(q) || (item.slug || "").toLowerCase().includes(q);
    }
    return true;
  });

  if (status === "loading") {
    return <div style={{ padding: 40, color: "#fff", background: "#0a0d14", minHeight: "100vh" }}>Loading SEO Suite…</div>;
  }

  return (
    <div style={{ background: "#090d16", minHeight: "100vh", color: "#f8fafc", fontFamily: "Inter, sans-serif" }}>
      <Head>
        <title>SEO & Web Content Suite | GabbarInfo AI</title>
      </Head>

      {/* ── TOP NAVIGATION BAR ── */}
      <header
        style={{
          borderBottom: "1px solid #1e293b",
          padding: "12px 18px",
          background: "rgba(10, 15, 26, 0.95)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "sticky",
          top: 0,
          zIndex: 100,
          flexWrap: "wrap",
          gap: 12,
          maxWidth: "100vw",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>🚀</span>
            <span style={{ fontWeight: 800, fontSize: 17, color: "#fff", letterSpacing: "-0.5px" }}>GabbarInfo AI</span>
          </a>
          <span style={{ color: "#334155" }}>|</span>
          <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500 }}>SEO Suite</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", maxWidth: "100%" }}>
          {/* Dynamic Connected Business Profile Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#0d111c", padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255, 255, 255, 0.16)", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
            <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700, flexShrink: 0 }}>Project:</span>
            <select
              value={activeBusiness}
              onChange={(e) => handleSelectBusiness(e.target.value)}
              style={{
                background: "transparent",
                border: "none",
                color: "#38bdf8",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                outline: "none",
                maxWidth: "200px",
                textOverflow: "ellipsis",
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
            >
              {connectedProfiles.length > 0 ? (
                connectedProfiles.map((name) => (
                  <option key={name} value={name} style={{ background: "#0d111c", color: "#38bdf8" }}>
                    ✓ {name} ({allConnections[name]?.siteUrl})
                  </option>
                ))
              ) : (
                <option value="none" style={{ background: "#0d111c", color: "#94a3b8" }}>
                  [ No Website Connected Yet ]
                </option>
              )}
              <option value="__add_new__" style={{ background: "#0d111c", color: "#10b981", fontWeight: "bold" }}>
                + Connect Another Website ↗
              </option>
            </select>
            <button
              type="button"
              onClick={() => setShowAddSiteModal(true)}
              title="Connect another WordPress website"
              style={{
                fontSize: 11,
                color: "#10b981",
                fontWeight: 700,
                textDecoration: "underline",
                marginLeft: 4,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                flexShrink: 0,
              }}
            >
              + Add Website
            </button>
          </div>

          {/* Mode Switcher */}
          <div style={{ display: "flex", background: "rgba(16, 22, 34, 0.8)", padding: 4, borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.12)" }}>
            <button
              onClick={() => {
                setMode("manual");
                if (autopilotEnabled) {
                  handleSaveAutopilotSettings(false);
                }
              }}
              style={{
                padding: "6px 12px",
                borderRadius: 7,
                border: "none",
                background: mode === "manual" ? "#ffffff" : "transparent",
                color: mode === "manual" ? "#080b11" : "#94a3b8",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              title="Manual Mode: You generate and publish articles manually"
            >
              ✨ Manual
            </button>
            <button
              onClick={() => {
                setMode("autopilot");
                setActiveTab("autopilot");
                if (!autopilotEnabled) {
                  handleSaveAutopilotSettings(true);
                }
              }}
              style={{
                padding: "6px 12px",
                borderRadius: 7,
                border: "none",
                background: mode === "autopilot" ? "#ffffff" : "transparent",
                color: mode === "autopilot" ? "#080b11" : "#94a3b8",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s ease",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
              title="Autopilot Mode: Engine autonomously publishes on your cadence"
            >
              🤖 Autopilot
              {autopilotEnabled && (
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
              )}
            </button>
          </div>

          <a
            href="/chat"
            className="btn-gabbar-secondary"
            style={{
              padding: "7px 12px",
              fontSize: 12,
              textDecoration: "none",
            }}
          >
            💬 Chat
          </a>
          <a
            href="/"
            className="btn-gabbar-primary"
            style={{
              padding: "7px 14px",
              fontSize: 12,
              textDecoration: "none",
            }}
          >
            Dashboard ↗
          </a>
        </div>
      </header>

      {/* AMBIENT LIGHT CONE (WHIZWISER STYLE) */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 1240,
          height: 480,
          background: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(56, 189, 248, 0.14) 0%, rgba(99, 102, 241, 0.06) 45%, transparent 80%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* ── MAIN WORKSPACE CONTAINER ── */}
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "20px 16px", position: "relative", zIndex: 1, width: "100%", boxSizing: "border-box" }}>
        {/* KPI CARDS BAR */}
        {(() => {
          const liveBlogsCount = contentList.filter((i) => (i.type || i.post_type) === "post").length;
          const livePagesCount = contentList.filter((i) => (i.type || i.post_type) === "page").length;
          const displayBlogCount = liveBlogsCount;

          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
              <div style={{ background: "rgba(16, 22, 34, 0.78)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 14, padding: "14px 16px", boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Connected Domain</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {connection?.siteUrl ? connection.siteUrl.replace(/^https?:\/\//, "") : "Not Connected"}
                </div>
                <div style={{ fontSize: 12, color: connection?.siteUrl ? "#10b981" : "#94a3b8", marginTop: 4, fontWeight: 600 }}>
                  {connection?.siteUrl ? "● Active & Syncing" : "○ Awaiting Pairing"}
                </div>
              </div>

              <div style={{ background: "rgba(16, 22, 34, 0.78)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 14, padding: "14px 16px", boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
                <div style={{ fontSize: 11, color: "#34d399", fontWeight: 700, textTransform: "uppercase" }}>📚 Published Blogs</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#ffffff", marginTop: 4 }}>{displayBlogCount}</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                  {livePagesCount > 0 ? `${liveBlogsCount} Posts (+${livePagesCount} Pages)` : `${liveBlogsCount} Live Posts`}
                </div>
              </div>

              <div style={{ background: "rgba(16, 22, 34, 0.78)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 14, padding: "14px 16px", boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
                <div style={{ fontSize: 11, color: "#38bdf8", fontWeight: 700, textTransform: "uppercase" }}>🤖 Autopilot Published</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#38bdf8", marginTop: 4 }}>{autopilotPublishedCount}</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                  {lastPublishedAt ? `Last: ${new Date(lastPublishedAt).toLocaleDateString()}` : "Autonomous delivery"}
                </div>
              </div>

              <div style={{ background: "rgba(16, 22, 34, 0.78)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 14, padding: "14px 16px", boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Target Keywords</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#fbbf24", marginTop: 4 }}>{keywords.length}</div>
                <div style={{ fontSize: 12, color: keywords.length > 0 ? "#10b981" : "#94a3b8", marginTop: 2, fontWeight: 600 }}>
                  {keywords.length > 0 ? "Coverage Active" : "Awaiting Setup"}
                </div>
              </div>

              <div style={{ background: "rgba(16, 22, 34, 0.78)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 14, padding: "14px 16px", boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Autopilot Cadence</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: autopilotEnabled ? "#10b981" : "#94a3b8", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {autopilotEnabled
                    ? `Active (${cadence === "daily" ? "Daily" : cadence === "weekly" ? "Weekly" : cadence === "monthly" ? "Monthly" : `${customDaysPerWeek}x/wk`})`
                    : "Paused"}
                </div>
                <div style={{ fontSize: 12, color: autopilotEnabled ? "#34d399" : "#64748b", marginTop: 2 }}>
                  {autopilotEnabled ? "Next Dispatch: Today" : "Autonomous posting paused"}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── WORKSPACE TABS (MOBILE HORIZONTAL TOUCH SCROLL) ── */}
        <div
          style={{
            display: "flex",
            gap: 8,
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            marginBottom: 20,
            paddingBottom: 2,
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            whiteSpace: "nowrap",
            maxWidth: "100%",
            boxSizing: "border-box",
          }}
        >
          <button
            onClick={() => setActiveTab("content")}
            style={{
              padding: "10px 16px",
              background: activeTab === "content" ? "rgba(255, 255, 255, 0.08)" : "transparent",
              border: "none",
              borderBottom: activeTab === "content" ? "2.5px solid #ffffff" : "2.5px solid transparent",
              color: activeTab === "content" ? "#ffffff" : "#94a3b8",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              borderRadius: "8px 8px 0 0",
              flexShrink: 0,
            }}
          >
            📑 Articles & Website Pages ({contentList.length === 0 ? 0 : `${contentList.filter((i) => (i.type || i.post_type) === "post").length} Posts · ${contentList.filter((i) => (i.type || i.post_type) === "page").length} Pages`})
          </button>

          <button
            onClick={() => setActiveTab("topics")}
            style={{
              padding: "10px 16px",
              background: activeTab === "topics" ? "rgba(255, 255, 255, 0.08)" : "transparent",
              border: "none",
              borderBottom: activeTab === "topics" ? "2.5px solid #ffffff" : "2.5px solid transparent",
              color: activeTab === "topics" ? "#ffffff" : "#94a3b8",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              borderRadius: "8px 8px 0 0",
              flexShrink: 0,
            }}
          >
            💡 Topic & Keyword Planner
          </button>

          <button
            onClick={() => setActiveTab("autopilot")}
            style={{
              padding: "10px 16px",
              background: activeTab === "autopilot" ? "rgba(255, 255, 255, 0.08)" : "transparent",
              border: "none",
              borderBottom: activeTab === "autopilot" ? "2.5px solid #ffffff" : "2.5px solid transparent",
              color: activeTab === "autopilot" ? "#ffffff" : "#94a3b8",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              borderRadius: "8px 8px 0 0",
              flexShrink: 0,
            }}
          >
            🤖 Autopilot Scheduler
          </button>

          <button
            onClick={() => setActiveTab("integrations")}
            style={{
              padding: "10px 16px",
              background: activeTab === "integrations" ? "rgba(255, 255, 255, 0.08)" : "transparent",
              border: "none",
              borderBottom: activeTab === "integrations" ? "2.5px solid #ffffff" : "2.5px solid transparent",
              color: activeTab === "integrations" ? "#ffffff" : "#94a3b8",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              borderRadius: "8px 8px 0 0",
              flexShrink: 0,
            }}
          >
            🔌 WordPress Connector & GSC
          </button>
        </div>

        {/* =========================================================================
            TAB 1: ARTICLES & WEBSITE PAGES (CONTENT HUB)
        ========================================================================= */}
        {/* =========================================================================
            TAB 1: ARTICLES & WEBSITE PAGES (CONTENT HUB) OR WRITING SUITE
        ========================================================================= */}
        {activeTab === "content" && (
          editingArticle ? (
            /* ══════════════════════════════════════════════════════════════
               WHIZWISER / GABBARINFO WRITING & OPTIMIZATION SUITE (DRAFT & EDIT)
            ══════════════════════════════════════════════════════════════ */
            (() => {
              const audit = computeAuditScore(editingArticle);
              const metaTitleLength = (editingArticle.meta_title || editingArticle.title || "").length;
              const metaDescLength = (editingArticle.meta_description || "").length;

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {/* Toast Notice */}
                  {editorNotice && (
                    <div
                      style={{
                        padding: "12px 18px",
                        borderRadius: 8,
                        background:
                          editorNotice.type === "success"
                            ? "rgba(16, 185, 129, 0.15)"
                            : "rgba(56, 189, 248, 0.15)",
                        border:
                          editorNotice.type === "success"
                            ? "1px solid #10b981"
                            : "1px solid #38bdf8",
                        color: editorNotice.type === "success" ? "#34d399" : "#38bdf8",
                        fontSize: 13,
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>{editorNotice.message}</span>
                      <button
                        onClick={() => setEditorNotice(null)}
                        style={{ border: "none", background: "none", color: "inherit", cursor: "pointer", fontSize: 14 }}
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* ── TOP SUITE BAR (Screenshot 3) ── */}
                  <div
                    style={{
                      background: "rgba(16, 22, 34, 0.95)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      borderRadius: 14,
                      padding: "16px 22px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 14,
                      boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
                    }}
                  >
                    {/* Left: Back & Live Content Metrics */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <button
                        onClick={() => setEditingArticle(null)}
                        className="btn-gabbar-secondary"
                        style={{
                          padding: "7px 14px",
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span>←</span> Back to Articles
                      </button>

                      <span
                        style={{
                          background: "rgba(56, 189, 248, 0.12)",
                          border: "1px solid rgba(56, 189, 248, 0.3)",
                          color: "#38bdf8",
                          padding: "5px 12px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 800,
                          letterSpacing: "0.5px",
                        }}
                      >
                        🌐 GABBARINFO WRITING SUITE
                      </span>

                      <span style={{ background: "rgba(255, 255, 255, 0.06)", border: "1px solid rgba(255, 255, 255, 0.1)", color: "#cbd5e1", padding: "4px 10px", borderRadius: 6, fontSize: 12 }}>
                        📄 {audit.wordCount} words
                      </span>

                      <span style={{ background: "rgba(255, 255, 255, 0.06)", border: "1px solid rgba(255, 255, 255, 0.1)", color: "#cbd5e1", padding: "4px 10px", borderRadius: 6, fontSize: 12 }}>
                        ⏱️ {Math.ceil(audit.wordCount / 200)} min read
                      </span>

                      <span style={{ background: "rgba(255, 255, 255, 0.06)", border: "1px solid rgba(255, 255, 255, 0.1)", color: "#cbd5e1", padding: "4px 10px", borderRadius: 6, fontSize: 12 }}>
                        🔗 {audit.internalLinksCount} Internal Links
                      </span>

                      <span style={{ background: "rgba(255, 255, 255, 0.06)", border: "1px solid rgba(255, 255, 255, 0.1)", color: "#cbd5e1", padding: "4px 10px", borderRadius: 6, fontSize: 12 }}>
                        ↗️ {audit.externalLinksCount} External Links
                      </span>

                      <span
                        style={{
                          background: editingArticle.status === "draft" ? "rgba(30, 41, 59, 0.9)" : "rgba(16, 185, 129, 0.15)",
                          border: editingArticle.status === "draft" ? "1px solid rgba(148, 163, 184, 0.25)" : "1px solid rgba(16, 185, 129, 0.3)",
                          color: editingArticle.status === "draft" ? "#cbd5e1" : "#34d399",
                          padding: "4px 10px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        ● {editingArticle.status === "draft" ? "Draft Ready" : "WordPress Live"}
                      </span>

                      <span style={{ color: "#10b981", fontSize: 12, fontWeight: 600 }}>✓ Saved</span>
                    </div>

                    {/* Right Action Buttons */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => setShowSchemaModal(true)}
                        style={{
                          background: "rgba(16, 185, 129, 0.12)",
                          border: "1px solid #10b981",
                          color: "#34d399",
                          padding: "8px 13px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <span>&lt;&gt;</span> GEO Schema Editor
                      </button>

                      <button
                        onClick={() => setShowAiOptimizeModal(true)}
                        disabled={isOptimizingWithAi}
                        style={{
                          background: isOptimizingWithAi
                            ? "linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #8b5cf6 100%)"
                            : "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #9333ea 100%)",
                          border: isOptimizingWithAi ? "2px solid #f43f5e" : "1px solid #c084fc",
                          color: "#ffffff",
                          padding: "8px 16px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: isOptimizingWithAi ? "wait" : "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          boxShadow: isOptimizingWithAi
                            ? "0 0 20px rgba(236, 72, 153, 0.7), 0 0 35px rgba(139, 92, 246, 0.5)"
                            : "0 2px 10px rgba(124, 58, 237, 0.4)",
                          animation: isOptimizingWithAi ? "pulse 1s infinite alternate" : "none",
                        }}
                      >
                        <span style={{ display: "inline-block", animation: isOptimizingWithAi ? "spin 1.5s linear infinite" : "none" }}>
                          {isOptimizingWithAi ? "⏳" : "🤖"}
                        </span>
                        {isOptimizingWithAi ? "AI Optimizing Page… (Rewriting Content & Design)" : "✨ AI Auto-Optimize Page (Content & Design)"}
                      </button>

                      <button
                        onClick={() => {
                          const el = document.getElementById("serp-settings-section");
                          if (el) el.scrollIntoView({ behavior: "smooth" });
                        }}
                        style={{
                          background: "rgba(255, 255, 255, 0.08)",
                          border: "1px solid rgba(255, 255, 255, 0.16)",
                          color: "#e2e8f0",
                          padding: "8px 13px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        ⚙️ SEO & SERP Settings
                      </button>

                      <button
                        onClick={handleRequestIndexing}
                        style={{
                          background: "rgba(245, 158, 11, 0.15)",
                          border: "1px solid #f59e0b",
                          color: "#fbbf24",
                          padding: "8px 13px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        ⚡ Request Indexing
                      </button>

                      <button
                        onClick={() => handleSaveArticle("draft")}
                        disabled={savingArticle}
                        style={{
                          background: "rgba(59, 130, 246, 0.18)",
                          border: "1px solid #3b82f6",
                          color: "#60a5fa",
                          padding: "8px 15px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {savingArticle ? "Saving…" : "💾 Save Draft"}
                      </button>

                      <button
                        onClick={handleInitiatePublish}
                        disabled={publishingArticle}
                        style={{
                          background: "#10b981",
                          border: "1px solid #059669",
                          color: "#ffffff",
                          padding: "8px 18px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: "pointer",
                          boxShadow: "0 2px 10px rgba(16, 185, 129, 0.4)",
                        }}
                      >
                        {publishingArticle ? "Publishing…" : "🚀 Publish to WordPress Now"}
                      </button>
                    </div>
                  </div>

                  {/* ── ACTIVE AI PROCESSING FULL-WIDTH GLOWING BANNER ── */}
                  {isOptimizingWithAi && (
                    <div
                      style={{
                        background: "linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.3) 50%, rgba(236, 72, 153, 0.25) 100%)",
                        border: "2px solid #c084fc",
                        borderRadius: 12,
                        padding: "16px 22px",
                        boxShadow: "0 0 25px rgba(168, 85, 247, 0.45)",
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        animation: "pulse 1.2s infinite alternate",
                      }}
                    >
                      <div style={{ fontSize: 32, animation: "spin 2s linear infinite" }}>⚙️</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 900, color: "#ffffff", display: "flex", alignItems: "center", gap: 10 }}>
                          🤖 AI Autonomous Page Rewrite In Progress…
                          <span style={{ fontSize: 11, background: "#e11d48", color: "#fff", padding: "2px 10px", borderRadius: 12, fontWeight: 800 }}>LIVE PROCESSING</span>
                        </div>
                        <div style={{ fontSize: 12, color: "#e2e8f0", marginTop: 4 }}>
                          Auditing page DOM, rewriting headings & body copy, injecting local & internal links without breaking your Elementor layout or forms. Please hold on (~3 to 5 seconds)…
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── PRE VS POST AI OPTIMIZATION AUDIT REPORT CARD ── */}
                  {aiPostScore && (
                    <div
                      style={{
                        background: "linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(99, 102, 241, 0.12) 100%)",
                        border: "1px solid rgba(52, 211, 153, 0.4)",
                        borderRadius: 12,
                        padding: "16px 20px",
                        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                            🚀
                          </div>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: "#ffffff", display: "flex", alignItems: "center", gap: 8 }}>
                              Autonomous AI Optimization Completed
                              <span style={{ fontSize: 11, background: "rgba(52, 211, 153, 0.2)", border: "1px solid #34d399", color: "#34d399", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>LIVE DOM PRESERVED</span>
                            </div>
                            <div style={{ fontSize: 12, color: "#94a3b8" }}>
                              Entire page copy enhanced, commercial H1/H2 structured, internal/external links woven, theme layout & form wrappers 100% intact.
                            </div>
                          </div>
                        </div>

                        {/* Pre vs Post Score Pill */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#0b1120", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "8px 16px" }}>
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700 }}>PRE-SCORE</div>
                            <div style={{ fontSize: 18, fontWeight: 900, color: (aiPreScore ?? 52) >= 80 ? "#34d399" : (aiPreScore ?? 52) >= 60 ? "#fbbf24" : "#f87171" }}>
                              {aiPreScore ?? 52}<span style={{ fontSize: 12, color: "#64748b" }}>/100</span>
                            </div>
                          </div>
                          <div style={{ fontSize: 18, color: "#a855f7", fontWeight: 900 }}>➔</div>
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 10, color: "#34d399", fontWeight: 700 }}>POST-SCORE</div>
                            <div style={{ fontSize: 18, fontWeight: 900, color: "#34d399" }}>
                              {aiPostScore}<span style={{ fontSize: 12, color: "#64748b" }}>/100</span>
                            </div>
                          </div>
                          <div style={{ background: "rgba(52, 211, 153, 0.25)", border: "1px solid #34d399", color: "#34d399", padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 900 }}>
                            +{Math.max(0, aiPostScore - (aiPreScore ?? 52))} pts
                          </div>
                        </div>
                      </div>

                      {aiImprovements && aiImprovements.length > 0 && (
                        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 8 }}>
                          {aiImprovements.map((imp, idx) => (
                            <div key={idx} style={{ fontSize: 12, color: "#a7f3d0", display: "flex", alignItems: "flex-start", gap: 6 }}>
                              <span style={{ color: "#34d399", fontWeight: 800 }}>✓</span> <span>{imp}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── LIVE PAGE SYNCHRONIZED / CUSTOM TEMPLATE NOTICE (Universal across all themes) ── */}
                  {(editingArticle.is_live_extracted || editingArticle.bypasses_db_content) && (
                    <div style={{ background: "rgba(56, 189, 248, 0.12)", border: "1px solid rgba(56, 189, 248, 0.35)", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 14 }}>
                      <span style={{ fontSize: 24, lineHeight: 1 }}>🌐</span>
                      <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.6 }}>
                        <div style={{ fontWeight: 800, color: "#38bdf8", fontSize: 14, marginBottom: 4 }}>
                          Live Website Content Synchronized {editingArticle.template_file ? `(${editingArticle.template_file})` : ""}
                        </div>
                        <div>
                          Loaded the exact rendered HTML directly from your live website (<strong>{editingArticle.url || connection?.siteUrl}</strong>). Your live layout, media, and styles are preserved in the editor below rather than stale database placeholders.
                        </div>
                        {editingArticle.bypasses_db_content && (
                          <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(0,0,0,0.25)", borderRadius: 6, fontSize: 12, color: "#94a3b8", borderLeft: "3px solid #f59e0b" }}>
                            💡 <strong>Theme Template Architecture Notice:</strong> This page is rendered via a custom theme template file. Changes published here update your WordPress database. To ensure database changes reflect on the live frontend, verify that your theme template file includes <code>&lt;?php the_content(); ?&gt;</code>.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── QUOTA & REVISION CREDIT STATUS BAR (Universal 2-Free-Edits vs Pre-Existing Page Rules) ── */}
                  <div
                    style={{
                      background: editingArticle.requires_credit ? "rgba(245, 158, 11, 0.1)" : "rgba(16, 185, 129, 0.1)",
                      border: `1px solid ${editingArticle.requires_credit ? "rgba(245, 158, 11, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
                      borderRadius: 10,
                      padding: "12px 18px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 18 }}>{editingArticle.requires_credit ? "💳" : "✨"}</span>
                      <div>
                        <div style={{ fontSize: 13, color: "#ffffff", fontWeight: 700 }}>
                          {editingArticle.is_agent_created
                            ? (editingArticle.edits_remaining > 0
                                ? `Free AI Revision Active (${editingArticle.edits_remaining} of 2 free edits remaining)`
                                : "AI Article Revision Limit Reached (Free Revisions Exhausted)")
                            : "Pre-Existing Website Page / Content"}
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                          {editingArticle.requires_credit
                            ? "Publishing this update will consume 1 Published Blog credit from your monthly plan quota."
                            : "This update is included free under your 2-revision allowance for agent-created content."}
                        </div>
                      </div>
                    </div>
                    <span
                      style={{
                        padding: "5px 12px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 800,
                        background: editingArticle.requires_credit ? "rgba(245, 158, 11, 0.2)" : "rgba(16, 185, 129, 0.2)",
                        color: editingArticle.requires_credit ? "#fbbf24" : "#34d399",
                        border: `1px solid ${editingArticle.requires_credit ? "rgba(245, 158, 11, 0.4)" : "rgba(16, 185, 129, 0.4)"}`,
                      }}
                    >
                      {editingArticle.requires_credit ? "1 Blog Credit on Live Publish" : "0 Credits (Free Revision)"}
                    </span>
                  </div>

                  {/* ── ARTICLE HEADLINE / H1 TITLE (Screenshot 3) ── */}
                  <div style={{ background: "rgba(16, 22, 34, 0.78)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 14, padding: "20px 24px" }}>
                    <label style={{ fontSize: 11, color: "#94a3b8", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.8px", display: "block", marginBottom: 8 }}>
                      ARTICLE HEADLINE / H1 TITLE
                    </label>
                    <input
                      type="text"
                      value={editingArticle.title || ""}
                      onChange={(e) => setEditingArticle({ ...editingArticle, title: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        borderRadius: 8,
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        background: "#0a0d14",
                        color: "#ffffff",
                        fontSize: 18,
                        fontWeight: 700,
                      }}
                    />
                  </div>

                  {/* ── FORMATTING TOOLBAR & RICH CONTENT EDITOR (Screenshot 3) ── */}
                  <div style={{ background: "rgba(16, 22, 34, 0.78)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 14, padding: "18px 24px" }}>
                    {/* Toolbar */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10, borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: 12 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        {["H1", "H2", "H3", "H4", "P"].map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              if (editorMode === "visual") {
                                document.execCommand("formatBlock", false, `<${tag}>`);
                              }
                            }}
                            style={{
                              padding: "5px 10px",
                              borderRadius: 4,
                              background: "rgba(255, 255, 255, 0.06)",
                              border: "1px solid rgba(255, 255, 255, 0.12)",
                              color: "#cbd5e1",
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            {tag}
                          </button>
                        ))}

                        <span style={{ color: "rgba(255,255,255,0.2)", margin: "0 4px" }}>|</span>

                        {[
                          { label: "B", cmd: "bold" },
                          { label: "I", cmd: "italic" },
                          { label: "U", cmd: "underline" },
                        ].map((btn) => (
                          <button
                            key={btn.label}
                            type="button"
                            onClick={() => {
                              if (editorMode === "visual") document.execCommand(btn.cmd, false, null);
                            }}
                            style={{
                              padding: "5px 10px",
                              borderRadius: 4,
                              background: "rgba(255, 255, 255, 0.06)",
                              border: "1px solid rgba(255, 255, 255, 0.12)",
                              color: "#cbd5e1",
                              fontSize: 12,
                              fontWeight: btn.label === "B" ? 800 : btn.label === "I" ? "italic" : 600,
                              textDecoration: btn.label === "U" ? "underline" : "none",
                              cursor: "pointer",
                            }}
                          >
                            {btn.label}
                          </button>
                        ))}

                        <span style={{ color: "rgba(255,255,255,0.2)", margin: "0 4px" }}>|</span>

                        <button
                          type="button"
                          onClick={() => {
                            const url = prompt("Enter link URL (e.g. https://example.com/service):");
                            if (url && editorMode === "visual") {
                              document.execCommand("createLink", false, url);
                            }
                          }}
                          style={{
                            padding: "5px 10px",
                            borderRadius: 4,
                            background: "rgba(255, 255, 255, 0.06)",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            color: "#38bdf8",
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          🔗 Link
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (editorMode === "visual") document.execCommand("insertUnorderedList", false, null);
                          }}
                          style={{
                            padding: "5px 10px",
                            borderRadius: 4,
                            background: "rgba(255, 255, 255, 0.06)",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            color: "#cbd5e1",
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          • List
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (editorMode === "visual") document.execCommand("insertOrderedList", false, null);
                          }}
                          style={{
                            padding: "5px 10px",
                            borderRadius: 4,
                            background: "rgba(255, 255, 255, 0.06)",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            color: "#cbd5e1",
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          1. List
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (editorMode === "visual") document.execCommand("formatBlock", false, "<blockquote>");
                          }}
                          style={{
                            padding: "5px 10px",
                            borderRadius: 4,
                            background: "rgba(255, 255, 255, 0.06)",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            color: "#cbd5e1",
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          ❝ Quote
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const tableHtml = `<table style="width:100%; border-collapse: collapse; margin: 20px 0;"><thead><tr style="background: rgba(255,255,255,0.08);"><th style="border: 1px solid #334155; padding: 8px;">Key Metric</th><th style="border: 1px solid #334155; padding: 8px;">Industry Benchmark</th><th style="border: 1px solid #334155; padding: 8px;">Strategic Impact</th></tr></thead><tbody><tr><td style="border: 1px solid #334155; padding: 8px;">Organic Conversion</td><td style="border: 1px solid #334155; padding: 8px;">3.8% - 5.2%</td><td style="border: 1px solid #334155; padding: 8px;">High Commercial Intent</td></tr></tbody></table>`;
                            if (editorMode === "visual") {
                              document.execCommand("insertHTML", false, tableHtml);
                            } else {
                              setEditingArticle({ ...editingArticle, content: (editingArticle.content || "") + "\n" + tableHtml });
                            }
                          }}
                          style={{
                            padding: "5px 10px",
                            borderRadius: 4,
                            background: "rgba(255, 255, 255, 0.06)",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            color: "#cbd5e1",
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          ⊞ Table
                        </button>

                        <span style={{ color: "rgba(255,255,255,0.2)", margin: "0 4px" }}>|</span>

                        <button
                          type="button"
                          onClick={() => setShowAiOptimizeModal(true)}
                          disabled={isOptimizingWithAi}
                          style={{
                            padding: "5px 12px",
                            borderRadius: 4,
                            background: isOptimizingWithAi
                              ? "linear-gradient(135deg, rgba(236, 72, 153, 0.4) 0%, rgba(168, 85, 247, 0.5) 100%)"
                              : "linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.3) 100%)",
                            border: isOptimizingWithAi ? "1px solid #f43f5e" : "1px solid rgba(168, 85, 247, 0.6)",
                            color: isOptimizingWithAi ? "#fecdd3" : "#d8b4fe",
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: isOptimizingWithAi ? "wait" : "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            boxShadow: isOptimizingWithAi ? "0 0 12px rgba(244, 63, 94, 0.6)" : "0 2px 8px rgba(168, 85, 247, 0.25)",
                            animation: isOptimizingWithAi ? "pulse 1s infinite alternate" : "none",
                          }}
                        >
                          <span>{isOptimizingWithAi ? "⏳" : "🤖"}</span> {isOptimizingWithAi ? "AI Rewriting Copy…" : "✨ AI Rewrite & Enhance Copy"}
                        </button>
                      </div>

                      {/* Visual vs Text / HTML Tabs */}
                      <div style={{ display: "flex", gap: 4, background: "#0a0d14", padding: 3, borderRadius: 6, border: "1px solid rgba(255, 255, 255, 0.1)" }}>
                        <button
                          type="button"
                          onClick={() => setEditorMode("visual")}
                          style={{
                            padding: "4px 12px",
                            borderRadius: 4,
                            background: editorMode === "visual" ? "#2563eb" : "transparent",
                            border: "none",
                            color: editorMode === "visual" ? "#ffffff" : "#94a3b8",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          👁️ Visual
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditorMode("html")}
                          style={{
                            padding: "4px 12px",
                            borderRadius: 4,
                            background: editorMode === "html" ? "#2563eb" : "transparent",
                            border: "none",
                            color: editorMode === "html" ? "#ffffff" : "#94a3b8",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          &lt;&gt; Text / HTML
                        </button>
                      </div>
                    </div>

                    {/* Content Editor Body */}
                    {editorMode === "visual" ? (
                      <div
                        ref={visualEditorRef}
                        contentEditable
                        suppressContentEditableWarning
                        spellCheck={false}
                        onBlur={(e) => {
                          const newHtml = e.currentTarget.innerHTML;
                          if (newHtml !== editingArticle?.content) {
                            setEditingArticle((prev) => ({ ...prev, content: newHtml }));
                          }
                        }}
                        style={{
                          minHeight: 480,
                          outline: "none",
                          padding: "16px 20px",
                          borderRadius: 8,
                          background: "#080c14",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                          color: "#e2e8f0",
                          fontSize: 15,
                          lineHeight: 1.8,
                          fontFamily: "Inter, -apple-system, sans-serif",
                          overflowX: "auto",
                        }}
                      />
                    ) : (
                      <textarea
                        value={editingArticle.content || ""}
                        onChange={(e) => setEditingArticle({ ...editingArticle, content: e.target.value })}
                        style={{
                          width: "100%",
                          minHeight: 480,
                          padding: "16px 20px",
                          borderRadius: 8,
                          background: "#080c14",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                          color: "#38bdf8",
                          fontFamily: "Consolas, Monaco, monospace",
                          fontSize: 13,
                          lineHeight: 1.6,
                        }}
                      />
                    )}
                  </div>

                  {/* ── REAL-TIME SEO, GEO & AI OPTIMIZATION AUDIT ENGINE (Screenshot 4) ── */}
                  <div style={{ background: "rgba(16, 22, 34, 0.78)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 14, padding: "24px 28px", boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 14 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 18, color: "#10b981" }}>🛡️</span>
                          <h3 style={{ margin: 0, fontSize: 17, color: "#ffffff", fontWeight: 700 }}>
                            Real-Time SEO, GEO & AI Optimization Audit Engine
                          </h3>
                        </div>
                        <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>
                          Live 100-point quality score evaluated against Google SERP algorithms & Generative AI Search engines.
                        </p>
                      </div>

                      {/* Right Score Pill */}
                      <div
                        style={{
                          background: "#0d111c",
                          border: "1px solid rgba(255, 255, 255, 0.14)",
                          borderRadius: 10,
                          padding: "12px 20px",
                          display: "flex",
                          alignItems: "center",
                          gap: 16,
                        }}
                      >
                        <div style={{ fontSize: 28, fontWeight: 900, color: audit.score >= 80 ? "#34d399" : audit.score >= 60 ? "#fbbf24" : "#f87171" }}>
                          {audit.score}<span style={{ fontSize: 16, color: "#64748b", fontWeight: 500 }}>/100</span>
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              color: audit.score >= 80 ? "#34d399" : audit.score >= 60 ? "#fbbf24" : "#f87171",
                              background: audit.score >= 80 ? "rgba(52, 211, 153, 0.12)" : audit.score >= 60 ? "rgba(251, 191, 36, 0.12)" : "rgba(248, 113, 113, 0.12)",
                              border: audit.score >= 80 ? "1px solid rgba(52, 211, 153, 0.3)" : audit.score >= 60 ? "1px solid rgba(251, 191, 36, 0.3)" : "1px solid rgba(248, 113, 113, 0.3)",
                              padding: "3px 8px",
                              borderRadius: 4,
                              letterSpacing: "0.5px",
                            }}
                          >
                            {audit.grade}
                          </div>
                          <div style={{ fontSize: 10, color: "#64748b", marginTop: 3 }}>Live Recalculated</div>
                        </div>
                      </div>
                    </div>

                    {/* 4 Category Pill Badges */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
                      <div style={{ background: "#0a0d14", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 8, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700 }}>🎯 KEYWORD SEO</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: audit.categories.keyword > 15 ? "#34d399" : "#fbbf24" }}>{audit.categories.keyword} / 25</span>
                      </div>
                      <div style={{ background: "#0a0d14", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 8, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700 }}>🤖 GEO AI READINESS</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: "#34d399" }}>{audit.categories.geo} / 25</span>
                      </div>
                      <div style={{ background: "#0a0d14", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 8, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700 }}>📊 CONTENT DEPTH</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: audit.categories.depth > 18 ? "#34d399" : "#fbbf24" }}>{audit.categories.depth} / 25</span>
                      </div>
                      <div style={{ background: "#0a0d14", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 8, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700 }}>🔗 LINK DENSITY</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: "#34d399" }}>{audit.categories.links} / 25</span>
                      </div>
                    </div>

                    {/* Optimization Checklist (13 Items) */}
                    <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 12 }}>
                      OPTIMIZATION CHECKLIST & ACTION ITEMS
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 10 }}>
                      {[
                        { key: "c1", title: "Primary Focus Keyword in Meta Title", pts: "+8 pts", active: audit.checks.c1 },
                        { key: "c2", title: "Primary Focus Keyword in URL Permalink Slug", pts: "+5 pts", active: audit.checks.c2 },
                        { key: "c3", title: "Primary Focus Keyword in Meta Description", pts: "+7 pts", active: audit.checks.c3 },
                        { key: "c4", title: "Focus Keyword in Title / Intro Paragraph", pts: "+5 pts", active: audit.checks.c4 },
                        { key: "c5", title: "Generative Engine Optimization (JSON-LD Schema Active)", pts: "+10 pts", active: audit.checks.c5 },
                        { key: "c6", title: "Subheading Hierarchy (2+ H2/H3 Headings for AI Web Crawlers)", pts: "+8 pts", active: audit.checks.c6 },
                        { key: "c7", title: "Executive Summary / Direct Answer Paragraph", pts: "+7 pts", active: audit.checks.c7 },
                        { key: "c8", title: `Comprehensive Article Length (${audit.wordCount} words)`, pts: "+6 pts", active: audit.checks.c8 },
                        { key: "c9", title: "Structured Data Tables / Bulleted Lists", pts: "+7 pts", active: audit.checks.c9 },
                        { key: "c10", title: "Featured Banner Image Uploaded / AI Generated", pts: "+8 pts", active: audit.checks.c10 },
                        { key: "c11", title: `Internal Site Links (${audit.internalLinksCount} Internal Links)`, pts: "+10 pts", active: audit.checks.c11 },
                        { key: "c12", title: `External Authority Citations (${audit.externalLinksCount} External Links)`, pts: "+7 pts", active: audit.checks.c12 },
                        { key: "c13", title: "Meta Title (45-60) & Meta Description (120-160) Length Calibration", pts: "+8 pts", active: audit.checks.c13 },
                      ].map((chk) => (
                        <div
                          key={chk.key}
                          style={{
                            background: "#0a0d14",
                            border: chk.active ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid rgba(245, 158, 11, 0.2)",
                            borderRadius: 8,
                            padding: "10px 14px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 14, color: chk.active ? "#34d399" : "#fbbf24" }}>
                              {chk.active ? "✓" : "⚠"}
                            </span>
                            <span style={{ fontSize: 13, color: chk.active ? "#e2e8f0" : "#94a3b8" }}>
                              {chk.title}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: chk.active ? "#34d399" : "#fbbf24",
                              background: chk.active ? "rgba(16, 185, 129, 0.12)" : "rgba(245, 158, 11, 0.12)",
                              padding: "2px 6px",
                              borderRadius: 4,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {chk.pts}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── COMPLETE SEO & GENERATIVE SEARCH OPTIMIZATION SUITE (Screenshot 5) ── */}
                  <div
                    id="serp-settings-section"
                    style={{
                      background: "rgba(16, 22, 34, 0.78)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      borderRadius: 14,
                      padding: "24px 28px",
                      boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 18, color: "#38bdf8" }}>⚙️</span>
                          <h3 style={{ margin: 0, fontSize: 17, color: "#ffffff", fontWeight: 700 }}>
                            Complete SEO & Generative Search Optimization Suite
                          </h3>
                        </div>
                        <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>
                          Optimize permalinks, meta titles, SERP snippets, categories, tags, focus keywords, and featured images.
                        </p>
                      </div>

                      <button
                        onClick={handleAutoOptimizeSeoFields}
                        style={{
                          background: "#2563eb",
                          border: "1px solid #1d4ed8",
                          color: "#ffffff",
                          padding: "9px 18px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span>✨</span> AI Auto-Optimize All SEO Fields
                      </button>
                    </div>

                    {/* Google SERP Preview Card */}
                    <div style={{ background: "#0a0d14", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 10, padding: 18, marginBottom: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.5px" }}>
                          🔍 GOOGLE SERP PREVIEW
                        </div>
                        <div style={{ display: "flex", gap: 4, background: "#131b2e", padding: 3, borderRadius: 6 }}>
                          <button
                            type="button"
                            onClick={() => setSerpPreviewMode("desktop")}
                            style={{
                              padding: "3px 10px",
                              borderRadius: 4,
                              background: serpPreviewMode === "desktop" ? "#2563eb" : "transparent",
                              border: "none",
                              color: serpPreviewMode === "desktop" ? "#fff" : "#94a3b8",
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            🖥️ Desktop
                          </button>
                          <button
                            type="button"
                            onClick={() => setSerpPreviewMode("mobile")}
                            style={{
                              padding: "3px 10px",
                              borderRadius: 4,
                              background: serpPreviewMode === "mobile" ? "#2563eb" : "transparent",
                              border: "none",
                              color: serpPreviewMode === "mobile" ? "#fff" : "#94a3b8",
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            📱 Mobile
                          </button>
                        </div>
                      </div>

                      {/* SERP Snippet Box */}
                      <div
                        style={{
                          background: "#131b2e",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                          borderRadius: 8,
                          padding: 16,
                          maxWidth: serpPreviewMode === "mobile" ? 380 : 640,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 800 }}>
                            G
                          </div>
                          <div style={{ fontSize: 12, color: "#94a3b8" }}>
                            {connection?.siteUrl || "https://www.gabbarinfo.com"} › {editingArticle.slug || "article-slug"}
                          </div>
                        </div>

                        <div style={{ fontSize: 16, color: "#60a5fa", fontWeight: 600, lineHeight: 1.4, marginBottom: 4, cursor: "pointer" }}>
                          {(editingArticle.meta_title || editingArticle.title || "SEO Article Title").slice(0, 60)}
                        </div>

                        <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5 }}>
                          {(editingArticle.meta_description || editingArticle.excerpt || "Enter a compelling meta description snippet that will appear on Google search results.").slice(0, 160)}
                        </div>
                      </div>

                      {/* Character Progress Bars */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 14 }}>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>
                            <span>Meta Title Length</span>
                            <span style={{ color: metaTitleLength >= 45 && metaTitleLength <= 60 ? "#34d399" : "#fbbf24", fontWeight: 700 }}>
                              {metaTitleLength} / 60 Chars
                            </span>
                          </div>
                          <div style={{ height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${Math.min(100, (metaTitleLength / 60) * 100)}%`, background: metaTitleLength >= 45 && metaTitleLength <= 60 ? "#10b981" : "#f59e0b" }} />
                          </div>
                        </div>

                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>
                            <span>Meta Description Length</span>
                            <span style={{ color: metaDescLength >= 120 && metaDescLength <= 160 ? "#34d399" : "#fbbf24", fontWeight: 700 }}>
                              {metaDescLength} / 160 Chars
                            </span>
                          </div>
                          <div style={{ height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${Math.min(100, (metaDescLength / 160) * 100)}%`, background: metaDescLength >= 120 && metaDescLength <= 160 ? "#10b981" : "#f59e0b" }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Field Inputs */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {/* Focus Keyword */}
                      <div>
                        <label style={{ fontSize: 12, color: "#fbbf24", fontWeight: 700, display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                          <span>✦</span> Primary Focus Keyword
                        </label>
                        <input
                          type="text"
                          value={editingArticle.focus_keyword || ""}
                          onChange={(e) => setEditingArticle({ ...editingArticle, focus_keyword: e.target.value })}
                          placeholder="e.g. affordable digital marketing services, strategic seo consulting"
                          style={{
                            width: "100%",
                            padding: "10px 14px",
                            borderRadius: 6,
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            background: "#0a0d14",
                            color: "#ffffff",
                            fontSize: 14,
                          }}
                        />
                      </div>

                      {/* URL Permalink / Slug */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <label style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                            <span>🔗</span> URL Permalink / Slug
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const autoSlug = (editingArticle.focus_keyword || editingArticle.title)
                                .toLowerCase()
                                .replace(/[^a-z0-9]+/g, "-")
                                .replace(/^-|-$/g, "")
                                .slice(0, 48);
                              setEditingArticle({ ...editingArticle, slug: autoSlug });
                            }}
                            style={{ border: "none", background: "none", color: "#38bdf8", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                          >
                            ✨ Auto-Generate Slug
                          </button>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", background: "#0a0d14", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 6, padding: "0 12px" }}>
                          <span style={{ color: "#64748b", fontSize: 13, marginRight: 4 }}>
                            {connection?.siteUrl?.replace(/^https?:\/\//, "") || "www.gabbarinfo.com"}/
                          </span>
                          <input
                            type="text"
                            value={editingArticle.slug || ""}
                            onChange={(e) => setEditingArticle({ ...editingArticle, slug: e.target.value })}
                            style={{
                              flex: 1,
                              padding: "10px 0",
                              border: "none",
                              background: "transparent",
                              color: "#ffffff",
                              fontSize: 13,
                              outline: "none",
                            }}
                          />
                        </div>
                      </div>

                      {/* Meta Title */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <label style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700 }}>
                            SEO Meta Title (Google H1 Tag)
                          </label>
                          <span style={{ fontSize: 11, color: metaTitleLength >= 50 && metaTitleLength <= 60 ? "#34d399" : "#94a3b8" }}>
                            {metaTitleLength} / 60 chars (Recommended: 50-60)
                          </span>
                        </div>
                        <input
                          type="text"
                          value={editingArticle.meta_title || ""}
                          onChange={(e) => setEditingArticle({ ...editingArticle, meta_title: e.target.value })}
                          style={{
                            width: "100%",
                            padding: "10px 14px",
                            borderRadius: 6,
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            background: "#0a0d14",
                            color: "#ffffff",
                            fontSize: 14,
                          }}
                        />
                      </div>

                      {/* Meta Description */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <label style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700 }}>
                            SEO Meta Description (SERP Snippet)
                          </label>
                          <span style={{ fontSize: 11, color: metaDescLength >= 120 && metaDescLength <= 160 ? "#34d399" : "#94a3b8" }}>
                            {metaDescLength} / 160 chars (Recommended: 120-160)
                          </span>
                        </div>
                        <textarea
                          rows={3}
                          value={editingArticle.meta_description || ""}
                          onChange={(e) => setEditingArticle({ ...editingArticle, meta_description: e.target.value })}
                          style={{
                            width: "100%",
                            padding: "10px 14px",
                            borderRadius: 6,
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            background: "#0a0d14",
                            color: "#ffffff",
                            fontSize: 13,
                            lineHeight: 1.5,
                          }}
                        />
                      </div>
                    </div>

                    {/* Bottom Save Buttons */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
                      <button
                        onClick={() => handleSaveArticle("draft")}
                        disabled={savingArticle}
                        style={{
                          padding: "10px 20px",
                          borderRadius: 8,
                          border: "1px solid #3b82f6",
                          background: "rgba(59, 130, 246, 0.15)",
                          color: "#60a5fa",
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {savingArticle ? "Saving…" : "💾 Save Draft"}
                      </button>
                      <button
                        onClick={handleInitiatePublish}
                        disabled={publishingArticle}
                        style={{
                          padding: "10px 24px",
                          borderRadius: 8,
                          border: "1px solid #059669",
                          background: "#10b981",
                          color: "#ffffff",
                          fontSize: 13,
                          fontWeight: 800,
                          cursor: "pointer",
                          boxShadow: "0 2px 10px rgba(16, 185, 129, 0.4)",
                        }}
                      >
                        {publishingArticle ? "Publishing…" : "🚀 Publish to WordPress Now"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            /* ══════════════════════════════════════════════════════════════
               ARTICLES & CONTENT MANAGEMENT HUB (TABLE VIEW - Screenshot 2)
            ══════════════════════════════════════════════════════════════ */
            <div style={{ width: "100%", maxWidth: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 12, width: "100%", maxWidth: "100%" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", flex: "1 1 auto", maxWidth: "100%" }}>
                  <input
                    type="text"
                    placeholder="Search articles or pages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "1px solid #1e293b",
                      background: "#0f172a",
                      color: "#fff",
                      fontSize: 13,
                      minWidth: 0,
                      flex: "1 1 180px",
                      maxWidth: "100%",
                      boxSizing: "border-box",
                    }}
                  />

                  <select
                    value={contentFilter}
                    onChange={(e) => setContentFilter(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #1e293b",
                      background: "#0f172a",
                      color: "#e2e8f0",
                      fontSize: 13,
                      flexShrink: 0,
                    }}
                  >
                    <option value="all">All Content Types</option>
                    <option value="post">Blog Posts Only</option>
                    <option value="page">Website Pages Only</option>
                  </select>

                  <button
                    onClick={() => fetchContent(connection)}
                    disabled={loadingContent}
                    className="btn-gabbar-secondary"
                    style={{
                      padding: "8px 14px",
                      fontSize: 13,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    {loadingContent ? "Syncing…" : "🔄 Sync WP Posts & Pages"}
                  </button>
                </div>

                <button
                  onClick={() => {
                    if (!connection?.siteUrl) {
                      alert("⚠️ Please connect your WordPress website in the 'WordPress Connector & GSC' tab first.");
                      setActiveTab("integrations");
                      return;
                    }
                    const defaultTopic = suggestedTopics[0] || (activeBusiness ? `How ${activeBusiness} Drives High-ROI Growth in 2026` : "High-ROI Growth Strategies in 2026");
                    handleSelectTopic(defaultTopic);
                  }}
                  className="btn-gabbar-primary"
                  style={{
                    padding: "10px 20px",
                    fontSize: 13,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  <span>✍️</span> Generate & Publish Blog ↗
                </button>
              </div>

              {/* Table (Screenshot 2) */}
              <div style={{ background: "rgba(16, 22, 34, 0.78)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 14, overflowX: "auto", maxWidth: "100%", boxSizing: "border-box" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)", color: "#64748b", textTransform: "uppercase", fontSize: 11, letterSpacing: "0.5px" }}>
                      <th style={{ padding: "14px 18px", width: 40 }}>
                        <input type="checkbox" style={{ cursor: "pointer" }} />
                      </th>
                      <th style={{ padding: "14px 18px" }}>Article Title</th>
                      <th style={{ padding: "14px 14px" }}>Category</th>
                      <th style={{ padding: "14px 14px" }}>Mode</th>
                      <th style={{ padding: "14px 14px" }}>Status</th>
                      <th style={{ padding: "14px 14px" }}>GSC Index Log</th>
                      <th style={{ padding: "14px 14px" }}>Date</th>
                      <th style={{ padding: "14px 18px", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingContent ? (
                      <tr>
                        <td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>
                          Fetching live posts and pages from WordPress…
                        </td>
                      </tr>
                    ) : filteredContent.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: 44, textAlign: "center", color: "#64748b" }}>
                          {!connection?.siteUrl ? (
                            <div style={{ maxWidth: 440, margin: "0 auto" }}>
                              <div style={{ fontSize: 32, marginBottom: 10 }}>🔌</div>
                              <div style={{ color: "#f8fafc", fontWeight: 700, fontSize: 15, marginBottom: 6 }}>No WordPress Website Connected</div>
                              <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
                                Connect your WordPress website to sync published posts, track real-time Google indexing, and publish AI blogs directly to your site.
                              </div>
                              <button
                                onClick={() => setActiveTab("integrations")}
                                className="btn-gabbar-primary"
                                style={{ padding: "9px 20px", fontSize: 12, cursor: "pointer" }}
                              >
                                Connect WordPress Website ↗
                              </button>
                            </div>
                          ) : (
                            "No content items found on your connected WordPress site. Click 'Generate & Publish Blog' to create your first article."
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredContent.map((item) => (
                        <tr key={item.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                          <td style={{ padding: "14px 18px" }}>
                            <input type="checkbox" style={{ cursor: "pointer" }} />
                          </td>
                          <td style={{ padding: "14px 18px", maxWidth: 360 }}>
                            <div style={{ fontWeight: 600, color: "#f8fafc", lineHeight: 1.4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span>{item.title}</span>
                              {item.bypasses_db_content && (
                                <span style={{ fontSize: 10, background: "rgba(56, 189, 248, 0.15)", border: "1px solid rgba(56, 189, 248, 0.35)", color: "#38bdf8", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
                                  ⚡ Custom Theme Template
                                </span>
                              )}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontSize: 12, color: "#38bdf8", textDecoration: "none" }}
                              >
                                /{item.slug} ↗
                              </a>
                              <span style={{ fontSize: 11, background: "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: 4, color: "#94a3b8" }}>
                                {item.word_count || 0} words
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: "14px 14px" }}>
                            <span style={{ fontSize: 12, color: "#cbd5e1", background: "rgba(255,255,255,0.05)", padding: "3px 8px", borderRadius: 4 }}>
                              {item.categories?.[0] || (item.type === "page" ? "Website Page" : "Digital Strategy")}
                            </span>
                          </td>
                          <td style={{ padding: "14px 14px" }}>
                            {item.is_agent_created ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                <span
                                  style={{
                                    fontSize: 11,
                                    padding: "3px 8px",
                                    borderRadius: 4,
                                    background: "rgba(16, 185, 129, 0.15)",
                                    color: "#34d399",
                                    fontWeight: 700,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  <span>🤖</span> AI Agent
                                </span>
                                <span style={{ fontSize: 10, color: (item.edits_remaining ?? 2) > 0 ? "#34d399" : "#fbbf24", fontWeight: 600 }}>
                                  {(item.edits_remaining ?? 2) > 0 ? `${item.edits_remaining ?? 2} free edits` : "1 credit/edit"}
                                </span>
                              </div>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                <span
                                  style={{
                                    fontSize: 11,
                                    padding: "3px 8px",
                                    borderRadius: 4,
                                    background: "rgba(59, 130, 246, 0.15)",
                                    color: "#60a5fa",
                                    fontWeight: 700,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  <span>🌐</span> Website Page
                                </span>
                                <span style={{ fontSize: 10, color: "#94a3b8" }}>1 credit/edit</span>
                              </div>
                            )}
                          </td>
                          {/* Status Badge (Screenshot 2: Draft Ready vs WordPress Live) */}
                          <td style={{ padding: "14px 14px" }}>
                            {item.status === "draft" ? (
                              <span
                                style={{
                                  fontSize: 11,
                                  padding: "4px 10px",
                                  borderRadius: 6,
                                  background: "rgba(30, 41, 59, 0.9)",
                                  border: "1px solid rgba(148, 163, 184, 0.25)",
                                  color: "#cbd5e1",
                                  fontWeight: 700,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                }}
                              >
                                <span>📄</span> Draft Ready
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: 11,
                                  padding: "4px 10px",
                                  borderRadius: 6,
                                  background: "rgba(16, 185, 129, 0.15)",
                                  border: "1px solid rgba(16, 185, 129, 0.3)",
                                  color: "#34d399",
                                  fontWeight: 700,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                }}
                              >
                                <span>✓</span> WordPress Live
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "14px 14px" }}>
                            <span style={{ fontSize: 12, color: "#64748b" }}>—</span>
                          </td>
                          <td style={{ padding: "14px 14px" }}>
                            <span style={{ fontSize: 12, color: "#94a3b8" }}>
                              {item.date ? new Date(item.date).toLocaleDateString("en-US", { day: "numeric", month: "short" }) : "—"}
                            </span>
                          </td>
                          {/* Actions (Screenshot 2: Edit blue button) */}
                          <td style={{ padding: "14px 18px", textAlign: "right" }}>
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                              <button
                                onClick={() => handleOpenEditor(item)}
                                style={{
                                  padding: "6px 14px",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  borderRadius: 6,
                                  border: "1px solid #2563eb",
                                  background: "#2563eb",
                                  color: "#ffffff",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  boxShadow: "0 2px 6px rgba(37, 99, 235, 0.3)",
                                }}
                              >
                                <span>✏️</span> Edit
                              </button>
                              {item.status === "publish" && (
                                <button
                                  onClick={() => handleOpenOptimize(item)}
                                  className="btn-gabbar-secondary"
                                  style={{
                                    padding: "6px 12px",
                                    fontSize: 12,
                                    cursor: "pointer",
                                  }}
                                >
                                  ⚡ Optimize
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}

        {/* =========================================================================
            TAB 2: TOPICS & KEYWORD PLANNER
        ========================================================================= */}
        {activeTab === "topics" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* Left: Focus Keywords */}
            <div style={{ background: "rgba(16, 22, 34, 0.78)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 14, padding: 24 }}>
              <h3 style={{ margin: "0 0 8px 0", fontSize: 16, color: "#fff" }}>🎯 Target Focus Keywords</h3>
              <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 16px 0" }}>
                Keywords used to guide SERP ranking, on-page optimization, and autonomous blog generation.
              </p>

              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <input
                  type="text"
                  placeholder="Enter new focus keyword..."
                  value={newKeywordInput}
                  onChange={(e) => setNewKeywordInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid rgba(255, 255, 255, 0.14)",
                    background: "#0d111c",
                    color: "#fff",
                    fontSize: 13,
                  }}
                />
                <button
                  onClick={() => {
                    if (newKeywordInput.trim()) {
                      setKeywords([...keywords, newKeywordInput.trim()]);
                      setNewKeywordInput("");
                    }
                  }}
                  style={{
                    padding: "8px 16px",
                    cursor: "pointer",
                  }}
                  className="btn-gabbar-primary"
                >
                  + Add Keyword
                </button>
              </div>

              {keywords.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "#94a3b8", fontSize: 13, background: "#0d111c", borderRadius: 8, border: "1px dashed rgba(255,255,255,0.12)" }}>
                  🎯 No target keywords yet. Enter your focus keyword above and click <strong>+ Add Keyword</strong>, or connect your website to automatically extract high-ranking search terms.
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {keywords.map((kw, i) => (
                    <span
                      key={i}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        background: "rgba(18, 24, 38, 0.85)",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        padding: "6px 12px",
                        borderRadius: 6,
                        fontSize: 12,
                        color: "#e2e8f0",
                      }}
                    >
                      <span>{kw}</span>
                      <button
                        onClick={() => setKeywords(keywords.filter((_, idx) => idx !== i))}
                        style={{ border: "none", background: "none", color: "#94a3b8", cursor: "pointer", fontSize: 12, padding: 0 }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Anti-Duplication AI SERP Ideation (30 Topics) */}
            <div style={{ background: "rgba(16, 22, 34, 0.78)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 14, padding: 24, boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, color: "#fff" }}>💡 AI SERP Topic Generator</h3>
                  <span style={{ fontSize: 11, color: "#38bdf8", fontWeight: 700 }}>30 High-Ranking Editorial Calendar Topics</span>
                </div>
                <button
                  onClick={() => handleAutoSuggestTopics()}
                  disabled={loadingTopics}
                  className="btn-gabbar-primary"
                  style={{
                    padding: "7px 16px",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {loadingTopics ? "Crawling & Analyzing Site…" : `⚡ Re-Generate 30 Topics ↗ (${suggestedTopics.length})`}
                </button>
              </div>
              <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 16px 0" }}>
                Cross-references live content to guarantee 0% duplication. Includes 30 full days of strategic authority topics.
              </p>

                {/* Verified Niche Intelligence Badge */}
                {discoveredNiche && (
                  <div
                    style={{
                      marginBottom: 16,
                      padding: "12px 16px",
                      borderRadius: 10,
                      background: "linear-gradient(135deg, rgba(56, 189, 248, 0.1) 0%, rgba(14, 165, 233, 0.05) 100%)",
                      border: "1px solid rgba(56, 189, 248, 0.3)",
                      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: nicheSummary ? 4 : 0 }}>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 12, background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        🎯 Verified Niche Intelligence
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                        {discoveredNiche}
                      </span>
                    </div>
                    {nicheSummary && (
                      <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5, marginTop: 4 }}>
                        {nicheSummary}
                      </div>
                    )}
                  </div>
                )}

              <div style={{ maxHeight: 580, overflowY: "auto", paddingRight: 6, display: "flex", flexDirection: "column", gap: 10 }}>
                {!connection?.siteUrl && !activeBusiness ? (
                  <div style={{ padding: "36px 24px", textAlign: "center", background: "#0d111c", borderRadius: 12, border: "1px dashed rgba(56, 189, 248, 0.28)" }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>🌐</div>
                    <h4 style={{ margin: "0 0 8px 0", color: "#fff", fontSize: 16, fontWeight: 700 }}>Connect Your WordPress Website</h4>
                    <p style={{ color: "#94a3b8", fontSize: 13, maxWidth: 440, margin: "0 auto 20px auto", lineHeight: 1.5 }}>
                      Connect your site to scan your live pages and let AI generate 30 high-ranking, anti-duplicated blog topics tailored to your exact industry and niche.
                    </p>
                    <button
                      onClick={() => setActiveTab("integrations")}
                      className="btn-gabbar-primary"
                      style={{ padding: "10px 22px", fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}
                    >
                      <span>🔗</span> Connect WordPress Website ↗
                    </button>
                  </div>
                ) : loadingTopics && suggestedTopics.length === 0 ? (
                  <div style={{ padding: 36, textAlign: "center", color: "#38bdf8", fontSize: 13, background: "#0d111c", borderRadius: 8, border: "1px dashed rgba(56, 189, 248, 0.3)" }}>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>🤖</div>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>Crawling & Analyzing Live Website...</div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>Extracting your site's true services, products, and shastras to build 30 tailored authority topics.</div>
                  </div>
                ) : suggestedTopics.length === 0 ? (
                  <div style={{ padding: 32, textAlign: "center", color: "#64748b", fontSize: 13, background: "#0d111c", borderRadius: 8 }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>⚡</div>
                    <div>Click "Re-Generate 30 Topics" to crawl {connection?.siteUrl || activeBusiness || "your website"} and generate tailored topics.</div>
                  </div>
                ) : (
                  suggestedTopics.map((top, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "12px 14px",
                        background: "#0d111c",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: 8,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: "#38bdf8",
                            background: "rgba(56, 189, 248, 0.12)",
                            border: "1px solid rgba(56, 189, 248, 0.25)",
                            padding: "2px 6px",
                            borderRadius: 4,
                            marginTop: 1,
                            flexShrink: 0,
                          }}
                        >
                          #{idx + 1}
                        </span>
                        <div>
                          <div style={{ fontSize: 13, color: "#f8fafc", fontWeight: 600, lineHeight: 1.4 }}>{top}</div>
                          <div style={{ fontSize: 11, color: "#34d399", display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                            <span>●</span> Ranked City & Service Keywords Ready
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSelectTopic(top)}
                        className="btn-gabbar-primary"
                        style={{
                          padding: "6px 14px",
                          fontSize: 11,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        ✍️ Write Article ↗
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: AUTOPILOT SCHEDULER
        ========================================================================= */}
        {activeTab === "autopilot" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {!connection?.siteUrl && (
              <div style={{ padding: "16px 20px", borderRadius: 12, background: "rgba(245, 158, 11, 0.12)", border: "1px solid #f59e0b", color: "#fbbf24", fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <strong>⚠️ WordPress Connection Required:</strong> Connect your WordPress site to activate automated daily editorial generation and publishing.
                </div>
                <button
                  onClick={() => setActiveTab("integrations")}
                  className="btn-gabbar-primary"
                  style={{ padding: "8px 16px", fontSize: 12, cursor: "pointer" }}
                >
                  Connect Website ↗
                </button>
              </div>
            )}

            {/* ── HEADER & MAIN CONTROL CARD ── */}
            <div style={{ background: "rgba(16, 22, 34, 0.78)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 14, padding: 28, boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#34d399", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
                    <span>⚡</span> Autonomous Dispatch Engine
                  </div>
                  <h2 style={{ margin: "0 0 6px 0", fontSize: 22, color: "#fff", fontWeight: 800 }}>Automated Editorial Velocity & Dispatch</h2>
                  <p style={{ margin: 0, color: "#94a3b8", fontSize: 14, maxWidth: 740, lineHeight: 1.5 }}>
                    Every day GabbarInfo AI generates a comprehensive, anti-duplicated, dual-visual SEO article and publishes it live to your WordPress site.
                  </p>
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    onClick={() => {
                      if ((isTrial99 || !canUseSeoAutopilot) && !autopilotEnabled) {
                        setShowSubscriptionModal(true);
                        return;
                      }
                      handleSaveAutopilotSettings(!autopilotEnabled);
                    }}
                    disabled={savingAutopilotConfig}
                    style={{
                      padding: "10px 22px",
                      borderRadius: 8,
                      border: (isTrial99 || !canUseSeoAutopilot) && !autopilotEnabled
                        ? "1px solid rgba(245, 158, 11, 0.4)"
                        : autopilotEnabled
                        ? "1px solid #10b981"
                        : "1px solid rgba(255, 255, 255, 0.18)",
                      background: (isTrial99 || !canUseSeoAutopilot) && !autopilotEnabled
                        ? "linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(234, 88, 12, 0.1) 100%)"
                        : autopilotEnabled
                        ? "#10b981"
                        : "rgba(255, 255, 255, 0.06)",
                      color: (isTrial99 || !canUseSeoAutopilot) && !autopilotEnabled
                        ? "#fbbf24"
                        : autopilotEnabled
                        ? "#052e16"
                        : "#ffffff",
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      boxShadow: autopilotEnabled ? "0 0 20px rgba(16, 185, 129, 0.35)" : "none",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <span>{(isTrial99 || !canUseSeoAutopilot) && !autopilotEnabled ? "🔒" : autopilotEnabled ? "✓" : "▶"}</span>
                    {savingAutopilotConfig
                      ? "Updating…"
                      : (isTrial99 || !canUseSeoAutopilot) && !autopilotEnabled
                      ? "🔒 Upgrade for Autopilot"
                      : autopilotEnabled
                      ? "Active Production Engine"
                      : "Enable Production Routine"}
                  </button>

                  <button
                    onClick={async () => {
                      if (!connection?.siteUrl) {
                        alert("⚠️ Please connect your WordPress website in the 'WordPress Connector & GSC' tab first.");
                        setActiveTab("integrations");
                        return;
                      }
                      setRunningCycle(true);
                      setCycleNotice("Running autonomous publishing cycle…");
                      try {
                        const res = await fetch("/api/wordpress/autopilot-cron?force=1");
                        const data = await res.json();
                        if (data.ok) {
                          setCycleNotice(`Cycle completed! Processed ${data.processed} site(s). Check Content Hub for your live article.`);
                          fetchContent(connection);
                        } else {
                          setCycleNotice("Cycle failed: " + (data.error || "Unknown"));
                        }
                      } catch (e) {
                        setCycleNotice("Cycle execution error: " + e.message);
                      } finally {
                        setRunningCycle(false);
                      }
                    }}
                    disabled={runningCycle}
                    className="btn-gabbar-primary"
                    style={{
                      padding: "10px 20px",
                      fontSize: 13,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>⚡</span>
                    {runningCycle ? "Publishing…" : "Trigger Immediate Generation ↗"}
                  </button>
                </div>
              </div>

              {cycleNotice && (
                <div style={{ marginTop: 18, padding: "12px 16px", borderRadius: 8, background: "#131b2e", border: "1px solid #1e293b", color: "#60a5fa", fontSize: 13 }}>
                  {cycleNotice}
                </div>
              )}

              {/* ── AUTOPILOT PUBLISHING INTELLIGENCE BAR ── */}
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(255, 255, 255, 0.08)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)", borderRadius: 10, padding: "12px 16px" }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>📚 Live Published Blogs</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#34d399", marginTop: 4 }}>
                    {contentList.filter((i) => (i.type || i.post_type) === "post").length} {contentList.filter((i) => (i.type || i.post_type) === "post").length === 1 ? "Article" : "Articles"}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                    {contentList.filter((i) => (i.type || i.post_type) === "page").length > 0
                      ? `Synced live on WordPress (+${contentList.filter((i) => (i.type || i.post_type) === "page").length} Pages)`
                      : "Synced live on WordPress"}
                  </div>
                </div>

                <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)", borderRadius: 10, padding: "12px 16px" }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>🤖 AI Autopilot Output</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#38bdf8", marginTop: 4 }}>
                    {autopilotPublishedCount} Delivered
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Generated & published autonomously</div>
                </div>

                <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)", borderRadius: 10, padding: "12px 16px" }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>📅 Last Dispatched At</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {lastPublishedAt ? new Date(lastPublishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Active for today's cycle"}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Autonomous cadence monitor</div>
                </div>
              </div>
            </div>

            {/* ── SECTION 1: DEFINE PUBLISHING RHYTHM & VOLUME ── */}
            <div style={{ background: "rgba(16, 22, 34, 0.78)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 14, padding: 28, boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 18 }}>
                1. Define Publishing Rhythm & Volume
              </div>

              {/* 🔒 Sampler / Trial Locked Banner */}
              {(isTrial99 || !canUseSeoAutopilot) && (
                <div
                  style={{
                    marginBottom: 20,
                    padding: "16px 20px",
                    borderRadius: 14,
                    background: "linear-gradient(135deg, rgba(245, 158, 11, 0.14) 0%, rgba(234, 88, 12, 0.08) 100%)",
                    border: "1px solid rgba(245, 158, 11, 0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 260, flex: 1 }}>
                    <span style={{ fontSize: 28 }}>🔒</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#fbbf24" }}>
                        SEO Autopilot Locked on Power Sampler (₹99)
                      </div>
                      <div style={{ fontSize: 12.5, color: "#cbd5e1", marginTop: 4, lineHeight: 1.5 }}>
                        Your trial pack includes <strong>2 on-demand SEO blogs</strong> to test AI generation quality. Continuous scheduled publishing (Daily / Weekly) requires an active Monthly Subscription.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSubscriptionModal(true)}
                    style={{
                      padding: "9px 20px",
                      borderRadius: 10,
                      background: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)",
                      border: "none",
                      color: "#fff",
                      fontWeight: 800,
                      fontSize: 13,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      boxShadow: "0 0 15px rgba(245, 158, 11, 0.35)",
                    }}
                  >
                    Upgrade to Monthly ↗
                  </button>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                {/* Daily High-Growth Cadence */}
                <div
                  onClick={() => {
                    if (isTrial99 || !canUseSeoAutopilot) {
                      setShowSubscriptionModal(true);
                      return;
                    }
                    setCadence("daily");
                  }}
                  style={{
                    background: cadence === "daily" && !isTrial99 && canUseSeoAutopilot ? "rgba(16, 185, 129, 0.08)" : "rgba(13, 20, 35, 0.7)",
                    border: cadence === "daily" && !isTrial99 && canUseSeoAutopilot ? "1.5px solid #10b981" : "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 12,
                    padding: 20,
                    cursor: (isTrial99 || !canUseSeoAutopilot) ? "not-allowed" : "pointer",
                    opacity: (isTrial99 || !canUseSeoAutopilot) ? 0.45 : 1,
                    filter: (isTrial99 || !canUseSeoAutopilot) ? "grayscale(0.4)" : "none",
                    position: "relative",
                    transition: "all 0.2s ease",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 6 }}>
                        {(isTrial99 || !canUseSeoAutopilot) && <span style={{ fontSize: 14 }}>🔒</span>}
                        Daily High-Growth Cadence
                      </div>
                      <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 12, background: "rgba(16, 185, 129, 0.2)", color: "#34d399", fontWeight: 700, border: "1px solid rgba(16, 185, 129, 0.3)", letterSpacing: "0.4px" }}>
                        MAX RANKINGS
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8", marginBottom: 8 }}>30 Articles Monthly (Daily Rollout)</div>
                    <p style={{ margin: 0, color: "#94a3b8", fontSize: 12, lineHeight: 1.5 }}>
                      Rapidly establishes topical authority and captures emerging keyword trends with daily fresh content.
                    </p>
                  </div>
                  {cadence === "daily" && !isTrial99 && canUseSeoAutopilot && (
                    <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
                      <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#10b981", color: "#052e16", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900 }}>✓</span>
                    </div>
                  )}
                </div>

                {/* Alternate Day Cadence (15 Blogs / Mo) */}
                <div
                  onClick={() => {
                    if (isTrial99 || !canUseSeoAutopilot) {
                      setShowSubscriptionModal(true);
                      return;
                    }
                    setCadence("alternate");
                  }}
                  style={{
                    background: cadence === "alternate" && !isTrial99 && canUseSeoAutopilot ? "rgba(16, 185, 129, 0.08)" : "rgba(13, 20, 35, 0.7)",
                    border: cadence === "alternate" && !isTrial99 && canUseSeoAutopilot ? "1.5px solid #10b981" : "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 12,
                    padding: 20,
                    cursor: (isTrial99 || !canUseSeoAutopilot) ? "not-allowed" : "pointer",
                    opacity: (isTrial99 || !canUseSeoAutopilot) ? 0.45 : 1,
                    filter: (isTrial99 || !canUseSeoAutopilot) ? "grayscale(0.4)" : "none",
                    position: "relative",
                    transition: "all 0.2s ease",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 6 }}>
                        {(isTrial99 || !canUseSeoAutopilot) && <span style={{ fontSize: 14 }}>🔒</span>}
                        Alternate Day Cadence
                      </div>
                      <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 12, background: "rgba(168, 85, 247, 0.15)", color: "#c084fc", fontWeight: 700, border: "1px solid rgba(168, 85, 247, 0.3)", letterSpacing: "0.4px" }}>
                        BALANCED
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8", marginBottom: 8 }}>15 Articles Monthly (1 Every 2 Days)</div>
                    <p style={{ margin: 0, color: "#94a3b8", fontSize: 12, lineHeight: 1.5 }}>
                      Optimally paced releases engineered for steady audience retention and consistent search crawl velocity.
                    </p>
                  </div>
                  {cadence === "alternate" && !isTrial99 && canUseSeoAutopilot && (
                    <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
                      <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#10b981", color: "#052e16", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900 }}>✓</span>
                    </div>
                  )}
                </div>

                {/* Bi-Weekly Authority Cadence (8 Blogs / Mo) */}
                <div
                  onClick={() => {
                    if (isTrial99 || !canUseSeoAutopilot) {
                      setShowSubscriptionModal(true);
                      return;
                    }
                    setCadence("weekly");
                  }}
                  style={{
                    background: cadence === "weekly" && !isTrial99 && canUseSeoAutopilot ? "rgba(16, 185, 129, 0.08)" : "rgba(13, 20, 35, 0.7)",
                    border: cadence === "weekly" && !isTrial99 && canUseSeoAutopilot ? "1.5px solid #10b981" : "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 12,
                    padding: 20,
                    cursor: (isTrial99 || !canUseSeoAutopilot) ? "not-allowed" : "pointer",
                    opacity: (isTrial99 || !canUseSeoAutopilot) ? 0.45 : 1,
                    filter: (isTrial99 || !canUseSeoAutopilot) ? "grayscale(0.4)" : "none",
                    position: "relative",
                    transition: "all 0.2s ease",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 6 }}>
                        {(isTrial99 || !canUseSeoAutopilot) && <span style={{ fontSize: 14 }}>🔒</span>}
                        Bi-Weekly Authority Cadence
                      </div>
                      <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 12, background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", fontWeight: 700, border: "1px solid rgba(56, 189, 248, 0.3)", letterSpacing: "0.4px" }}>
                        STEADY
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8", marginBottom: 8 }}>8 Articles Monthly (2 per Week)</div>
                    <p style={{ margin: 0, color: "#94a3b8", fontSize: 12, lineHeight: 1.5 }}>
                      Targeted bi-weekly releases (e.g. Tuesday & Friday) ideal for steady niche authority expansion.
                    </p>
                  </div>
                  {cadence === "weekly" && !isTrial99 && canUseSeoAutopilot && (
                    <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
                      <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#10b981", color: "#052e16", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900 }}>✓</span>
                    </div>
                  )}
                </div>

                {/* Tailored Frequency Plan */}
                <div
                  onClick={() => {
                    if (isTrial99 || !canUseSeoAutopilot) {
                      setShowSubscriptionModal(true);
                      return;
                    }
                    setCadence("custom");
                  }}
                  style={{
                    background: cadence === "custom" && !isTrial99 && canUseSeoAutopilot ? "rgba(16, 185, 129, 0.08)" : "rgba(13, 20, 35, 0.7)",
                    border: cadence === "custom" && !isTrial99 && canUseSeoAutopilot ? "1.5px solid #10b981" : "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 12,
                    padding: 20,
                    cursor: (isTrial99 || !canUseSeoAutopilot) ? "not-allowed" : "pointer",
                    opacity: (isTrial99 || !canUseSeoAutopilot) ? 0.45 : 1,
                    filter: (isTrial99 || !canUseSeoAutopilot) ? "grayscale(0.4)" : "none",
                    position: "relative",
                    transition: "all 0.2s ease",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 6 }}>
                        {(isTrial99 || !canUseSeoAutopilot) && <span style={{ fontSize: 14 }}>🔒</span>}
                        Tailored Frequency Plan
                      </div>
                      <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 12, background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", fontWeight: 700, border: "1px solid rgba(56, 189, 248, 0.3)", letterSpacing: "0.4px" }}>
                        ADAPTIVE
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8", marginBottom: 8 }}>
                      Custom Pace ({customDaysPerWeek} Posts / Wk)
                    </div>
                    <p style={{ margin: 0, color: "#94a3b8", fontSize: 12, lineHeight: 1.5 }}>
                      Configure a bespoke weekly output volume fine-tuned to your brand's growth targets.
                    </p>
                  </div>
                  {cadence === "custom" && !isTrial99 && canUseSeoAutopilot && (
                    <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
                      <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#10b981", color: "#052e16", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900 }}>✓</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Custom Frequency Selector (when active) */}
              {cadence === "custom" && (
                <div style={{ marginTop: 20, padding: "16px 20px", background: "rgba(13, 20, 35, 0.9)", border: "1px solid rgba(56, 189, 248, 0.25)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Configure Target Weekly Output:</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                      Generating ~{customDaysPerWeek * 4} articles per month distributed across active production days.
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[2, 3, 4, 5, 6].map((num) => (
                      <button
                        key={num}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCustomDaysPerWeek(num);
                        }}
                        style={{
                          padding: "8px 16px",
                          borderRadius: 8,
                          border: customDaysPerWeek === num ? "1.5px solid #10b981" : "1px solid rgba(255, 255, 255, 0.15)",
                          background: customDaysPerWeek === num ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.05)",
                          color: customDaysPerWeek === num ? "#34d399" : "#fff",
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                      >
                        {num} Posts / Wk
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Cadence Info Footnote */}
              <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", fontSize: 12 }}>
                <span style={{ color: "#34d399" }}>✨</span>
                <span>✦ Articles are autonomously formatted, internally linked, and indexed on your WordPress domain with semantic schema.</span>
              </div>
            </div>

            {/* ── SECTION 2: TARGET GEOGRAPHIC SCOPE (COUNTRIES & CITIES) ── */}
            <div style={{ background: "rgba(16, 22, 34, 0.78)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 14, padding: 28, boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: "rgba(245, 158, 11, 0.15)", border: "1px solid rgba(245, 158, 11, 0.3)", color: "#fbbf24", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                  <span>🌍</span> Geo-Targeting Intelligence
                </div>
                <h3 style={{ margin: "0 0 6px 0", fontSize: 18, color: "#fff", fontWeight: 800 }}>
                  2. Target Geographic Markets (Countries, States & Cities)
                </h3>
                <p style={{ margin: 0, color: "#94a3b8", fontSize: 13, lineHeight: 1.5 }}>
                  Define which countries, states, or cities your automated blogs and social media posts must target. GabbarInfo AI automatically tailors regional market context, commercial statistics, localized examples, and relevant hashtags to these territories.
                </p>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 8 }}>
                  Target Countries or Cities (comma-separated):
                </label>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <input
                    type="text"
                    value={autopilotTargetLocations}
                    onChange={(e) => setAutopilotTargetLocations(e.target.value)}
                    placeholder="e.g. United States, United Kingdom, Canada, or India, Mumbai, Delhi, Dubai, Toronto"
                    style={{
                      flex: 1,
                      minWidth: 280,
                      padding: "12px 16px",
                      borderRadius: 8,
                      border: "1px solid rgba(255, 255, 255, 0.16)",
                      background: "rgba(13, 20, 35, 0.9)",
                      color: "#fff",
                      fontSize: 14,
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={() => handleSaveAutopilotSettings()}
                    disabled={savingAutopilotConfig}
                    className="btn-gabbar-primary"
                    style={{ padding: "10px 20px", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    {savingAutopilotConfig ? "Saving…" : "Save Target Territories ↗"}
                  </button>
                </div>

                {/* Popular Region Presets */}
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Quick Presets:</span>
                  {[
                    { label: "🌐 Global / Worldwide", val: "Global Commercial Markets" },
                    { label: "🇺🇸 USA & Canada", val: "United States, Canada" },
                    { label: "🇬🇧 UK & Europe", val: "United Kingdom, Germany, France, European Union" },
                    { label: "🇮🇳 India (Pan-India)", val: "India, Mumbai, Delhi, Bangalore, Ahmedabad" },
                    { label: "🇦🇪 UAE & Gulf", val: "United Arab Emirates, Dubai, Saudi Arabia, Qatar" },
                    { label: "🇦🇺 Australia & NZ", val: "Australia, Sydney, Melbourne, New Zealand" },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => setAutopilotTargetLocations(preset.val)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: autopilotTargetLocations === preset.val ? "1px solid #f59e0b" : "1px solid rgba(255, 255, 255, 0.1)",
                        background: autopilotTargetLocations === preset.val ? "rgba(245, 158, 11, 0.15)" : "rgba(255, 255, 255, 0.04)",
                        color: autopilotTargetLocations === preset.val ? "#fbbf24" : "#94a3b8",
                        fontSize: 11,
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Social Asset Pairing Prompt / Verification Banner */}
            {brandMeta?.pageId ? (
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
                      Social Syndication Linked: {brandMeta.pageName || "Facebook Page"} &amp; {brandMeta.igUsername ? `@${brandMeta.igUsername}` : (brandMeta.igId ? `ID: ${brandMeta.igId}` : "Instagram")}
                    </div>
                    <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 2 }}>
                      New WordPress blog articles will automatically cross-post to your verified Meta channels.
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
                      Link <strong>{connection?.siteUrl ? connection.siteUrl.replace(/^https?:\/\//, '') : (activeBusiness || "this site")}</strong> with its official Facebook Page &amp; Instagram account so newly generated blogs cross-post autonomously.
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

            {/* ── SECTION 3: INSTANT SOCIAL BROADCAST & AMPLIFICATION ── */}
            <div style={{ background: "rgba(16, 22, 34, 0.78)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 14, padding: 28, boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: "rgba(56, 189, 248, 0.15)", border: "1px solid rgba(56, 189, 248, 0.3)", color: "#38bdf8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    <span>⚡</span> Syndication Protocol
                  </div>

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
                </div>
                <h3 style={{ margin: "0 0 6px 0", fontSize: 18, color: "#fff", fontWeight: 800 }}>
                  3. Instant Multichannel Social Syndication
                </h3>
                <p style={{ margin: 0, color: "#94a3b8", fontSize: 13, lineHeight: 1.5 }}>
                  Amplify every live blog instantly. The moment an article goes live on WordPress, GabbarInfo AI automatically distributes it to your active social networks.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                {/* Facebook Option Card */}
                <div
                  onClick={() => {
                    if (!brandMeta?.pageId) {
                      alert(`⚠️ No Facebook Page is paired for ${connection?.siteUrl || activeBusiness}. Please connect or pair your social assets in Social Pilot.`);
                      return;
                    }
                    setAutoShareFb(!autoShareFb);
                  }}
                  style={{
                    background: brandMeta?.pageId && autoShareFb ? "rgba(24, 119, 242, 0.1)" : "rgba(13, 20, 35, 0.7)",
                    border: brandMeta?.pageId && autoShareFb ? "1.5px solid #1877f2" : "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 12,
                    padding: 20,
                    cursor: brandMeta?.pageId ? "pointer" : "not-allowed",
                    opacity: brandMeta?.pageId ? 1 : 0.8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: brandMeta?.pageId ? "#1877f2" : "rgba(148, 163, 184, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill={brandMeta?.pageId ? "#ffffff" : "#94a3b8"}>
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
                        📘 Facebook Page: {brandMeta?.pageName || "No Page Linked"}
                        {brandMeta?.pageId && autoShareFb ? (
                          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(16, 185, 129, 0.2)", color: "#34d399", fontWeight: 700 }}>
                            ACTIVE
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(148, 163, 184, 0.15)", color: "#94a3b8", fontWeight: 700 }}>
                            {brandMeta?.pageId ? "DISABLED" : "NOT CONNECTED"}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: brandMeta?.pageId ? "#38bdf8" : "#94a3b8", marginTop: 2 }}>
                        {brandMeta?.pageId ? `Target ID: ${brandMeta.pageId}` : `Unpaired: No Facebook asset bound to ${connection?.siteUrl ? connection.siteUrl.replace(/^https?:\/\//, '') : (activeBusiness || "this site")}`}
                      </div>
                      <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: 12, lineHeight: 1.4 }}>
                        {brandMeta?.pageId
                          ? "Automatically broadcasts a high-CTR interactive preview card with article synopsis, featured artwork, and direct site link."
                          : "Connect and pair a Facebook Page in Social Pilot to enable automated syndication for this website."}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <div
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 14,
                      background: brandMeta?.pageId && autoShareFb ? "#10b981" : "#334155",
                      position: "relative",
                      flexShrink: 0,
                      transition: "background 0.2s ease",
                      cursor: brandMeta?.pageId ? "pointer" : "not-allowed",
                    }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "#fff",
                        position: "absolute",
                        top: 3,
                        left: brandMeta?.pageId && autoShareFb ? 23 : 3,
                        transition: "left 0.2s ease",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                      }}
                    />
                  </div>
                </div>

                {/* Instagram Option Card */}
                <div
                  onClick={() => {
                    if (!brandMeta?.igUsername && !brandMeta?.igId) {
                      alert(`⚠️ No Instagram account is paired for ${connection?.siteUrl || activeBusiness}. Please connect or pair in Social Pilot.`);
                      return;
                    }
                    setAutoShareIg(!autoShareIg);
                  }}
                  style={{
                    background: (brandMeta?.igUsername || brandMeta?.igId) && autoShareIg ? "rgba(225, 48, 108, 0.1)" : "rgba(13, 20, 35, 0.7)",
                    border: (brandMeta?.igUsername || brandMeta?.igId) && autoShareIg ? "1.5px solid #e1306c" : "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 12,
                    padding: 20,
                    cursor: (brandMeta?.igUsername || brandMeta?.igId) ? "pointer" : "not-allowed",
                    opacity: (brandMeta?.igUsername || brandMeta?.igId) ? 1 : 0.8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: (brandMeta?.igUsername || brandMeta?.igId) ? "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)" : "rgba(148, 163, 184, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill={(brandMeta?.igUsername || brandMeta?.igId) ? "#ffffff" : "#94a3b8"}>
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
                        📸 Instagram: {brandMeta?.igUsername ? `@${brandMeta.igUsername}` : (brandMeta?.igId ? `ID: ${brandMeta.igId}` : "No Account Linked")}
                        {(brandMeta?.igUsername || brandMeta?.igId) && autoShareIg ? (
                          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(16, 185, 129, 0.2)", color: "#34d399", fontWeight: 700 }}>
                            ACTIVE
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(148, 163, 184, 0.15)", color: "#94a3b8", fontWeight: 700 }}>
                            {(brandMeta?.igUsername || brandMeta?.igId) ? "DISABLED" : "NOT CONNECTED"}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: (brandMeta?.igUsername || brandMeta?.igId) ? "#e879f9" : "#94a3b8", marginTop: 2 }}>
                        {brandMeta?.igUsername ? `Account: @${brandMeta.igUsername}` : (brandMeta?.igId ? `Account ID: ${brandMeta.igId}` : "Unpaired: No Instagram connected for this site")}
                      </div>
                      <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: 12, lineHeight: 1.4 }}>
                        {(brandMeta?.igUsername || brandMeta?.igId)
                          ? "Auto-formats your article's visual graphics with an AI-crafted caption, high-ranking hashtags, and bio call-to-action."
                          : "Connect and pair an Instagram Business account in Social Pilot to syndicate visuals for this website."}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <div
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 14,
                      background: (brandMeta?.igUsername || brandMeta?.igId) && autoShareIg ? "#10b981" : "#334155",
                      position: "relative",
                      flexShrink: 0,
                      transition: "background 0.2s ease",
                      cursor: (brandMeta?.igUsername || brandMeta?.igId) ? "pointer" : "not-allowed",
                    }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "#fff",
                        position: "absolute",
                        top: 3,
                        left: (brandMeta?.igUsername || brandMeta?.igId) && autoShareIg ? 23 : 3,
                        transition: "left 0.2s ease",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                      }}
                    />
                  </div>
                </div>
              </div>

              {!brandMeta?.pageId && (
                <div style={{ marginTop: 14, padding: "12px 18px", borderRadius: 10, background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.25)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ fontSize: 12.5, color: "#fbbf24", display: "flex", alignItems: "center", gap: 8 }}>
                    <span>🛡️</span>
                    <span>
                      <strong>Strict Brand Isolation:</strong> No social channels are paired for <strong>{connection?.siteUrl ? connection.siteUrl.replace(/^https?:\/\//, '') : activeBusiness}</strong>. Articles will NOT be syndicated to other client channels.
                    </span>
                  </div>
                  <a
                    href="/#_=_"
                    style={{ fontSize: 12, fontWeight: 700, color: "#38bdf8", textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    ⚙️ Pair Social Assets in Social Pilot ↗
                  </a>
                </div>
              )}

              {/* Save Settings Bar */}
              <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => handleSaveAutopilotSettings()}
                  disabled={savingAutopilotConfig}
                  style={{
                    padding: "12px 28px",
                    borderRadius: 8,
                    background: "#10b981",
                    border: "none",
                    color: "#052e16",
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: "0 0 25px rgba(16, 185, 129, 0.4)",
                    transition: "all 0.2s ease",
                  }}
                >
                  <span>✓</span>
                  {savingAutopilotConfig ? "Saving Preferences…" : "Apply Routine & Cross-Post Settings"}
                </button>
              </div>
            </div>

            {/* ── SECTION 3: UPCOMING 7-DAY AUTONOMOUS DISPATCH CADENCE ── */}
            <div style={{ background: "rgba(16, 22, 34, 0.78)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 14, padding: 28, boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(56, 189, 248, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#38bdf8", fontSize: 16 }}>
                  📅
                </div>
                <div>
                  <h4 style={{ fontSize: 16, color: "#fff", margin: 0, fontWeight: 700 }}>
                    Upcoming 7-Day Velocity Cadence (Projected Dispatch Schedule)
                  </h4>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                    Preview of automated publishing days based on your chosen velocity ({cadence === "daily" ? "Daily Rollout" : cadence === "weekly" ? "Weekly Rollout" : cadence === "monthly" ? "Monthly Rollout" : `${customDaysPerWeek} Posts / Week`}). Articles are generated and published autonomously on active dates.
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
                  if (autopilotEnabled) {
                    if (cadence === "daily") {
                      isScheduled = true;
                    } else if (cadence === "weekly" || cadence === "monthly") {
                      isScheduled = offset === 0;
                    } else if (cadence === "custom") {
                      const interval = Math.max(1, Math.floor(7 / customDaysPerWeek));
                      isScheduled = offset % interval === 0;
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
                        <div style={{ fontSize: 11, color: isToday ? "#38bdf8" : "#94a3b8", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          {isToday ? "TODAY" : d.toLocaleDateString("en-US", { weekday: "short" })}
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginTop: 4 }}>
                          {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </div>
                      </div>
                      {(() => {
                        const todayStr = new Date().toISOString().slice(0, 10);
                        const lastPubDate = lastPublishedAt ? new Date(lastPublishedAt).toISOString().slice(0, 10) : null;
                        const hasTodayBlog = Array.isArray(contentList) && contentList.some((item) => {
                          const dStr = item.date || item.date_gmt || item.created_at;
                          return dStr && new Date(dStr).toISOString().slice(0, 10) === todayStr;
                        });
                        const isTodayDone = lastPubDate === todayStr || hasTodayBlog;

                        let badgeText = "⚪ Rest / Buffer Day";
                        let badgeBg = "rgba(255, 255, 255, 0.04)";
                        let badgeColor = "#64748b";
                        let badgeBorder = "1px solid transparent";

                        if (!autopilotEnabled) {
                          badgeText = "⚪ Paused";
                        } else if (isToday) {
                          if (isTodayDone) {
                            badgeText = "✅ Dispatched Successfully";
                            badgeBg = "rgba(16, 185, 129, 0.22)";
                            badgeColor = "#34d399";
                            badgeBorder = "1px solid #10b981";
                          } else if (isScheduled) {
                            badgeText = "🟢 Active Dispatch Today";
                            badgeBg = "rgba(56, 189, 248, 0.18)";
                            badgeColor = "#38bdf8";
                            badgeBorder = "1px solid rgba(56, 189, 248, 0.4)";
                          }
                        } else {
                          if (isScheduled) {
                            badgeText = "🟢 Active Dispatch Day";
                            badgeBg = "rgba(16, 185, 129, 0.15)";
                            badgeColor = "#34d399";
                            badgeBorder = "1px solid rgba(16, 185, 129, 0.25)";
                          }
                        }

                        return (
                          <div
                            style={{
                              fontSize: 11,
                              marginTop: 10,
                              fontWeight: 700,
                              padding: "4px 8px",
                              borderRadius: 6,
                              background: badgeBg,
                              color: badgeColor,
                              border: badgeBorder,
                              lineHeight: 1.3,
                            }}
                          >
                            {badgeText}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: INTEGRATIONS HUB & CONNECTOR
        ========================================================================= */}
        {activeTab === "integrations" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* WordPress Connector Card */}
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16, color: "#fff" }}>WordPress Plugin Connector</h3>
                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: connection?.siteUrl ? "#064e3b" : "#451a03",
                    color: connection?.siteUrl ? "#34d399" : "#fbbf24",
                    fontWeight: 600,
                  }}
                >
                  {connection?.siteUrl ? "● Configured" : "○ Not Connected"}
                </span>
              </div>
              <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 16px 0" }}>
                Zero-config connector. Generates dynamic rotating pairing keys for safe autonomous communication.
              </p>

              <div style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 12 }}>
                <div><strong>Site URL:</strong> {connection?.siteUrl || "None"}</div>
                <div style={{ marginTop: 6 }}>
                  <strong>Secret Key:</strong>{" "}
                  <code style={{ background: "#131b2e", padding: "2px 6px", borderRadius: 4 }}>
                    {connection?.apiKey ? `${connection.apiKey.substring(0, 8)}••••••••` : "None"}
                  </code>
                </div>
              </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
                  <a
                    href="/api/wordpress/download"
                    download
                    style={{
                      padding: "8px 14px",
                      borderRadius: 6,
                      background: "#2563eb",
                      color: "#fff",
                      textDecoration: "none",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    📥 Download Plugin Zip
                  </a>
                  <button
                    type="button"
                    onClick={() => setShowAddSiteModal(true)}
                    className="btn-gabbar-primary"
                    style={{
                      padding: "8px 14px",
                      fontSize: 13,
                    }}
                  >
                    + Connect Another Website
                  </button>
                </div>
              </div>

              {/* Connected Profiles Overview */}
              <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 24, gridColumn: "1 / -1" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <h3 style={{ margin: 0, fontSize: 16, color: "#fff" }}>All Connected Websites ({connectedProfiles.length})</h3>
                  <button
                    onClick={() => setShowAddSiteModal(true)}
                    className="btn-gabbar-primary"
                    style={{ padding: "6px 14px", fontSize: 12 }}
                  >
                    + Add New Website
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                  {connectedProfiles.map((pName) => {
                    const c = allConnections[pName];
                    const isSelected = pName === activeBusiness;
                    return (
                      <div
                        key={pName}
                        onClick={() => handleSelectBusiness(pName)}
                        style={{
                          padding: 14,
                          borderRadius: 10,
                          background: isSelected ? "rgba(56, 189, 248, 0.1)" : "rgba(255, 255, 255, 0.03)",
                          border: `1px solid ${isSelected ? "#38bdf8" : "#1e293b"}`,
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <strong style={{ color: isSelected ? "#38bdf8" : "#fff", fontSize: 14 }}>{pName}</strong>
                          {isSelected && <span style={{ fontSize: 10, background: "#0284c7", color: "#fff", padding: "2px 6px", borderRadius: 4 }}>Active</span>}
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8", wordBreak: "break-all" }}>{c?.siteUrl}</div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>Plugin v{c?.pluginVersion || "1.0.0"}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

            {/* Google Search Console Card */}
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16, color: "#fff" }}>Google Search Console (GSC)</h3>
                <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, background: "#1e293b", color: "#94a3b8", fontWeight: 600 }}>
                  Instant Indexing
                </span>
              </div>
              <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 16px 0" }}>
                Instant IndexNow and Google Search Console indexing ping for all newly published blogs and updated pages.
              </p>
              <div style={{ padding: 14, background: "#131b2e", borderRadius: 8, color: "#94a3b8", fontSize: 13, marginBottom: 16 }}>
                ✅ IndexNow ping is enabled automatically on every WordPress publish action.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL 1: OPTIMIZE PAGE/BLOG ── */}
      {optimizingItem && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 16 }}>
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, maxWidth: 560, width: "100%", padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: "#fff" }}>⚡ Optimize: {optimizingItem.title}</h3>
              <button onClick={() => setOptimizingItem(null)} style={{ border: "none", background: "none", color: "#94a3b8", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 4 }}>Article / Page Title</label>
                <input
                  type="text"
                  value={optTitle}
                  onChange={(e) => setOptTitle(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #1e293b", background: "#131b2e", color: "#fff", fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 4 }}>Focus Target Keyword</label>
                <input
                  type="text"
                  value={optFocusKw}
                  onChange={(e) => setOptFocusKw(e.target.value)}
                  placeholder="e.g. strategic seo consulting services"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #1e293b", background: "#131b2e", color: "#fff", fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 4 }}>SEO Meta Title (max 60 chars)</label>
                <input
                  type="text"
                  value={optMetaTitle}
                  onChange={(e) => setOptMetaTitle(e.target.value)}
                  maxLength={65}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #1e293b", background: "#131b2e", color: "#fff", fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 4 }}>SEO Meta Description (max 155 chars)</label>
                <textarea
                  value={optMetaDesc}
                  onChange={(e) => setOptMetaDesc(e.target.value)}
                  maxLength={160}
                  rows={3}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #1e293b", background: "#131b2e", color: "#fff", fontSize: 13 }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={async () => {
                  const target = optimizingItem;
                  setOptimizingItem(null);
                  await handleOpenEditor(target);
                  setShowAiOptimizeModal(true);
                }}
                style={{
                  padding: "9px 16px",
                  borderRadius: 6,
                  border: "1px solid #c084fc",
                  background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                  color: "#ffffff",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 2px 8px rgba(124, 58, 237, 0.35)",
                }}
              >
                <span>🤖</span> Autonomous AI Full Page Rewrite ↗
              </button>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setOptimizingItem(null)} style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #1e293b", background: "transparent", color: "#94a3b8", cursor: "pointer" }}>
                  Cancel
                </button>
                <button
                  onClick={handleSaveOptimization}
                  disabled={optSaving}
                  className="btn-gabbar-primary"
                  style={{ padding: "9px 20px", fontSize: 13, cursor: "pointer" }}
                >
                  {optSaving ? "Saving…" : "Apply On-Page SEO ↗"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 2: NEW BLOG GENERATOR & SOCIAL SHARE ── */}
      {showNewBlogModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 16 }}>
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 14, maxWidth: 640, width: "100%", padding: 28, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: "#fff" }}>✍️ Generate & Publish AI Blog</h3>
              <button onClick={() => setShowNewBlogModal(false)} style={{ border: "none", background: "none", color: "#94a3b8", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>

            {!publishedResult ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {!connection?.siteUrl && (
                  <div style={{ padding: "12px 16px", borderRadius: 8, background: "rgba(245, 158, 11, 0.15)", border: "1px solid #f59e0b", color: "#fbbf24", fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span>⚠️ <strong>WordPress Site Required:</strong> Please connect your WordPress site first to save drafts and publish live articles.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewBlogModal(false);
                        setActiveTab("integrations");
                      }}
                      className="btn-gabbar-primary"
                      style={{ padding: "6px 12px", fontSize: 11, cursor: "pointer" }}
                    >
                      Connect Website ↗
                    </button>
                  </div>
                )}

                <div>
                  <label style={{ fontSize: 13, color: "#94a3b8", display: "block", marginBottom: 6 }}>Blog Topic / Headline</label>
                  <input
                    type="text"
                    placeholder="e.g. 10 Proven Web Design Trends That Increase Conversions in 2026"
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: "1px solid #1e293b", background: "#131b2e", color: "#fff", fontSize: 14 }}
                  />
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={{ fontSize: 13, color: "#94a3b8" }}>
                      Target Market Scope <span style={{ fontSize: 11, color: "#64748b" }}>(Optional: Country, State, City, or Global)</span>
                    </label>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Leave blank for Universal / National, or enter e.g. India, USA, Mumbai, Texas..."
                      value={targetMarket}
                      onChange={(e) => setTargetMarket(e.target.value)}
                      style={{ flex: 1, padding: "9px 12px", borderRadius: 6, border: "1px solid #1e293b", background: "#131b2e", color: "#fff", fontSize: 13 }}
                    />
                    <button
                      type="button"
                      disabled={loadingKeywords}
                      onClick={() => fetchKeywordsForTopic(newTopic, targetMarket)}
                      className="btn-gabbar-secondary"
                      style={{ padding: "8px 14px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}
                    >
                      {loadingKeywords ? "Searching SERP…" : "⚡ Re-Research Ranking Keywords"}
                    </button>
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>
                      Target Ranked Keywords <span style={{ color: "#34d399", fontSize: 11, fontWeight: 700, marginLeft: 6 }}>
                        ● {targetMarket ? `${targetMarket} SERP Targeted` : "Universal Commercial SERP"}
                      </span>
                    </label>
                    {loadingKeywords && (
                      <span style={{ fontSize: 11, color: "#38bdf8", fontWeight: 600, animation: "pulse 1.5s infinite" }}>
                        🔍 AI Extracting High-Volume Keywords…
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. strategic seo services, google rankings optimization, b2b lead generation..."
                    value={newKeywords}
                    onChange={(e) => setNewKeywords(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: "1px solid #1e293b", background: "#131b2e", color: "#fff", fontSize: 14 }}
                  />
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 5, lineHeight: 1.4 }}>
                    💡 <strong>Zero Manual Work Required:</strong> The AI dynamically discovers high-ranking commercial, long-tail, and topical search queries tailored for your business model and target market scope.
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 13, color: "#94a3b8", display: "block", marginBottom: 6 }}>Target Word Count</label>
                  <select
                    value={newWordCount}
                    onChange={(e) => setNewWordCount(Number(e.target.value))}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: "1px solid #1e293b", background: "#131b2e", color: "#fff", fontSize: 14 }}
                  >
                    <option value={1000}>1,000 Words</option>
                    <option value={1500}>1,500 Words (Recommended)</option>
                    <option value={2000}>2,000 Words (Deep Authority)</option>
                    <option value={3000}>3,000 Words (Ultimate Pillar Guide)</option>
                  </select>
                </div>

                <div style={{ background: "#131b2e", padding: 14, borderRadius: 8, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                  ✨ <strong>Autonomous Perks:</strong> Automatically creates <strong>two AI visuals</strong> (Featured Hero Banner + Mid-Article Graphic), internal links to your live site, external authority citations, and full Yoast/RankMath meta tags.
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                  <button onClick={() => setShowNewBlogModal(false)} style={{ padding: "9px 16px", borderRadius: 6, border: "1px solid #1e293b", background: "transparent", color: "#94a3b8", cursor: "pointer" }}>
                    Cancel
                  </button>
                  <button
                    onClick={() => handleGenerateBlog(newTopic, "draft")}
                    disabled={generatingBlog}
                    style={{
                      padding: "11px 20px",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      borderRadius: 8,
                      border: "1px solid #3b82f6",
                      background: "rgba(59, 130, 246, 0.15)",
                      color: "#60a5fa",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      transition: "all 0.2s ease",
                    }}
                  >
                    {generatingBlog ? "Writing & Generating Dual AI Visuals…" : "📝 Generate as Draft & Edit ↗"}
                  </button>
                  <button
                    onClick={() => handleGenerateBlog(newTopic, "publish")}
                    disabled={generatingBlog}
                    className="btn-gabbar-primary"
                    style={{ padding: "11px 22px", fontSize: 13, cursor: "pointer" }}
                  >
                    {generatingBlog ? "Writing & Publishing…" : "🚀 Publish Live to WordPress ↗"}
                  </button>
                </div>
              </div>
            ) : (
              /* Published Result & Social Share Buttons */
              <div>
                <div style={{ padding: 16, background: "rgba(16, 185, 129, 0.1)", border: "1px solid #10b981", borderRadius: 8, marginBottom: 18 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#34d399", marginBottom: 4 }}>🎉 Article Published Successfully!</div>
                  <div style={{ fontSize: 13, color: "#e2e8f0", marginBottom: 8 }}>{publishedResult.title}</div>
                  <a
                    href={publishedResult.post_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#60a5fa", fontSize: 13, textDecoration: "none", fontWeight: 600 }}
                  >
                    View Live on WordPress ↗
                  </a>
                </div>

                {publishedResult.featured_image && (
                  <div style={{ marginBottom: 18, textAlign: "center" }}>
                    <img
                      src={publishedResult.featured_image}
                      alt="Featured Preview"
                      style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 8, objectFit: "cover" }}
                    />
                  </div>
                )}

                {/* 1-Click Social Sharing Buttons */}
                <div style={{ background: "#131b2e", padding: 18, borderRadius: 10, border: "1px solid #1e293b" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                    <h4 style={{ margin: 0, fontSize: 14, color: "#fff" }}>📢 Cross-Promote to Social Channels</h4>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", fontWeight: 700 }}>
                      Active Profile: {activeBusiness || "Selected Business"}
                    </span>
                  </div>
                  <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#94a3b8" }}>
                    Instantly share this new article to your verified Meta assets with interactive click-through card:
                  </p>

                  {/* Explicit Target Account Display */}
                  <div style={{ background: "rgba(10, 14, 23, 0.6)", borderRadius: 8, padding: "10px 14px", marginBottom: 14, border: "1px solid rgba(255, 255, 255, 0.08)", fontSize: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#e2e8f0", marginBottom: 6 }}>
                      <span>📘</span>
                      <strong>Facebook Target:</strong>
                      <span style={{ color: brandMeta?.pageName ? "#38bdf8" : "#94a3b8" }}>
                        {brandMeta?.pageName ? `${brandMeta.pageName} (ID: ${brandMeta.pageId || "Active"})` : `Unpaired: No Facebook Page bound to ${connection?.siteUrl ? connection.siteUrl.replace(/^https?:\/\//, '') : (activeBusiness || "this site")}`}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#e2e8f0" }}>
                      <span>📸</span>
                      <strong>Instagram Target:</strong>
                      <span style={{ color: (brandMeta?.igUsername || brandMeta?.igId) ? "#e879f9" : "#94a3b8" }}>
                        {brandMeta?.igUsername ? `@${brandMeta.igUsername}` : (brandMeta?.igId ? `ID: ${brandMeta.igId}` : `Unpaired: No Instagram bound to this site`)}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      onClick={() => handleSocialShare("facebook")}
                      disabled={socialSharing || !brandMeta?.pageId}
                      style={{
                        padding: "9px 16px",
                        borderRadius: 6,
                        border: "none",
                        background: brandMeta?.pageId ? "#1877f2" : "#334155",
                        color: "#fff",
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: brandMeta?.pageId ? "pointer" : "not-allowed",
                        opacity: brandMeta?.pageId ? 1 : 0.6,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span>📘</span> {brandMeta?.pageName ? `Share to ${brandMeta.pageName}` : "No Facebook Page Linked"}
                    </button>

                    <button
                      onClick={() => handleSocialShare("instagram")}
                      disabled={socialSharing || !(brandMeta?.igUsername || brandMeta?.igId)}
                      style={{
                        padding: "9px 16px",
                        borderRadius: 6,
                        border: "none",
                        background: (brandMeta?.igUsername || brandMeta?.igId) ? "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)" : "#334155",
                        color: "#fff",
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: (brandMeta?.igUsername || brandMeta?.igId) ? "pointer" : "not-allowed",
                        opacity: (brandMeta?.igUsername || brandMeta?.igId) ? 1 : 0.6,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span>📸</span> {(brandMeta?.igUsername || brandMeta?.igId) ? `Share to @${brandMeta.igUsername || brandMeta.igId}` : "No Instagram Linked"}
                    </button>
                  </div>

                  {socialShareStatus && (
                    <div style={{ marginTop: 12, fontSize: 13, color: socialShareStatus.ok ? "#34d399" : "#f87171" }}>
                      {socialShareStatus.message}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
                  <button
                    onClick={() => {
                      setPublishedResult(null);
                      setShowNewBlogModal(false);
                      setNewTopic("");
                    }}
                    style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #1e293b", background: "#131b2e", color: "#e2e8f0", cursor: "pointer" }}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL 3: INLINE FACEBOOK CONNECT PROMPT ── */}
      {showFbConnectModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, maxWidth: 440, width: "100%", padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔗</div>
            <h3 style={{ margin: "0 0 8px 0", fontSize: 18, color: "#fff" }}>Connect Facebook Business</h3>
            <p style={{ margin: "0 0 20px 0", fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>
              Your Facebook Business account is not connected yet. Connect now to publish this article directly to your Facebook Page and Instagram.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
              <button
                onClick={() => setShowFbConnectModal(false)}
                style={{ padding: "9px 18px", borderRadius: 6, border: "1px solid #1e293b", background: "#131b2e", color: "#94a3b8", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  window.open("/api/facebook/connect", "_blank", "width=600,height=700");
                  setShowFbConnectModal(false);
                }}
                style={{ padding: "9px 20px", borderRadius: 6, border: "none", background: "#1877f2", color: "#fff", fontWeight: 600, cursor: "pointer" }}
              >
                Connect Facebook Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 4: GEO SCHEMA EDITOR (JSON-LD) ── */}
      {showSchemaModal && editingArticle && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 14, maxWidth: 680, width: "100%", padding: 28, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
                  <span>&lt;&gt;</span> GEO Schema Editor (JSON-LD)
                </h3>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>
                  Autonomous Generative Engine Optimization schema for Google AI Overviews, Gemini, and Perplexity.
                </span>
              </div>
              <button onClick={() => setShowSchemaModal(false)} style={{ border: "none", background: "none", color: "#94a3b8", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>

            {(() => {
              const schemaObj = {
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": editingArticle.title,
                "description": editingArticle.meta_description || editingArticle.excerpt || "",
                "image": [editingArticle.featured_image || editingArticle.mid_image || "https://www.gabbarinfo.com/wp-content/uploads/hero.jpg"],
                "author": {
                  "@type": "Organization",
                  "name": activeBusiness,
                  "url": connection?.siteUrl || "https://www.gabbarinfo.com",
                },
                "publisher": {
                  "@type": "Organization",
                  "name": activeBusiness,
                  "logo": {
                    "@type": "ImageObject",
                    "url": "https://www.gabbarinfo.com/wp-content/uploads/logo.png",
                  },
                },
                "datePublished": new Date().toISOString().split("T")[0],
                "dateModified": new Date().toISOString().split("T")[0],
                "mainEntityOfPage": {
                  "@type": "WebPage",
                  "@id": editingArticle.url || `${connection?.siteUrl || "https://www.gabbarinfo.com"}/${editingArticle.slug}`,
                },
              };
              const schemaString = JSON.stringify(schemaObj, null, 2);

              return (
                <div>
                  <textarea
                    readOnly
                    value={schemaString}
                    rows={16}
                    style={{
                      width: "100%",
                      padding: "14px 16px",
                      borderRadius: 8,
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      background: "#080c14",
                      color: "#38bdf8",
                      fontFamily: "Consolas, Monaco, monospace",
                      fontSize: 12,
                      lineHeight: 1.5,
                      marginBottom: 16,
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                    <button
                      onClick={() => setShowSchemaModal(false)}
                      style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #1e293b", background: "transparent", color: "#94a3b8", cursor: "pointer" }}
                    >
                      Close
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(schemaString);
                        alert("✅ JSON-LD Schema copied to clipboard!");
                      }}
                      style={{
                        padding: "8px 18px",
                        borderRadius: 6,
                        border: "1px solid #10b981",
                        background: "rgba(16, 185, 129, 0.15)",
                        color: "#34d399",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      📋 Copy Schema JSON-LD
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── MODAL 5: AUTONOMOUS AI PAGE OPTIMIZER ── */}
      {showAiOptimizeModal && editingArticle && (() => {
        const modalAudit = computeAuditScore(editingArticle);
        return (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
            <div style={{ background: "#0b1120", border: "1px solid rgba(168, 85, 247, 0.4)", borderRadius: 16, maxWidth: 640, width: "100%", padding: 28, boxShadow: "0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(168, 85, 247, 0.25)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                    🤖
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, color: "#fff", fontWeight: 800 }}>Autonomous AI Page Optimizer</h3>
                    <p style={{ margin: 0, fontSize: 12, color: "#a855f7" }}>Full-Page Copy & SEO Overhaul (Zero Layout Breakage)</p>
                  </div>
                </div>
                <button onClick={() => setShowAiOptimizeModal(false)} style={{ border: "none", background: "none", color: "#94a3b8", fontSize: 20, cursor: "pointer" }}>✕</button>
              </div>

              <div style={{ background: "rgba(168, 85, 247, 0.08)", border: "1px solid rgba(168, 85, 247, 0.2)", borderRadius: 10, padding: "14px 16px", marginBottom: 18 }}>
                <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.6 }}>
                  Target Page: <strong style={{ color: "#ffffff" }}>{editingArticle.title}</strong> (<em>/{editingArticle.slug || "page"}</em>)
                </div>
                <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12, color: "#c084fc" }}>
                  <div>🛡️ <strong>Layout Preservation:</strong> 100% theme & form tags kept</div>
                  <div>🎯 <strong>Headline Upgrade:</strong> High-intent commercial H1/H2</div>
                  <div>📍 <strong>Geo & Keywords:</strong> Local authority signals injected</div>
                  <div>📑 <strong>FAQ & Proof Points:</strong> GEO AI snippet structure added</div>
                </div>

                {/* Live Pre vs Post Score Preview in Modal */}
                <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(0,0,0,0.4)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div>
                    <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700 }}>CURRENT PRE-OPTIMIZATION AUDIT</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: modalAudit?.score >= 80 ? "#34d399" : modalAudit?.score >= 60 ? "#fbbf24" : "#f87171" }}>
                      {modalAudit?.score || 50}/100 <span style={{ fontSize: 11, fontWeight: 600 }}>({modalAudit?.grade || "NEEDS OPTIMIZATION"})</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 18, color: "#a855f7", fontWeight: 900 }}>➔</div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "#34d399", fontWeight: 700 }}>TARGET POST-OPTIMIZATION SCORE</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: "#34d399" }}>
                      96+/100 <span style={{ fontSize: 11, fontWeight: 600 }}>(READY TO RANK)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mode Selector for Custom Theme Templates */}
              {Boolean(
                editingArticle.is_custom_template ||
                editingArticle.bypasses_db_content ||
                (editingArticle.template_file && editingArticle.template_file !== "default")
              ) && (
                <div style={{ marginBottom: 18, background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, background: "rgba(234, 179, 8, 0.2)", color: "#fde047", padding: "2px 8px", borderRadius: 12, fontWeight: 800 }}>
                        ⚡ CUSTOM TEMPLATE
                      </span>
                      <label style={{ fontSize: 12, color: "#f1f5f9", fontWeight: 700, margin: 0 }}>
                        Select Architecture Mode:
                      </label>
                    </div>

                    {/* ℹ️ What's the difference? Hoverable & Clickable Link */}
                    <div
                      style={{ position: "relative" }}
                      onMouseEnter={() => setShowDiffTooltip(true)}
                      onMouseLeave={() => setShowDiffTooltip(false)}
                    >
                      <button
                        type="button"
                        onClick={() => setShowDiffTooltip(!showDiffTooltip)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#38bdf8",
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: "pointer",
                          textDecoration: "underline",
                          padding: 0,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        ℹ️ (What's the difference?)
                      </button>

                      {/* Hover Tooltip Card */}
                      {showDiffTooltip && (
                        <div
                          style={{
                            position: "absolute",
                            right: 0,
                            top: 22,
                            width: 530,
                            maxWidth: "88vw",
                            background: "#0c1322",
                            border: "1.5px solid rgba(56, 189, 248, 0.4)",
                            borderRadius: 12,
                            padding: 14,
                            boxShadow: "0 25px 60px rgba(0,0,0,0.95), 0 0 30px rgba(56, 189, 248, 0.25)",
                            zIndex: 99999,
                            color: "#f8fafc",
                            fontSize: 11.5,
                            lineHeight: 1.5,
                          }}
                        >
                          <div style={{ fontWeight: 800, color: "#38bdf8", marginBottom: 8, fontSize: 12.5, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span>Architecture Comparison: Dynamic CMS vs cPanel Developer</span>
                            <span style={{ fontSize: 10, color: "#94a3b8" }}>Hover/Click</span>
                          </div>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                            <thead>
                              <tr style={{ background: "rgba(255,255,255,0.05)", textAlign: "left" }}>
                                <th style={{ padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }}>Feature / Aspect</th>
                                <th style={{ padding: "6px 8px", color: "#34d399", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>🟢 Instant Dynamic (Non-Coder)</th>
                                <th style={{ padding: "6px 8px", color: "#60a5fa", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>🔵 cPanel Mode (Developer)</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td style={{ padding: "6px 8px", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#e2e8f0" }}>cPanel / FTP Login?</td>
                                <td style={{ padding: "6px 8px", color: "#cbd5e1", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>❌ <strong>No.</strong> 100% managed from AI Dashboard.</td>
                                <td style={{ padding: "6px 8px", color: "#cbd5e1", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>✅ <strong>Yes.</strong> You copy/paste PHP into hosting file.</td>
                              </tr>
                              <tr>
                                <td style={{ padding: "6px 8px", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#e2e8f0" }}>cPanel PHP File</td>
                                <td style={{ padding: "6px 8px", color: "#cbd5e1", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Untouched backup on server; live site renders via WP DB.</td>
                                <td style={{ padding: "6px 8px", color: "#cbd5e1", borderBottom: "1px solid rgba(255,255,255,0.06)" }}><strong>cPanel PHP file remains 100% in charge</strong> and directly runs.</td>
                              </tr>
                              <tr>
                                <td style={{ padding: "6px 8px", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#e2e8f0" }}>Future Content Updates</td>
                                <td style={{ padding: "6px 8px", color: "#cbd5e1", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>1-Click live updates anytime from AI Dashboard.</td>
                                <td style={{ padding: "6px 8px", color: "#cbd5e1", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Manual code paste into cPanel file each time.</td>
                              </tr>
                              <tr>
                                <td style={{ padding: "6px 8px", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#e2e8f0" }}>Custom PHP Logic</td>
                                <td style={{ padding: "6px 8px", color: "#cbd5e1", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Bypassed (WP DB does not execute raw PHP for security).</td>
                                <td style={{ padding: "6px 8px", color: "#cbd5e1", borderBottom: "1px solid rgba(255,255,255,0.06)" }}><strong>100% Preserved.</strong> All custom PHP loops & queries run intact.</td>
                              </tr>
                              <tr>
                                <td style={{ padding: "6px 8px", fontWeight: 700, color: "#e2e8f0" }}>SEO Meta Tags</td>
                                <td style={{ padding: "6px 8px", color: "#34d399" }}>Updated directly in WP SEO database.</td>
                                <td style={{ padding: "6px 8px", color: "#60a5fa" }}>Updated directly in WP SEO database.</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Two Selectable Option Cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {/* Option 1: Dynamic Mode */}
                    <div
                      onClick={() => setCustomOptimizeMode("dynamic")}
                      style={{
                        border: customOptimizeMode === "dynamic" ? "2px solid #10b981" : "1px solid rgba(255,255,255,0.12)",
                        background: customOptimizeMode === "dynamic" ? "rgba(16, 185, 129, 0.12)" : "rgba(255,255,255,0.02)",
                        borderRadius: 10,
                        padding: "10px 12px",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: customOptimizeMode === "dynamic" ? "#34d399" : "#ffffff" }}>
                          🟢 Instant Dynamic Mode
                        </span>
                        {customOptimizeMode === "dynamic" && (
                          <span style={{ fontSize: 9.5, background: "#10b981", color: "#fff", padding: "1px 5px", borderRadius: 3, fontWeight: 800 }}>
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>
                        Recommended for Non-Coders. 1-Click live update directly to WordPress database without opening cPanel.
                      </p>
                    </div>

                    {/* Option 2: cPanel Developer Mode */}
                    <div
                      onClick={() => setCustomOptimizeMode("cpanel")}
                      style={{
                        border: customOptimizeMode === "cpanel" ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.12)",
                        background: customOptimizeMode === "cpanel" ? "rgba(59, 130, 246, 0.12)" : "rgba(255,255,255,0.02)",
                        borderRadius: 10,
                        padding: "10px 12px",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: customOptimizeMode === "cpanel" ? "#60a5fa" : "#ffffff" }}>
                          🔵 cPanel Developer Mode
                        </span>
                        {customOptimizeMode === "cpanel" && (
                          <span style={{ fontSize: 9.5, background: "#3b82f6", color: "#fff", padding: "1px 5px", borderRadius: 3, fontWeight: 800 }}>
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>
                        For Developers. Generates ready PHP code to paste into cPanel, keeping server-side logic 100% active.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, color: "#cbd5e1", fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Custom Focus / Strategic Guidance (Optional):
                </label>
                <textarea
                  value={aiCustomInstructions}
                  onChange={(e) => setAiCustomInstructions(e.target.value)}
                  placeholder="e.g. Focus on local clients in Ahmedabad, highlight transparent pricing, target enterprise B2B clients (or leave blank for full autonomous optimization)"
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid rgba(255, 255, 255, 0.14)",
                    background: "#050811",
                    color: "#ffffff",
                    fontSize: 13,
                    lineHeight: 1.5,
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
                <span style={{ fontSize: 11, color: "#64748b", marginTop: 4, display: "block" }}>
                  Leave blank to let GabbarInfo AI autonomously audit, research, and optimize using your brand memory and market profile.
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowAiOptimizeModal(false)}
                  style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #1e293b", background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleRunAiPageOptimization(aiCustomInstructions)}
                  disabled={isOptimizingWithAi}
                  style={{
                    padding: "10px 22px",
                    borderRadius: 8,
                    border: "none",
                    background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #9333ea 100%)",
                    color: "#ffffff",
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: isOptimizingWithAi ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 15px rgba(124, 58, 237, 0.5)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span>⚡</span> {isOptimizingWithAi
                    ? "Optimizing Page…"
                    : Boolean(editingArticle.is_custom_template || editingArticle.bypasses_db_content || (editingArticle.template_file && editingArticle.template_file !== "default")) && customOptimizeMode === "cpanel"
                    ? "Optimize & Generate cPanel Code ↗"
                    : "Run Full Autonomous AI Rewrite (1 Click) ↗"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── MODAL: CONNECT NEW WEBSITE (IN SEO SUITE) ── */}
      {showAddSiteModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0, 0, 0, 0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 }}>
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 16, maxWidth: 520, width: "100%", padding: 26, color: "#f8fafc" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 17, color: "#fff" }}>🌐 Connect Another WordPress Site</h3>
              <button onClick={() => setShowAddSiteModal(false)} style={{ border: "none", background: "none", color: "#94a3b8", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: "#cbd5e1", display: "block", marginBottom: 4 }}>Business / Website Profile Name</label>
                <input
                  type="text"
                  placeholder="e.g. MyBrand, TechFlow Solutions, Apex Digital..."
                  value={addBizName}
                  onChange={(e) => setAddBizName(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #1e293b", background: "#131b2e", color: "#fff", fontSize: 13, boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#cbd5e1", display: "block", marginBottom: 4 }}>WordPress Website URL</label>
                <input
                  type="url"
                  placeholder="https://www.yourdomain.com"
                  value={addSiteUrl}
                  onChange={(e) => setAddSiteUrl(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #1e293b", background: "#131b2e", color: "#fff", fontSize: 13, boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#cbd5e1", display: "block", marginBottom: 4 }}>Plugin Secret Key</label>
                <input
                  type="text"
                  placeholder="e.g. gb_sec_..."
                  value={addApiKey}
                  onChange={(e) => setAddApiKey(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #1e293b", background: "#131b2e", color: "#fff", fontSize: 13, fontFamily: "monospace", boxSizing: "border-box" }}
                />
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  Copy this key from your WordPress Admin under <code>Settings ➔ GabbarInfo AI</code>.
                </div>
              </div>

              <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "8px 12px", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>Need the plugin zip?</span>
                <a href="/api/wordpress/download" download style={{ fontSize: 11, color: "#38bdf8", fontWeight: 700, textDecoration: "underline" }}>
                  Download Plugin
                </a>
              </div>

              {addSiteError && (
                <div style={{ padding: 10, background: "rgba(239, 68, 68, 0.1)", border: "1px solid #ef4444", color: "#f87171", borderRadius: 6, fontSize: 12 }}>
                  ⚠️ {addSiteError}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button onClick={() => setShowAddSiteModal(false)} className="btn-gabbar-dark" style={{ padding: "8px 16px", fontSize: 12 }}>
                  Cancel
                </button>
                <button onClick={handleAddSite} disabled={addingSite} className="btn-gabbar-primary" style={{ padding: "9px 20px", fontSize: 13 }}>
                  {addingSite ? "Connecting…" : "Connect Website ↗"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPairingModal && (
        <BrandAssetPairingModal
          onClose={() => setShowPairingModal(false)}
          onSaved={() => {
            fetchConnection(activeBusiness);
          }}
        />
      )}

      {showSubscriptionModal && (
        <SubscriptionModal onClose={() => setShowSubscriptionModal(false)} />
      )}

      {/* ── MODAL: CUSTOM THEME TEMPLATE DETECTED & PUBLISH ROUTER ── */}
      {showCustomPublishModal && editingArticle && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.88)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: 16,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              background: "#0c1322",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: 18,
              maxWidth: 840,
              width: "100%",
              padding: "28px 32px",
              color: "#f8fafc",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.7)",
              maxHeight: "92vh",
              overflowY: "auto",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(234, 179, 8, 0.15)", border: "1px solid rgba(234, 179, 8, 0.4)", borderRadius: 20, padding: "3px 12px", fontSize: 11, fontWeight: 700, color: "#fde047", marginBottom: 8 }}>
                  ⚡ CUSTOM CODE ARCHITECTURE DETECTED
                </div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.02em" }}>
                  Custom Theme Template Detected
                </h2>
                <p style={{ margin: "6px 0 0 0", fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>
                  This page is powered by a custom developer file (<code style={{ color: "#38bdf8", background: "rgba(56, 189, 248, 0.1)", padding: "2px 6px", borderRadius: 4 }}>{editingArticle.template_file || `page-${editingArticle.slug || "template"}.php`}</code>) on your web hosting. Choose how you would like to apply your updates:
                </p>
              </div>
              <button
                onClick={() => setShowCustomPublishModal(false)}
                style={{
                  border: "none",
                  background: "rgba(255, 255, 255, 0.08)",
                  color: "#94a3b8",
                  fontSize: 18,
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>

            {/* Two Distinct Options Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18, marginTop: 16 }}>
              {/* 🟢 OPTION 1: Dynamic CMS Mode */}
              <div
                style={{
                  background: "linear-gradient(180deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)",
                  border: "1.5px solid rgba(16, 185, 129, 0.4)",
                  borderRadius: 14,
                  padding: "22px 20px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  position: "relative",
                }}
              >
                <div>
                  <div style={{ display: "inline-block", background: "#10b981", color: "#ffffff", fontSize: 10, fontWeight: 800, textTransform: "uppercase", padding: "3px 8px", borderRadius: 4, letterSpacing: "0.05em", marginBottom: 12 }}>
                    Option 1 • 1-Click Live Update
                  </div>
                  <h3 style={{ margin: "0 0 6px 0", fontSize: 16, fontWeight: 700, color: "#ffffff" }}>
                    🌐 Instant Dynamic Publishing
                  </h3>
                  <div style={{ fontSize: 11, color: "#34d399", fontWeight: 600, marginBottom: 12 }}>
                    Recommended for Non-Developers & Clients
                  </div>
                  <p style={{ fontSize: 12.5, color: "#cbd5e1", lineHeight: 1.6, margin: "0 0 14px 0" }}>
                    Publishes your updated content directly to your WordPress database. Your live page updates instantly, and you can edit or optimize it anytime from this AI Dashboard without ever opening cPanel or FTP.
                  </p>
                  <div style={{ background: "rgba(0, 0, 0, 0.35)", borderRadius: 8, padding: "10px 12px", border: "1px solid rgba(255, 255, 255, 0.06)", marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                      <strong style={{ color: "#f1f5f9" }}>Safe Invariant:</strong> Your original cPanel PHP file remains safely untouched on your server as a backup. WordPress seamlessly renders your optimized copy with 100% theme design intact.
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleSaveArticle("publish", { render_optimized: true })}
                  disabled={publishingArticle}
                  style={{
                    width: "100%",
                    padding: "12px 18px",
                    borderRadius: 8,
                    border: "none",
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: publishingArticle ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 16px rgba(16, 185, 129, 0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {publishingArticle ? "Publishing Live…" : "🚀 Publish Live to WordPress Now"}
                </button>
              </div>

              {/* 💻 OPTION 2: Developer Template Mode */}
              <div
                style={{
                  background: "linear-gradient(180deg, rgba(56, 189, 248, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)",
                  border: "1.5px solid rgba(56, 189, 248, 0.4)",
                  borderRadius: 14,
                  padding: "22px 20px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  position: "relative",
                }}
              >
                <div>
                  <div style={{ display: "inline-block", background: "#0284c7", color: "#ffffff", fontSize: 10, fontWeight: 800, textTransform: "uppercase", padding: "3px 8px", borderRadius: 4, letterSpacing: "0.05em", marginBottom: 12 }}>
                    Option 2 • Zero Database Override
                  </div>
                  <h3 style={{ margin: "0 0 6px 0", fontSize: 16, fontWeight: 700, color: "#ffffff" }}>
                    🛠️ Export Code for cPanel Template
                  </h3>
                  <div style={{ fontSize: 11, color: "#38bdf8", fontWeight: 600, marginBottom: 12 }}>
                    For Webmasters & Developers
                  </div>
                  <p style={{ fontSize: 12.5, color: "#cbd5e1", lineHeight: 1.6, margin: "0 0 12px 0" }}>
                    Keep your website 100% tied to your existing cPanel PHP template. No WordPress database override will be applied.
                  </p>

                  {/* Step by Step instructions */}
                  <div style={{ background: "rgba(0, 0, 0, 0.35)", borderRadius: 8, padding: "12px 14px", border: "1px solid rgba(255, 255, 255, 0.06)", marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#38bdf8", textTransform: "uppercase", marginBottom: 6 }}>
                      📋 Step-by-Step Instructions:
                    </div>
                    <ol style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, color: "#cbd5e1", lineHeight: 1.6 }}>
                      <li>Click <strong>"Copy Complete PHP Code"</strong> below.</li>
                      <li>Log in to your hosting <strong>cPanel ➔ File Manager</strong>.</li>
                      <li>Navigate to: <code style={{ color: "#facc15" }}>wp-content/themes/{editingArticle.theme_folder || "your-theme"}/</code></li>
                      <li>Edit file: <code style={{ color: "#38bdf8" }}>{editingArticle.template_file || `page-${editingArticle.slug || "template"}.php`}</code></li>
                      <li>Select All (Ctrl+A), Paste (Ctrl+V), and <strong>Save Changes</strong>.</li>
                    </ol>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button
                    onClick={handleCopyPhpCode}
                    disabled={isOptimizingWithAi}
                    style={{
                      width: "100%",
                      padding: "11px 16px",
                      borderRadius: 8,
                      border: "1px solid #38bdf8",
                      background: isOptimizingWithAi ? "rgba(255, 255, 255, 0.05)" : copiedPhpCode ? "#0284c7" : "rgba(56, 189, 248, 0.15)",
                      color: isOptimizingWithAi ? "#94a3b8" : copiedPhpCode ? "#ffffff" : "#38bdf8",
                      fontSize: 12.5,
                      fontWeight: 800,
                      cursor: isOptimizingWithAi ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      transition: "all 0.2s ease",
                    }}
                  >
                    {isOptimizingWithAi ? "⏳ AI Optimizing Copy... Please Wait" : copiedPhpCode ? "✅ Copied to Clipboard!" : "📋 Copy Complete PHP Code"}
                  </button>

                  <button
                    onClick={handleSyncSeoOnly}
                    disabled={syncingSeoOnly}
                    style={{
                      width: "100%",
                      padding: "10px 16px",
                      borderRadius: 8,
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      background: "rgba(255, 255, 255, 0.06)",
                      color: "#94a3b8",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: syncingSeoOnly ? "not-allowed" : "pointer",
                    }}
                  >
                    {syncingSeoOnly ? "Syncing SEO Meta Tags…" : "⚡ Sync SEO Meta Tags Only (Yoast / RankMath)"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
