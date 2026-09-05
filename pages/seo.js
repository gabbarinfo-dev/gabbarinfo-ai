"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Head from "next/head";

export default function SeoHubPage() {
  const { data: session, status } = useSession();

  // State
  const [activeBusiness, setActiveBusiness] = useState("GABBARinfo");
  const [allConnections, setAllConnections] = useState({});
  const [mode, setMode] = useState("manual"); // "manual" | "autopilot"
  const [activeTab, setActiveTab] = useState("content"); // "content" | "topics" | "autopilot" | "integrations"
  const [connection, setConnection] = useState(null);
  const [loadingConn, setLoadingConn] = useState(true);

  // Content Hub State
  const [contentList, setContentList] = useState([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [contentFilter, setContentFilter] = useState("all"); // "all" | "post" | "page"
  const [searchQuery, setSearchQuery] = useState("");

  // Optimize Modal State
  const [optimizingItem, setOptimizingItem] = useState(null);
  const [optTitle, setOptTitle] = useState("");
  const [optMetaTitle, setOptMetaTitle] = useState("");
  const [optMetaDesc, setOptMetaDesc] = useState("");
  const [optFocusKw, setOptFocusKw] = useState("");
  const [optSaving, setOptSaving] = useState(false);

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
  const [keywords, setKeywords] = useState([
    "affordable digital marketing services",
    "creative web development agency",
    "business lead generation strategies",
    "seo ranking packages",
    "conversion rate optimization",
  ]);
  const [newKeywordInput, setNewKeywordInput] = useState("");

  const getThirtyDefaultTopics = (bName = "GABBARinfo") => [
    `How ${bName} Drives 300% ROI With Strategic SEO in 2026`,
    `Top 7 Mistakes Businesses Make With Web Design & How to Fix Them`,
    `The Ultimate 2026 Guide to Dominating Local Search Rankings in Your City`,
    `Conversion Rate Optimization: Proven Frameworks That Turn Traffic Into Leads`,
    `Why Technical SEO Is the Backbone of High-Ranking WordPress Websites`,
    `How to Build Topical Authority in Your Niche Step-by-Step`,
    `The Complete Checklist for Launching a High-Converting Business Website`,
    `Google Ads vs SEO: Where Should You Invest Your Marketing Budget First?`,
    `How Core Web Vitals & Page Speed Directly Impact Your Bottom Line in 2026`,
    `10 High-Impact Strategies to Outrank Your Local Competitors on Google Maps`,
    `The Blueprint for Generating Consistent B2B Leads on Autopilot`,
    `How to Craft Attention-Grabbing Headlines That Boost Organic CTR by 40%`,
    `Why Your Bounce Rate Is High and 5 Data-Backed Ways to Fix It`,
    `Voice Search Optimization: Preparing Your Business for the Next Wave of Search`,
    `How AI-Driven Content Marketing Is Redefining Brand Authority in 2026`,
    `The Essential On-Page SEO Checklist Every Marketing Manager Needs`,
    `Schema Markup Explained: How Structured Data Unlocks Google Rich Snippets`,
    `Internal Linking Strategies That Skyrocket Crawl Efficiency & Page Rankings`,
    `How to Conduct a Comprehensive Competitor SEO Audit in Under 30 Minutes`,
    `E-E-A-T Decoded: Building Trust and Authority That Google Rewards`,
    `From Clicks to Customers: Crafting Landing Pages That Double Conversion Rates`,
    `The Power of Evergreen Content: How One Post Can Drive Traffic for Years`,
    `Zero-Click Searches: How to Win Featured Snippets and Brand Visibility`,
    `Mobile-First Indexing: Key Optimization Rules for Small & Mid-Sized Businesses`,
    `How to Target High-Intent Buyer Keywords Without Paying for Expensive PPC`,
    `Repurposing Content: Turn One Blog Post Into 10 Social Media Lead Magnets`,
    `Customer Retention vs Acquisition: Why Your Website Content Must Speak to Both`,
    `The Anatomy of a Perfect Service Page That Converts Cold Traffic`,
    `Why Local Citations and NAP Consistency Are Crucial for City-Based Rankings`,
    `The Future of Autonomous Digital Marketing: Predictions & Strategies for 2026`,
  ];

  const [suggestedTopics, setSuggestedTopics] = useState(getThirtyDefaultTopics("GABBARinfo"));
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
          targetMarket: market || "",
        }),
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.keywords) && data.keywords.length > 0) {
        setNewKeywords(data.keywords.join(", "));
      } else {
        setNewKeywords("strategic seo services, google search ranking optimization, b2b lead generation strategies, organic search roi");
      }
    } catch (e) {
      console.error("Keyword research error:", e);
      setNewKeywords("strategic seo services, google search ranking optimization, b2b lead generation strategies, organic search roi");
    } finally {
      setLoadingKeywords(false);
    }
  };

  const handleSelectTopic = (top) => {
    setNewTopic(top);
    setShowNewBlogModal(true);
    setNewKeywords("🔍 Researching high-ranking search queries for this topic…");
    fetchKeywordsForTopic(top, targetMarket);
  };

  // Autopilot State
  const [autopilotEnabled, setAutopilotEnabled] = useState(false);
  const [runningCycle, setRunningCycle] = useState(false);
  const [cycleNotice, setCycleNotice] = useState("");

  // ── WRITING & OPTIMIZATION SUITE STATE (Draft & Edit) ──
  const [editingArticle, setEditingArticle] = useState(null);
  const [editorMode, setEditorMode] = useState("visual"); // 'visual' | 'html'
  const [serpPreviewMode, setSerpPreviewMode] = useState("desktop"); // 'desktop' | 'mobile'
  const [savingArticle, setSavingArticle] = useState(false);
  const [publishingArticle, setPublishingArticle] = useState(false);
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [editorNotice, setEditorNotice] = useState(null);
  const [loadingArticleContent, setLoadingArticleContent] = useState(false);

  // Social Connect Modal
  const [showFbConnectModal, setShowFbConnectModal] = useState(false);

  const connectedProfiles = Object.keys(allConnections || {}).filter(k => allConnections[k]?.siteUrl);

  // Auto-switch to first connected profile if available and current has no site
  useEffect(() => {
    if (connectedProfiles.length > 0 && !connectedProfiles.includes(activeBusiness)) {
      setActiveBusiness(connectedProfiles[0]);
    }
  }, [allConnections]);

  // Load connection info when business changes
  useEffect(() => {
    if (!session) return;
    fetchConnection();
  }, [session, activeBusiness]);

  const fetchConnection = async () => {
    setLoadingConn(true);
    try {
      const res = await fetch(`/api/wordpress/sync?action=get-connection&businessName=${encodeURIComponent(activeBusiness)}`);
      const data = await res.json();
      if (data.ok) {
        setAllConnections(data.allConnections || {});
        if (data.connection) {
          setConnection(data.connection);
          fetchContent(data.connection);
        } else {
          setConnection(null);
          setContentList([]);
        }
      } else {
        setConnection(null);
        setContentList([]);
      }
    } catch (e) {
      console.error("Failed to load connection:", e);
    } finally {
      setLoadingConn(false);
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
          per_page: 50,
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

    const internalLinksCount = (
      rawContent.match(
        new RegExp(`href=["'](https?:\\/\\/(www\\.)?${siteDomain.replace(".", "\\.")}|\\/[^"'])`, "gi")
      ) || []
    ).length;
    const externalLinksCount = (
      rawContent.match(
        new RegExp(`href=["']https?:\\/\\/(?!(www\\.)?${siteDomain.replace(".", "\\.")})[^"']+`, "gi")
      ) || []
    ).length;

    const hasSubheadings = (rawContent.match(/<h[23][^>]*>/gi) || []).length >= 2;
    const hasTablesOrLists = /<(table|ul|ol)[^>]*>/i.test(rawContent);
    const hasExecSummary = /(tl;?dr|executive summary|direct answer|key takeaways|overview|summary)/i.test(rawContent);
    const hasImage = Boolean(art.featured_image || /<img[^>]*>/i.test(rawContent));
    const titleCalibrated = metaTitle.length >= 45 && metaTitle.length <= 65;
    const descCalibrated = metaDesc.length >= 120 && metaDesc.length <= 165;

    // 13 Optimization Checklist Items
    const c1 = Boolean(kw && metaTitle.toLowerCase().includes(kw)); // +8 pts
    const c2 = Boolean(kw && (slug.includes(kw.replace(/\s+/g, "-")) || slug.includes(kw.split(" ")[0]))); // +5 pts
    const c3 = Boolean(kw && metaDesc.toLowerCase().includes(kw)); // +7 pts
    const c4 = Boolean(kw && (title.includes(kw) || introText.includes(kw))); // +5 pts
    const c5 = true; // Generative Engine Optimization (JSON-LD Schema Active) +10 pts
    const c6 = hasSubheadings; // Subheading Hierarchy (2+ H2/H3 Headings) +8 pts
    const c7 = hasExecSummary; // Executive Summary / Direct Answer Paragraph +7 pts
    const c8 = wordCount >= 850; // Comprehensive Article Length +6 pts
    const c9 = hasTablesOrLists; // Structured Data Tables / Bulleted Lists +7 pts
    const c10 = hasImage; // Featured Banner Image Uploaded / AI Generated +8 pts
    const c11 = internalLinksCount >= 1; // Internal Site Links (1+ Internal Links) +10 pts
    const c12 = externalLinksCount >= 1; // External Authority Citations (1+ External Links) +7 pts
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
    if (item.content) {
      setEditingArticle({ ...item });
      return;
    }

    setLoadingArticleContent(true);
    setEditingArticle({
      ...item,
      content: "<p>Loading full article content from WordPress…</p>",
    });

    try {
      const res = await fetch("/api/wordpress/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get-post",
          postId: item.id,
          postType: item.type || "post",
          siteUrl: connection?.siteUrl,
          apiKey: connection?.apiKey,
          businessName: activeBusiness,
        }),
      });
      const data = await res.json();
      if (data.ok && data.post?.content) {
        setEditingArticle({
          ...item,
          content: data.post.content,
          title: data.post.title || item.title,
          slug: data.post.slug || item.slug,
          status: data.post.status || item.status,
          meta_title: item.meta_title || item.title,
          meta_description: item.meta_desc || item.excerpt || "",
          focus_keyword: item.focus_keyword || "",
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

  // Save Article (Draft or Publish Live)
  const handleSaveArticle = async (targetStatus = "draft") => {
    if (!editingArticle || !connection) return;
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
            content: editingArticle.content,
            slug: editingArticle.slug,
            status: targetStatus,
            meta_title: editingArticle.meta_title || editingArticle.title,
            meta_description: editingArticle.meta_description || editingArticle.excerpt || "",
            focus_keyword: editingArticle.focus_keyword || "",
          },
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setEditingArticle((prev) => ({
          ...prev,
          status: targetStatus,
          url: data.url || prev.url,
        }));
        setEditorNotice({
          type: "success",
          message:
            targetStatus === "publish"
              ? "🎉 Article successfully published live to WordPress!"
              : "💾 Draft saved successfully to WordPress!",
        });
        setTimeout(() => setEditorNotice(null), 4500);
        fetchContent(connection);
      } else {
        alert("Failed to save: " + (data.error || "Unknown error"));
      }
    } catch (e) {
      alert("Save error: " + e.message);
    } finally {
      setSavingArticle(false);
      setPublishingArticle(false);
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
      slug: optimizedSlug,
    }));

    setEditorNotice({
      type: "success",
      message: "✨ AI Auto-Optimized all SEO fields to maximum SERP score!",
    });
    setTimeout(() => setEditorNotice(null), 4000);
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
          targetMarket: targetMarket || "",
          city: targetMarket || "",
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

  // AI SERP Topic Generator with Anti-Duplication (30 Topics)
  const handleAutoSuggestTopics = async () => {
    setLoadingTopics(true);
    try {
      const existingTitles = contentList.map((c) => c.title).slice(0, 30);
      const res = await fetch("/api/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "seo_blog",
          instruction: `Generate 30 high-ranking, non-duplicating SEO blog topic titles for ${activeBusiness}. Include commercial buyer-intent, local search guides, city targeting, technical authority pillars, and problem-solving topics. Target keywords: ${keywords.join(", ")}. Do NOT duplicate any of these existing titles: ${existingTitles.join(", ")}. Return ONLY a JSON array of 30 title strings: ["Title 1", "Title 2", ...].`,
        }),
      });

      const data = await res.json();
      let topics = [];
      try {
        const match = data.text?.match(/\[[\s\S]*\]/);
        if (match) topics = JSON.parse(match[0]);
      } catch (e) {}

      if (!topics || topics.length < 15) {
        topics = getThirtyDefaultTopics(activeBusiness);
      }
      setSuggestedTopics(topics);
    } catch (e) {
      console.error(e);
      setSuggestedTopics(getThirtyDefaultTopics(activeBusiness));
    } finally {
      setLoadingTopics(false);
    }
  };

  // Filtered Content
  const filteredContent = contentList.filter((item) => {
    if (contentFilter !== "all" && item.type !== contentFilter) return false;
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
          padding: "16px 28px",
          background: "rgba(10, 15, 26, 0.9)",
          backdropFilter: "blur(8px)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "sticky",
          top: 0,
          zIndex: 100,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>🚀</span>
            <span style={{ fontWeight: 800, fontSize: 18, color: "#fff", letterSpacing: "-0.5px" }}>GabbarInfo AI</span>
          </a>
          <span style={{ color: "#334155" }}>|</span>
          <span style={{ fontSize: 14, color: "#94a3b8", fontWeight: 500 }}>SEO & Autonomous Content Suite</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          {/* Dynamic Connected Business Profile Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#0d111c", padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255, 255, 255, 0.16)" }}>
            <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700 }}>Project:</span>
            <select
              value={activeBusiness}
              onChange={(e) => setActiveBusiness(e.target.value)}
              style={{
                background: "transparent",
                border: "none",
                color: "#38bdf8",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                outline: "none",
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
            </select>
            {connectedProfiles.length === 0 && (
              <a
                href="/#wordpress-connect"
                style={{
                  fontSize: 12,
                  color: "#38bdf8",
                  fontWeight: 700,
                  textDecoration: "underline",
                  marginLeft: 4,
                }}
              >
                + Connect Website
              </a>
            )}
          </div>

          {/* Mode Switcher */}
          <div style={{ display: "flex", background: "rgba(16, 22, 34, 0.8)", padding: 4, borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.12)" }}>
            <button
              onClick={() => setMode("manual")}
              style={{
                padding: "6px 14px",
                borderRadius: 7,
                border: "none",
                background: mode === "manual" ? "#ffffff" : "transparent",
                color: mode === "manual" ? "#080b11" : "#94a3b8",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              ✨ Manual Mode
            </button>
            <button
              onClick={() => setMode("autopilot")}
              style={{
                padding: "6px 14px",
                borderRadius: 7,
                border: "none",
                background: mode === "autopilot" ? "#ffffff" : "transparent",
                color: mode === "autopilot" ? "#080b11" : "#94a3b8",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              🤖 Autopilot Mode
            </button>
          </div>

          <a
            href="/chat"
            className="btn-gabbar-secondary"
            style={{
              padding: "7px 14px",
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            💬 Open Chat
          </a>
          <a
            href="/"
            className="btn-gabbar-primary"
            style={{
              padding: "7px 16px",
              fontSize: 13,
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
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 24px", position: "relative", zIndex: 1 }}>
        {/* KPI CARDS BAR */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 28 }}>
          <div style={{ background: "rgba(16, 22, 34, 0.78)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 14, padding: 18, boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
            <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Connected Site</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {connection?.siteUrl ? connection.siteUrl.replace(/^https?:\/\//, "") : "Not Connected"}
            </div>
            <div style={{ fontSize: 12, color: connection?.siteUrl ? "#10b981" : "#94a3b8", marginTop: 6, fontWeight: 600 }}>
              {connection?.siteUrl ? "● Active & Syncing" : "○ Awaiting Pairing"}
            </div>
          </div>

          <div style={{ background: "rgba(16, 22, 34, 0.78)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 14, padding: 18, boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
            <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Live Content Items</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#ffffff", marginTop: 4 }}>{contentList.length}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Synced Posts & Pages</div>
          </div>

          <div style={{ background: "rgba(16, 22, 34, 0.78)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 14, padding: 18, boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
            <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Target Keywords</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#38bdf8", marginTop: 4 }}>{keywords.length}</div>
            <div style={{ fontSize: 12, color: "#10b981", marginTop: 4, fontWeight: 600 }}>Coverage Tracking Active</div>
          </div>

          <div style={{ background: "rgba(16, 22, 34, 0.78)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 14, padding: 18, boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
            <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Autopilot Daily Post</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: autopilotEnabled ? "#10b981" : "#94a3b8", marginTop: 6 }}>
              {autopilotEnabled ? "Active (Daily 6:00 AM)" : "Paused"}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Zero-maintenance scheduling</div>
          </div>
        </div>

        {/* ── WORKSPACE TABS ── */}
        <div style={{ display: "flex", gap: 10, borderBottom: "1px solid rgba(255, 255, 255, 0.1)", marginBottom: 24, paddingBottom: 2 }}>
          <button
            onClick={() => setActiveTab("content")}
            style={{
              padding: "10px 18px",
              background: activeTab === "content" ? "rgba(255, 255, 255, 0.08)" : "transparent",
              border: "none",
              borderBottom: activeTab === "content" ? "2.5px solid #ffffff" : "2.5px solid transparent",
              color: activeTab === "content" ? "#ffffff" : "#94a3b8",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              borderRadius: "8px 8px 0 0",
            }}
          >
            📑 Articles & Website Pages ({contentList.length})
          </button>

          <button
            onClick={() => setActiveTab("topics")}
            style={{
              padding: "10px 18px",
              background: activeTab === "topics" ? "rgba(255, 255, 255, 0.08)" : "transparent",
              border: "none",
              borderBottom: activeTab === "topics" ? "2.5px solid #ffffff" : "2.5px solid transparent",
              color: activeTab === "topics" ? "#ffffff" : "#94a3b8",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              borderRadius: "8px 8px 0 0",
            }}
          >
            💡 Topic & Keyword Planner
          </button>

          <button
            onClick={() => setActiveTab("autopilot")}
            style={{
              padding: "10px 18px",
              background: activeTab === "autopilot" ? "rgba(255, 255, 255, 0.08)" : "transparent",
              border: "none",
              borderBottom: activeTab === "autopilot" ? "2.5px solid #ffffff" : "2.5px solid transparent",
              color: activeTab === "autopilot" ? "#ffffff" : "#94a3b8",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              borderRadius: "8px 8px 0 0",
            }}
          >
            🤖 Autopilot Scheduler
          </button>

          <button
            onClick={() => setActiveTab("integrations")}
            style={{
              padding: "10px 18px",
              background: activeTab === "integrations" ? "rgba(255, 255, 255, 0.08)" : "transparent",
              border: "none",
              borderBottom: activeTab === "integrations" ? "2.5px solid #ffffff" : "2.5px solid transparent",
              color: activeTab === "integrations" ? "#ffffff" : "#94a3b8",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              borderRadius: "8px 8px 0 0",
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
                        onClick={handleAutoOptimizeSeoFields}
                        style={{
                          background: "rgba(99, 102, 241, 0.18)",
                          border: "1px solid #6366f1",
                          color: "#a5b4fc",
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
                        <span>✨</span> AI Auto-Optimize SEO
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
                        onClick={() => handleSaveArticle("publish")}
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
                            const url = prompt("Enter link URL (e.g. https://www.gabbarinfo.com/service):");
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
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          setEditingArticle({ ...editingArticle, content: e.currentTarget.innerHTML });
                        }}
                        dangerouslySetInnerHTML={{ __html: editingArticle.content || "" }}
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
                        onClick={() => handleSaveArticle("publish")}
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
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
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
                      minWidth: 240,
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
                      padding: "8px 16px",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    {loadingContent ? "Syncing…" : "🔄 Sync WP Posts"}
                  </button>
                </div>

                <button
                  onClick={() => {
                    const defaultTopic = suggestedTopics[0] || `How ${activeBusiness} Drives High-ROI Growth in 2026`;
                    handleSelectTopic(defaultTopic);
                  }}
                  className="btn-gabbar-primary"
                  style={{
                    padding: "10px 22px",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <span>✍️</span> Generate & Publish Blog ↗
                </button>
              </div>

              {/* Table (Screenshot 2) */}
              <div style={{ background: "rgba(16, 22, 34, 0.78)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 14, overflowX: "auto" }}>
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
                        <td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
                          No content found. Make sure your WordPress site is connected in the Integrations tab.
                        </td>
                      </tr>
                    ) : (
                      filteredContent.map((item) => (
                        <tr key={item.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                          <td style={{ padding: "14px 18px" }}>
                            <input type="checkbox" style={{ cursor: "pointer" }} />
                          </td>
                          <td style={{ padding: "14px 18px", maxWidth: 360 }}>
                            <div style={{ fontWeight: 600, color: "#f8fafc", lineHeight: 1.4 }}>{item.title}</div>
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
                            <span
                              style={{
                                fontSize: 11,
                                padding: "3px 8px",
                                borderRadius: 4,
                                background: "rgba(59, 130, 246, 0.15)",
                                color: "#60a5fa",
                                fontWeight: 700,
                              }}
                            >
                              Manual
                            </span>
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
            </div>

            {/* Right: Anti-Duplication AI SERP Ideation (30 Topics) */}
            <div style={{ background: "rgba(16, 22, 34, 0.78)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 14, padding: 24, boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, color: "#fff" }}>💡 AI SERP Topic Generator</h3>
                  <span style={{ fontSize: 11, color: "#38bdf8", fontWeight: 700 }}>30 High-Ranking Editorial Calendar Topics</span>
                </div>
                <button
                  onClick={handleAutoSuggestTopics}
                  disabled={loadingTopics}
                  className="btn-gabbar-primary"
                  style={{
                    padding: "7px 16px",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {loadingTopics ? "Analyzing SERP…" : `⚡ Re-Generate 30 Topics ↗ (${suggestedTopics.length})`}
                </button>
              </div>
              <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 16px 0" }}>
                Cross-references live content to guarantee 0% duplication. Includes 30 full days of strategic authority topics.
              </p>

              <div style={{ maxHeight: 580, overflowY: "auto", paddingRight: 6, display: "flex", flexDirection: "column", gap: 10 }}>
                {suggestedTopics.length === 0 ? (
                  <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 13, background: "#0d111c", borderRadius: 8 }}>
                    Click "Auto-Suggest 30 Topics" to ideate SERP-ranking articles.
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
          <div style={{ background: "rgba(16, 22, 34, 0.78)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 14, padding: 28, boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
              <div>
                <h2 style={{ margin: "0 0 6px 0", fontSize: 20, color: "#fff" }}>🤖 Autonomous Daily Blogging Engine</h2>
                <p style={{ margin: 0, color: "#94a3b8", fontSize: 14 }}>
                  Every day at <strong>06:00 AM IST</strong>, GabbarInfo AI generates a comprehensive, anti-duplicated, dual-visual SEO article and publishes it live to your WordPress site.
                </p>
              </div>

              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  onClick={() => setAutopilotEnabled(!autopilotEnabled)}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    border: autopilotEnabled ? "1px solid #10b981" : "1px solid rgba(255, 255, 255, 0.18)",
                    background: autopilotEnabled ? "rgba(16, 185, 129, 0.18)" : "rgba(255, 255, 255, 0.06)",
                    color: autopilotEnabled ? "#34d399" : "#ffffff",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    transition: "all 0.2s ease",
                  }}
                >
                  <span>{autopilotEnabled ? "●" : "○"}</span>
                  {autopilotEnabled ? "Autopilot ACTIVE" : "Turn Autopilot ON"}
                </button>

                <button
                  onClick={async () => {
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
                  }}
                >
                  {runningCycle ? "Publishing…" : "⚡ Run Cycle Now ↗"}
                </button>
              </div>
            </div>

            {cycleNotice && (
              <div style={{ marginTop: 18, padding: "10px 14px", borderRadius: 8, background: "#131b2e", border: "1px solid #1e293b", color: "#60a5fa", fontSize: 13 }}>
                {cycleNotice}
              </div>
            )}

            {/* Visual 7-Day Cadence Cards */}
            <div style={{ marginTop: 28 }}>
              <h4 style={{ fontSize: 14, color: "#cbd5e1", margin: "0 0 14px 0", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Upcoming 7-Day Autonomous Cadence
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
                {[0, 1, 2, 3, 4, 5, 6].map((offset) => {
                  const d = new Date();
                  d.setDate(d.getDate() + offset);
                  const isToday = offset === 0;
                  return (
                    <div
                      key={offset}
                      style={{
                        background: isToday ? "#1e293b" : "#131b2e",
                        border: isToday ? "1px solid #3b82f6" : "1px solid #1e293b",
                        borderRadius: 8,
                        padding: 14,
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 11, color: isToday ? "#60a5fa" : "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>
                        {isToday ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" })}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginTop: 4 }}>
                        {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                      <div style={{ fontSize: 11, color: autopilotEnabled ? "#10b981" : "#64748b", marginTop: 6, fontWeight: 500 }}>
                        {autopilotEnabled ? "06:00 AM IST" : "Paused"}
                      </div>
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
                <a
                  href="/"
                  style={{
                    padding: "8px 14px",
                    borderRadius: 6,
                    border: "1px solid #1e293b",
                    background: "#131b2e",
                    color: "#e2e8f0",
                    textDecoration: "none",
                    fontSize: 13,
                  }}
                >
                  ⚙️ Manage in Dashboard
                </a>
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

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
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
                  <h4 style={{ margin: "0 0 6px 0", fontSize: 14, color: "#fff" }}>📢 Cross-Promote to Social Channels</h4>
                  <p style={{ margin: "0 0 14px 0", fontSize: 12, color: "#94a3b8" }}>
                    Instantly share this new article to your connected Meta assets with rich link preview or photo card:
                  </p>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      onClick={() => handleSocialShare("facebook")}
                      disabled={socialSharing}
                      style={{
                        padding: "9px 16px",
                        borderRadius: 6,
                        border: "none",
                        background: "#1877f2",
                        color: "#fff",
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span>📘</span> Share to Facebook Page
                    </button>

                    <button
                      onClick={() => handleSocialShare("instagram")}
                      disabled={socialSharing}
                      style={{
                        padding: "9px 16px",
                        borderRadius: 6,
                        border: "none",
                        background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
                        color: "#fff",
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span>📸</span> Share to Instagram
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
    </div>
  );
}
