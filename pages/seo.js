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
  const [suggestedTopics, setSuggestedTopics] = useState([]);
  const [loadingTopics, setLoadingTopics] = useState(false);

  // Autopilot State
  const [autopilotEnabled, setAutopilotEnabled] = useState(false);
  const [runningCycle, setRunningCycle] = useState(false);
  const [cycleNotice, setCycleNotice] = useState("");

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

  // Generate Blog handler
  const handleGenerateBlog = async (customTopic) => {
    const topicToUse = customTopic || newTopic;
    if (!topicToUse) {
      alert("Please enter a blog topic.");
      return;
    }

    setGeneratingBlog(true);
    setPublishedResult(null);
    setSocialShareStatus(null);

    try {
      const res = await fetch("/api/wordpress/generate-blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: activeBusiness,
          topic: topicToUse,
          targetKeywords: newKeywords ? newKeywords.split(",").map((k) => k.trim()) : keywords,
          wordCount: newWordCount,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setPublishedResult(data);
        fetchContent(connection);
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
      } else if (data.ok) {
        setSocialShareStatus({ ok: true, platform, message: `Successfully shared to ${platform === "facebook" ? "Facebook Page" : "Instagram"}!` });
      } else {
        setSocialShareStatus({ ok: false, platform, message: "Share failed: " + (data.error || "Check permissions") });
      }
    } catch (e) {
      setSocialShareStatus({ ok: false, platform, message: "Share error: " + e.message });
    } finally {
      setSocialSharing(false);
    }
  };

  // AI SERP Topic Generator with Anti-Duplication
  const handleAutoSuggestTopics = async () => {
    setLoadingTopics(true);
    try {
      const existingTitles = contentList.map((c) => c.title).slice(0, 20);
      const res = await fetch("/api/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "seo_blog",
          instruction: `Generate 6 high-ranking, non-duplicating SEO blog topic titles for ${activeBusiness}. Target keywords: ${keywords.join(", ")}. Do NOT duplicate any of these existing titles: ${existingTitles.join(", ")}. Return only a JSON array of title strings.`,
        }),
      });

      const data = await res.json();
      let topics = [];
      try {
        const match = data.text?.match(/\[[\s\S]*\]/);
        if (match) topics = JSON.parse(match[0]);
      } catch (e) {}

      if (!topics || topics.length === 0) {
        topics = [
          `How ${activeBusiness} Drives 300% ROI With Strategic SEO in 2026`,
          `Top 7 Mistakes Businesses Make With Web Design & How to Fix Them`,
          `The Ultimate 2026 Guide to Dominating Local Search Rankings`,
          `Conversion Rate Optimization: Proven Frameworks That Turn Traffic Into Leads`,
          `Why Technical SEO Is the Backbone of High-Ranking WordPress Websites`,
          `How to Build Topical Authority in Your Niche Step-by-Step`,
        ];
      }
      setSuggestedTopics(topics);
    } catch (e) {
      console.error(e);
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#131b2e", padding: "6px 14px", borderRadius: 8, border: "1.5px solid rgba(245, 183, 22, 0.35)" }}>
            <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700 }}>Project:</span>
            <select
              value={activeBusiness}
              onChange={(e) => setActiveBusiness(e.target.value)}
              style={{
                background: "transparent",
                border: "none",
                color: "#F5B716",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                outline: "none",
              }}
            >
              {connectedProfiles.length > 0 ? (
                connectedProfiles.map((name) => (
                  <option key={name} value={name} style={{ background: "#0f172a", color: "#fff" }}>
                    ✓ {name} ({allConnections[name]?.siteUrl})
                  </option>
                ))
              ) : (
                <option value="none" style={{ background: "#0f172a", color: "#F5B716" }}>
                  [ No Website Connected Yet ]
                </option>
              )}
            </select>
            {connectedProfiles.length === 0 && (
              <a
                href="/#wordpress-connect"
                style={{
                  fontSize: 12,
                  color: "#F5B716",
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
          <div style={{ display: "flex", background: "#131b2e", padding: 3, borderRadius: 8, border: "1.5px solid rgba(245, 183, 22, 0.3)" }}>
            <button
              onClick={() => setMode("manual")}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "none",
                background: mode === "manual" ? "#F5B716" : "transparent",
                color: mode === "manual" ? "#000000" : "#94a3b8",
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
                borderRadius: 6,
                border: "none",
                background: mode === "autopilot" ? "#F5B716" : "transparent",
                color: mode === "autopilot" ? "#000000" : "#94a3b8",
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
            className="btn-gabbar-dark"
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
            className="btn-gabbar-gold"
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

      {/* ── MAIN WORKSPACE CONTAINER ── */}
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 24px" }}>
        {/* KPI CARDS BAR */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 28 }}>
          <div style={{ background: "#0f172a", border: "1.5px solid rgba(245, 183, 22, 0.25)", borderRadius: 12, padding: 18, boxShadow: "0 4px 14px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Connected Site</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {connection?.siteUrl ? connection.siteUrl.replace(/^https?:\/\//, "") : "Not Connected"}
            </div>
            <div style={{ fontSize: 12, color: connection?.siteUrl ? "#10b981" : "#F5B716", marginTop: 6, fontWeight: 600 }}>
              {connection?.siteUrl ? "● Active & Syncing" : "○ Awaiting Pairing"}
            </div>
          </div>

          <div style={{ background: "#0f172a", border: "1.5px solid rgba(245, 183, 22, 0.25)", borderRadius: 12, padding: 18, boxShadow: "0 4px 14px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Live Content Items</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#F5B716", marginTop: 4 }}>{contentList.length}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Synced Posts & Pages</div>
          </div>

          <div style={{ background: "#0f172a", border: "1.5px solid rgba(245, 183, 22, 0.25)", borderRadius: 12, padding: 18, boxShadow: "0 4px 14px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Target Keywords</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#F5B716", marginTop: 4 }}>{keywords.length}</div>
            <div style={{ fontSize: 12, color: "#10b981", marginTop: 4, fontWeight: 600 }}>Coverage Tracking Active</div>
          </div>

          <div style={{ background: "#0f172a", border: "1.5px solid rgba(245, 183, 22, 0.25)", borderRadius: 12, padding: 18, boxShadow: "0 4px 14px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Autopilot Daily Post</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: autopilotEnabled ? "#10b981" : "#94a3b8", marginTop: 6 }}>
              {autopilotEnabled ? "Active (Daily 6:00 AM)" : "Paused"}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Zero-maintenance scheduling</div>
          </div>
        </div>

        {/* ── WORKSPACE TABS ── */}
        <div style={{ display: "flex", gap: 10, borderBottom: "1px solid #1e293b", marginBottom: 24, paddingBottom: 2 }}>
          <button
            onClick={() => setActiveTab("content")}
            style={{
              padding: "10px 18px",
              background: activeTab === "content" ? "#1e293b" : "transparent",
              border: "none",
              borderBottom: activeTab === "content" ? "2.5px solid #F5B716" : "2.5px solid transparent",
              color: activeTab === "content" ? "#F5B716" : "#94a3b8",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            📑 Articles & Website Pages ({contentList.length})
          </button>

          <button
            onClick={() => setActiveTab("topics")}
            style={{
              padding: "10px 18px",
              background: activeTab === "topics" ? "#1e293b" : "transparent",
              border: "none",
              borderBottom: activeTab === "topics" ? "2.5px solid #F5B716" : "2.5px solid transparent",
              color: activeTab === "topics" ? "#F5B716" : "#94a3b8",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            💡 Topic & Keyword Planner
          </button>

          <button
            onClick={() => setActiveTab("autopilot")}
            style={{
              padding: "10px 18px",
              background: activeTab === "autopilot" ? "#1e293b" : "transparent",
              border: "none",
              borderBottom: activeTab === "autopilot" ? "2.5px solid #F5B716" : "2.5px solid transparent",
              color: activeTab === "autopilot" ? "#F5B716" : "#94a3b8",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            🤖 Autopilot Scheduler
          </button>

          <button
            onClick={() => setActiveTab("integrations")}
            style={{
              padding: "10px 18px",
              background: activeTab === "integrations" ? "#1e293b" : "transparent",
              border: "none",
              borderBottom: activeTab === "integrations" ? "2.5px solid #F5B716" : "2.5px solid transparent",
              color: activeTab === "integrations" ? "#F5B716" : "#94a3b8",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            🔌 WordPress Connector & GSC
          </button>
        </div>

        {/* =========================================================================
            TAB 1: ARTICLES & WEBSITE PAGES (CONTENT HUB)
        ========================================================================= */}
        {activeTab === "content" && (
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
                  className="btn-gabbar-dark"
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
                onClick={() => setShowNewBlogModal(true)}
                className="btn-gabbar-gold"
                style={{
                  padding: "10px 22px",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <span>✍️</span> Generate & Publish Blog ↗
              </button>
            </div>

            {/* Table */}
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1e293b", color: "#64748b", textTransform: "uppercase", fontSize: 11, letterSpacing: "0.5px" }}>
                    <th style={{ padding: "14px 18px" }}>Title & URL</th>
                    <th style={{ padding: "14px 14px" }}>Type</th>
                    <th style={{ padding: "14px 14px" }}>Words</th>
                    <th style={{ padding: "14px 14px" }}>Focus Keyword</th>
                    <th style={{ padding: "14px 14px" }}>Status</th>
                    <th style={{ padding: "14px 18px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingContent ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>
                        Fetching live posts and pages from WordPress…
                      </td>
                    </tr>
                  ) : filteredContent.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
                        No content found. Make sure your WordPress site is connected in the Integrations tab.
                      </td>
                    </tr>
                  ) : (
                    filteredContent.map((item) => (
                      <tr key={item.id} style={{ borderBottom: "1px solid #131b2e" }}>
                        <td style={{ padding: "14px 18px", maxWidth: 360 }}>
                          <div style={{ fontWeight: 600, color: "#f8fafc", lineHeight: 1.4 }}>{item.title}</div>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: 12, color: "#60a5fa", textDecoration: "none", display: "inline-block", marginTop: 4 }}
                          >
                            /{item.slug} ↗
                          </a>
                        </td>
                        <td style={{ padding: "14px 14px" }}>
                          <span
                            style={{
                              fontSize: 11,
                              padding: "3px 8px",
                              borderRadius: 4,
                              background: item.type === "page" ? "#312e81" : "#1e293b",
                              color: item.type === "page" ? "#c7d2fe" : "#94a3b8",
                              fontWeight: 600,
                              textTransform: "uppercase",
                            }}
                          >
                            {item.type}
                          </span>
                        </td>
                        <td style={{ padding: "14px 14px" }}>
                          <span style={{ fontSize: 12, color: "#94a3b8" }}>{item.word_count || 0} words</span>
                        </td>
                        <td style={{ padding: "14px 14px" }}>
                          <span style={{ fontSize: 12, color: item.focus_keyword ? "#10b981" : "#64748b" }}>
                            {item.focus_keyword || "—"}
                          </span>
                        </td>
                        <td style={{ padding: "14px 14px" }}>
                          <span
                            style={{
                              fontSize: 11,
                              padding: "3px 8px",
                              borderRadius: 4,
                              background: item.status === "publish" ? "#064e3b" : "#451a03",
                              color: item.status === "publish" ? "#34d399" : "#fbbf24",
                              fontWeight: 600,
                              textTransform: "uppercase",
                            }}
                          >
                            {item.status === "publish" ? "Live" : item.status}
                          </span>
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "right" }}>
                          <button
                            onClick={() => handleOpenOptimize(item)}
                            className="btn-gabbar-dark"
                            style={{
                              padding: "6px 14px",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            ⚡ Optimize
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: TOPICS & KEYWORD PLANNER
        ========================================================================= */}
        {activeTab === "topics" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* Left: Focus Keywords */}
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 24 }}>
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
                    border: "1px solid #1e293b",
                    background: "#131b2e",
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
                  className="btn-gabbar-gold"
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
                      background: "#131b2e",
                      border: "1px solid rgba(245, 183, 22, 0.2)",
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

            {/* Right: Anti-Duplication AI SERP Ideation */}
            <div style={{ background: "#0f172a", border: "1.5px solid rgba(245, 183, 22, 0.25)", borderRadius: 12, padding: 24, boxShadow: "0 4px 14px rgba(0,0,0,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: 16, color: "#fff" }}>💡 AI SERP Topic Generator</h3>
                <button
                  onClick={handleAutoSuggestTopics}
                  disabled={loadingTopics}
                  className="btn-gabbar-gold"
                  style={{
                    padding: "7px 16px",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {loadingTopics ? "Analyzing SERP…" : "⚡ Auto-Suggest 6 Topics ↗"}
                </button>
              </div>
              <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 16px 0" }}>
                Cross-references your live WordPress database to guarantee 0% topic duplication.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {suggestedTopics.length === 0 ? (
                  <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 13, background: "#131b2e", borderRadius: 8 }}>
                    Click "Auto-Suggest 6 Topics" to ideate SERP-ranking articles.
                  </div>
                ) : (
                  suggestedTopics.map((top, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: 12,
                        background: "#131b2e",
                        border: "1px solid #1e293b",
                        borderRadius: 8,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <span style={{ fontSize: 13, color: "#f8fafc", fontWeight: 500 }}>{top}</span>
                      <button
                        onClick={() => {
                          setNewTopic(top);
                          setShowNewBlogModal(true);
                        }}
                        className="btn-gabbar-gold"
                        style={{
                          padding: "6px 14px",
                          fontSize: 11,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
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
          <div style={{ background: "#0f172a", border: "1.5px solid rgba(245, 183, 22, 0.25)", borderRadius: 12, padding: 28, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
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
                    border: autopilotEnabled ? "1.5px solid #10b981" : "1.5px solid rgba(245, 183, 22, 0.4)",
                    background: autopilotEnabled ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 183, 22, 0.1)",
                    color: autopilotEnabled ? "#34d399" : "#F5B716",
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
                  className="btn-gabbar-gold"
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
                  placeholder="e.g. affordable digital marketing ahmedabad"
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
                className="btn-gabbar-gold"
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
                  <label style={{ fontSize: 13, color: "#94a3b8", display: "block", marginBottom: 6 }}>Target Keywords (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. web design trends, conversion optimization, responsive website"
                    value={newKeywords}
                    onChange={(e) => setNewKeywords(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: "1px solid #1e293b", background: "#131b2e", color: "#fff", fontSize: 14 }}
                  />
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

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                  <button onClick={() => setShowNewBlogModal(false)} style={{ padding: "9px 16px", borderRadius: 6, border: "1px solid #1e293b", background: "transparent", color: "#94a3b8", cursor: "pointer" }}>
                    Cancel
                  </button>
                  <button
                    onClick={() => handleGenerateBlog()}
                    disabled={generatingBlog}
                    className="btn-gabbar-gold"
                    style={{ padding: "11px 24px", fontSize: 13, cursor: "pointer" }}
                  >
                    {generatingBlog ? "Writing & Generating Dual Images…" : "🚀 Publish Live to WordPress ↗"}
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
    </div>
  );
}
