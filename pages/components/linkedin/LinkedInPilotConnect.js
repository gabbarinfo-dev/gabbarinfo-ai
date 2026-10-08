"use client";

import { useEffect, useState } from "react";

export default function LinkedInPilotConnect() {
  const [status, setStatus] = useState("loading"); // loading | idle | connected
  const [connData, setConnData] = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // Composer States
  const [postTopic, setPostTopic] = useState("");
  const [commentary, setCommentary] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [selectedAuthorUrn, setSelectedAuthorUrn] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(null);
  const [publishError, setPublishError] = useState(null);

  // Brand Intelligence & Non-Repeating Topics States
  const [brandWebsite, setBrandWebsite] = useState("");
  const [brandIntel, setBrandIntel] = useState(null);
  const [crawlingBrand, setCrawlingBrand] = useState(false);
  const [topicsFilter, setTopicsFilter] = useState("all"); // 'all' | 'queued' | 'published'

  // Autopilot States
  const [autopilotConfig, setAutopilotConfig] = useState({
    enabled: false,
    frequency: "daily",
    topics: "B2B Growth, AI Automation, Tech Innovation",
    generateImage: true,
  });
  const [savingAutopilot, setSavingAutopilot] = useState(false);
  const [runningAutopilot, setRunningAutopilot] = useState(false);

  const fetchStatus = async () => {
    try {
      setStatus("loading");
      const res = await fetch("/api/linkedin/status");
      const data = await res.json();
      if (data.ok && data.connected) {
        setStatus("connected");
        setConnData(data);
        if (data.organizations?.length > 0 && !selectedAuthorUrn) {
          setSelectedAuthorUrn(data.organizations[0].urn);
        } else if (data.member?.urn && !selectedAuthorUrn) {
          setSelectedAuthorUrn(data.member.urn);
        }
      } else {
        setStatus("idle");
        setConnData(null);
      }
    } catch (e) {
      console.warn("Failed to check LinkedIn status:", e);
      setStatus("idle");
    }
  };

  const fetchAutopilotConfig = async () => {
    try {
      const res = await fetch("/api/linkedin/autopilot-config");
      const data = await res.json();
      if (data.ok && data.config) {
        setAutopilotConfig(data.config);
      }
    } catch (_) {}
  };

  const fetchBrandIntel = async () => {
    try {
      const res = await fetch("/api/linkedin/brand-intel");
      const data = await res.json();
      if (data.ok && data.intelligence) {
        setBrandIntel(data.intelligence);
        if (data.intelligence.websiteUrl) setBrandWebsite(data.intelligence.websiteUrl);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchStatus();
    fetchAutopilotConfig();
    fetchBrandIntel();

    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("linkedin_connected") === "1") {
        const type = urlParams.get("connected_type") === "page" ? "Company Page" : "Personal Profile";
        setPublishSuccess({
          message: `LinkedIn ${type} successfully connected! You can now compose and broadcast B2B posts.`,
        });
      }
    }
  }, []);

  const handleConnect = (type = "page") => {
    window.location.href = `/api/linkedin/connect?type=${type}`;
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Are you sure you want to disconnect your LinkedIn account from GabbarInfo AI?")) {
      return;
    }
    try {
      setDisconnecting(true);
      const res = await fetch("/api/linkedin/disconnect", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setStatus("idle");
        setConnData(null);
        setPublishSuccess(null);
      } else {
        alert(data.error || "Failed to disconnect account.");
      }
    } catch (e) {
      alert("Error disconnecting LinkedIn: " + e.message);
    } finally {
      setDisconnecting(false);
    }
  };

  const handleCrawlWebsite = async () => {
    if (!brandWebsite.trim()) {
      alert("Please enter a valid website URL (e.g. https://example.com)");
      return;
    }
    try {
      setCrawlingBrand(true);
      setPublishError(null);
      const res = await fetch("/api/linkedin/crawl-brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteUrl: brandWebsite.trim(),
          brandName: activeAuthorName,
        }),
      });
      const data = await res.json();
      if (data.ok && data.intelligence) {
        setBrandIntel(data.intelligence);
        alert(`✅ Deep Crawl Complete! Discovered ${data.intelligence.services?.length || 0} core services and formulated 30 unique non-repeating LinkedIn editorial topics!`);
      } else {
        alert(data.error || "Failed to analyze website.");
      }
    } catch (e) {
      alert("Crawl error: " + e.message);
    } finally {
      setCrawlingBrand(false);
    }
  };

  const handleUseTopic = (topicObj) => {
    setPostTopic(topicObj.topic);
    setCommentary(`💡 ${topicObj.hook}\n\nWhen scaling ${topicObj.targetService || "your business"}, execution is everything.\n\nHere are the critical lessons:`);
    window.scrollTo({ top: 400, behavior: "smooth" });
  };

  const handleGenerateAiPost = async () => {
    if (!postTopic.trim()) {
      alert("Please enter a topic or select one from the 30-Day Queue below.");
      return;
    }
    try {
      setGenerating(true);
      setPublishError(null);
      const activeOrg = orgs.find((o) => o.urn === selectedAuthorUrn);
      const brandName = activeOrg?.name || member?.name || "Business";

      const res = await fetch("/api/linkedin/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: postTopic,
          brandName,
        }),
      });
      const data = await res.json();
      if (data.ok && data.content) {
        setCommentary(data.content);
      } else {
        setPublishError(data.error || "Failed to generate post copy.");
      }
    } catch (e) {
      setPublishError("AI generation failed: " + e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateAiImage = async () => {
    try {
      setGeneratingImage(true);
      setPublishError(null);
      const activeOrg = orgs.find((o) => o.urn === selectedAuthorUrn);
      const brandName = activeOrg?.name || member?.name || "B2B Business";

      const res = await fetch("/api/linkedin/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: postTopic ? `Professional 3D isometric B2B visual about ${postTopic}` : null,
          commentary: commentary.trim() || postTopic,
          brandName,
        }),
      });

      const data = await res.json();
      if (data.ok && data.imageUrl) {
        setImageUrl(data.imageUrl);
      } else {
        setPublishError(data.error || "Failed to generate AI visual.");
      }
    } catch (e) {
      setPublishError("AI Image error: " + e.message);
    } finally {
      setGeneratingImage(false);
    }
  };

  const handlePublishPost = async () => {
    if (!commentary.trim()) {
      alert("Post commentary cannot be empty.");
      return;
    }
    try {
      setPublishing(true);
      setPublishError(null);
      setPublishSuccess(null);

      const targetUrn = selectedAuthorUrn || (orgs[0]?.urn || member?.urn);

      const res = await fetch("/api/linkedin/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentary: commentary.trim(),
          imageUrl: imageUrl.trim() || null,
          targetUrn,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setPublishSuccess({
          message: data.message || "Post successfully published to LinkedIn!",
          postUrl: data.postUrl,
          postUrn: data.postUrn,
        });
        setCommentary("");
        setImageUrl("");
        setPostTopic("");
      } else {
        setPublishError(data.error || "Failed to publish post.");
      }
    } catch (e) {
      setPublishError("Publishing error: " + e.message);
    } finally {
      setPublishing(false);
    }
  };

  const handleSaveAutopilot = async () => {
    try {
      setSavingAutopilot(true);
      const res = await fetch("/api/linkedin/autopilot-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...autopilotConfig,
          targetUrn: selectedAuthorUrn || (orgs[0]?.urn || member?.urn),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        alert("✅ LinkedIn Auto-Pilot settings saved successfully!");
      } else {
        alert(data.error || "Failed to save settings.");
      }
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setSavingAutopilot(false);
    }
  };

  const handleRunAutopilotCycle = async () => {
    try {
      setRunningAutopilot(true);
      setPublishError(null);
      setPublishSuccess(null);

      const res = await fetch("/api/linkedin/autopilot-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (data.ok) {
        setPublishSuccess({
          message: "⚡ Auto-Pilot cycle completed! New post published autonomously.",
          postUrl: data.postUrl,
          postUrn: data.postUrn,
        });
        if (data.commentary) setCommentary(data.commentary);
        if (data.imageUrl) setImageUrl(data.imageUrl);
        fetchBrandIntel(); // Refresh topic queue status
      } else {
        setPublishError(data.error || "Auto-Pilot run failed.");
      }
    } catch (e) {
      setPublishError("Auto-Pilot error: " + e.message);
    } finally {
      setRunningAutopilot(false);
    }
  };

  const member = connData?.member;
  const orgs = connData?.organizations || [];
  const isMemberConnected = Boolean(connData?.isMemberConnected);
  const isPageConnected = Boolean(connData?.isPageConnected);

  const activeAuthorName = (() => {
    const org = orgs.find((o) => o.urn === selectedAuthorUrn);
    if (org) return org.name;
    if (member?.name) return member.name;
    return "Your Brand / Page";
  })();

  const rawTopics = brandIntel?.topicsQueue || [];
  const filteredTopics = rawTopics.filter((t) => {
    if (topicsFilter === "queued") return t.status !== "published";
    if (topicsFilter === "published") return t.status === "published";
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%" }}>
      {/* ── TOP HERO BANNER ── */}
      <div
        style={{
          padding: "24px 28px",
          borderRadius: 20,
          background: "linear-gradient(135deg, rgba(10, 102, 194, 0.18) 0%, rgba(14, 19, 30, 0.95) 100%)",
          border: "1px solid rgba(10, 102, 194, 0.35)",
          boxShadow: "0 15px 40px rgba(0, 0, 0, 0.4), 0 0 25px rgba(10, 102, 194, 0.1)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "#0a66c2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              boxShadow: "0 4px 18px rgba(10, 102, 194, 0.4)",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#ffffff">
              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9h2.77v8.37H6.46v-8.37M7.84 6.2a1.62 1.62 0 0 0-1.63 1.62c0 .89.73 1.62 1.63 1.62.9 0 1.63-.73 1.63-1.62 0-.9-.73-1.62-1.63-1.62Z" />
            </svg>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#ffffff" }}>
                LinkedIn Pilot & Company Page Syndicate
              </h2>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "3px 8px",
                  borderRadius: 999,
                  background: status === "connected" ? "rgba(34, 197, 94, 0.15)" : "rgba(148, 163, 184, 0.15)",
                  color: status === "connected" ? "#4ade80" : "#94a3b8",
                  border: `1px solid ${status === "connected" ? "rgba(34, 197, 94, 0.3)" : "rgba(148, 163, 184, 0.2)"}`,
                }}
              >
                {status === "loading" ? "CHECKING..." : status === "connected" ? "● LIVE ACTIVE" : "○ DISCONNECTED"}
              </span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
              AI website learning, zero-repetition topic rotation, and automated B2B broadcasting via GabbarInfo AI.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {status === "connected" && (
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              style={{
                padding: "9px 16px",
                borderRadius: 10,
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#f87171",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
          )}

          <button
            onClick={() => handleConnect("page")}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              background: "#0a66c2",
              border: "none",
              color: "#ffffff",
              fontSize: 12.5,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(10, 102, 194, 0.4)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>🏢 Connect Company Page</span>
            <span>↗</span>
          </button>

          <button
            onClick={() => handleConnect("member")}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#e2e8f0",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>👤 Connect Personal Profile</span>
            <span>↗</span>
          </button>
        </div>
      </div>

      {/* ── NOTIFICATIONS / ALERTS ── */}
      {publishSuccess && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: 12,
            background: "rgba(34, 197, 94, 0.12)",
            border: "1px solid rgba(34, 197, 94, 0.35)",
            color: "#4ade80",
            fontSize: 13.5,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>✅</span>
            <span>{publishSuccess.message}</span>
          </div>
          {publishSuccess.postUrl && (
            <a
              href={publishSuccess.postUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "#ffffff",
                background: "#0a66c2",
                padding: "6px 14px",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              View on LinkedIn ↗
            </a>
          )}
        </div>
      )}

      {publishError && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: 12,
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.35)",
            color: "#f87171",
            fontSize: 13.5,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>⚠️</span>
          <span>{publishError}</span>
        </div>
      )}

      {/* ── 1. BRAND INTELLIGENCE & WEBSITE CRAWLER (ZERO REPETITION ENGINE) ── */}
      <div
        style={{
          padding: "24px 28px",
          borderRadius: 20,
          background: "linear-gradient(180deg, rgba(14, 25, 45, 0.85) 0%, rgba(10, 16, 28, 0.95) 100%)",
          border: "1px solid rgba(56, 189, 248, 0.25)",
          boxShadow: "0 15px 40px rgba(0,0,0,0.4), 0 0 30px rgba(56, 189, 248, 0.05)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(56, 189, 248, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, border: "1px solid rgba(56, 189, 248, 0.35)" }}>
              🧠
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#ffffff" }}>
                  Brand Intelligence & Website Knowledge Crawler
                </h3>
                <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 999, background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.3)" }}>
                  ZERO-REPETITION GUARD ACTIVE
                </span>
              </div>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#94a3b8" }}>
                Learns your real business services, target B2B buyers, and formulates 30 unique, non-repeating editorial angles.
              </p>
            </div>
          </div>
        </div>

        {/* Crawl URL Input Bar */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Enter your website URL (e.g. https://gabbarinfo.com or https://clientbrand.com)..."
            value={brandWebsite}
            onChange={(e) => setBrandWebsite(e.target.value)}
            style={{
              flex: 1,
              minWidth: 260,
              padding: "12px 16px",
              borderRadius: 12,
              background: "rgba(0,0,0,0.35)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#fff",
              fontSize: 13.5,
            }}
          />
          <button
            onClick={handleCrawlWebsite}
            disabled={crawlingBrand}
            style={{
              padding: "12px 22px",
              borderRadius: 12,
              background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
              border: "none",
              color: "#fff",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(2, 132, 199, 0.35)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>{crawlingBrand ? "Crawling & Formulating Topics…" : "🔍 Deep Crawl & Learn Brand Services"}</span>
          </button>
        </div>

        {/* Learned Knowledge Highlights */}
        {brandIntel && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
              <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Industry & Niche</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#38bdf8", marginTop: 4 }}>{brandIntel.industry}</div>
                <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>{brandIntel.tagline}</div>
              </div>

              <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Target B2B Audience</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#a855f7", marginTop: 4 }}>{brandIntel.targetAudience}</div>
                <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>Learned from website structure</div>
              </div>
            </div>

            {/* Extracted Core Services */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 8 }}>
                💼 Discovered Core Services & Capabilities:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(brandIntel.services || []).map((service, sIdx) => (
                  <span
                    key={sIdx}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 999,
                      background: "rgba(59, 130, 246, 0.12)",
                      border: "1px solid rgba(59, 130, 246, 0.3)",
                      color: "#93c5fd",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    ✓ {service}
                  </span>
                ))}
              </div>
            </div>

            {/* 30-Day Non-Repeating Editorial Queue */}
            <div style={{ marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#ffffff" }}>
                    📅 30-Day Non-Repeating Editorial Queue ({rawTopics.length} Topics Formulated)
                  </span>
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                  {["all", "queued", "published"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setTopicsFilter(tab)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "none",
                        background: topicsFilter === tab ? "#0a66c2" : "rgba(255,255,255,0.06)",
                        color: topicsFilter === tab ? "#fff" : "#94a3b8",
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: "pointer",
                        textTransform: "capitalize",
                      }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Topics Scroll Strip */}
              <div
                style={{
                  maxHeight: 280,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  paddingRight: 6,
                }}
              >
                {filteredTopics.map((item, tIdx) => (
                  <div
                    key={tIdx}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      background: item.status === "next" ? "rgba(56, 189, 248, 0.08)" : item.status === "published" ? "rgba(34, 197, 94, 0.06)" : "rgba(255, 255, 255, 0.02)",
                      border: `1px solid ${item.status === "next" ? "rgba(56, 189, 248, 0.3)" : item.status === "published" ? "rgba(34, 197, 94, 0.2)" : "rgba(255, 255, 255, 0.06)"}`,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: "rgba(255,255,255,0.08)", color: "#cbd5e1" }}>
                          Day {item.scheduledDay}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#38bdf8" }}>
                          {item.targetService}
                        </span>
                        <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: item.status === "published" ? "rgba(34,197,94,0.15)" : item.status === "next" ? "rgba(56,189,248,0.2)" : "rgba(148,163,184,0.1)", color: item.status === "published" ? "#4ade80" : item.status === "next" ? "#38bdf8" : "#94a3b8", fontWeight: 800 }}>
                          {item.status === "published" ? "PUBLISHED" : item.status === "next" ? "NEXT IN QUEUE" : "QUEUED"}
                        </span>
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.topic}
                      </div>
                      <div style={{ fontSize: 11.5, color: "#94a3b8" }}>
                        Hook: "{item.hook}"
                      </div>
                    </div>

                    <button
                      onClick={() => handleUseTopic(item)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        background: "rgba(56, 189, 248, 0.15)",
                        border: "1px solid rgba(56, 189, 248, 0.3)",
                        color: "#38bdf8",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      ⚡ Use In Composer
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── BROADCAST STUDIO & LIVE PREVIEW ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 460px), 1fr))", gap: 24 }}>
        {/* Column 1: Post Broadcast Studio */}
        <div
          style={{
            padding: "24px 26px",
            borderRadius: 20,
            background: "rgba(14, 19, 30, 0.85)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#38bdf8", textTransform: "uppercase" }}>
              ✍️ Post Broadcast Studio
            </span>
            <span style={{ fontSize: 11, color: "#64748b" }}>
              {commentary.length} chars
            </span>
          </div>

          {/* Author Target Selector */}
          <div>
            <label style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 700, display: "block", marginBottom: 6 }}>
              Publish Destination:
            </label>
            <select
              value={selectedAuthorUrn}
              onChange={(e) => setSelectedAuthorUrn(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 10,
                background: "#0b1220",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {orgs.map((org, i) => (
                <option key={i} value={org.urn}>
                  🏢 Company Page: {org.name}
                </option>
              ))}
              {member?.urn && (
                <option value={member.urn}>
                  👤 Personal Profile: {member.name}
                </option>
              )}
              {orgs.length === 0 && !member?.urn && (
                <option value="">(Connect Company Page or Profile above)</option>
              )}
            </select>
          </div>

          {/* AI Prompt Input */}
          <div style={{ display: "flex", gap: 10 }}>
            <input
              type="text"
              placeholder="Enter topic or select from 30-Day Queue above..."
              value={postTopic}
              onChange={(e) => setPostTopic(e.target.value)}
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 10,
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#fff",
                fontSize: 13,
              }}
            />
            <button
              onClick={handleGenerateAiPost}
              disabled={generating}
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                border: "none",
                color: "#fff",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {generating ? "Drafting…" : "✨ AI Draft"}
            </button>
          </div>

          {/* Commentary Area */}
          <textarea
            rows={6}
            placeholder="Write your LinkedIn post here..."
            value={commentary}
            onChange={(e) => setCommentary(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "12px 14px",
              borderRadius: 12,
              background: "rgba(0,0,0,0.35)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#fff",
              fontSize: 13.5,
              lineHeight: 1.6,
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />

          {/* ── AI IMAGE GENERATION & MANUAL URL STRIP ── */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 14,
              background: "rgba(0, 0, 0, 0.25)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1" }}>
                🖼️ Post Creative Visual
              </span>
              <button
                onClick={handleGenerateAiImage}
                disabled={generatingImage}
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #a855f7 0%, #6366f1 100%)",
                  border: "none",
                  color: "#fff",
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 2px 10px rgba(168, 85, 247, 0.3)",
                }}
              >
                <span>{generatingImage ? "Generating Visual…" : "✨ AI Generate Visual Creative"}</span>
              </button>
            </div>

            {imageUrl ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.03)", padding: 8, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
                <img src={imageUrl} alt="Creative Thumbnail" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "#4ade80", fontWeight: 700 }}>Visual Attached</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{imageUrl}</div>
                </div>
                <button
                  onClick={() => setImageUrl("")}
                  style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <input
                type="text"
                placeholder="Or paste custom image URL (https://...)..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "9px 12px",
                  borderRadius: 8,
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  color: "#fff",
                  fontSize: 12,
                }}
              />
            )}
          </div>

          {/* Publish Action Button */}
          <button
            onClick={handlePublishPost}
            disabled={publishing || !commentary.trim()}
            style={{
              width: "100%",
              padding: "13px 20px",
              borderRadius: 12,
              background: commentary.trim() ? "#0a66c2" : "rgba(10, 102, 194, 0.4)",
              border: "none",
              color: "#ffffff",
              fontWeight: 800,
              fontSize: 14,
              cursor: commentary.trim() && !publishing ? "pointer" : "not-allowed",
              boxShadow: commentary.trim() ? "0 4px 18px rgba(10, 102, 194, 0.4)" : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            {publishing ? (
              <span>Publishing to LinkedIn…</span>
            ) : (
              <>
                <span>🚀 Publish to LinkedIn Now</span>
                <span>↗</span>
              </>
            )}
          </button>
        </div>

        {/* Column 2: Live LinkedIn Feed Preview */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px" }}>
            Feed Simulation Preview
          </span>

          {/* LinkedIn Simulated Post Card */}
          <div
            style={{
              borderRadius: 16,
              background: "#1b2230",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              overflow: "hidden",
              boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
            }}
          >
            {/* Header */}
            <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: selectedAuthorUrn?.startsWith("urn:li:organization:") ? 6 : "50%",
                  background: "#0a66c2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 16,
                }}
              >
                {selectedAuthorUrn?.startsWith("urn:li:organization:") ? "🏢" : "IN"}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffff" }}>
                  {activeAuthorName}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>
                  {selectedAuthorUrn?.startsWith("urn:li:organization:") ? "Company Page" : "Thought Leader"} • Just now • 🌐 Public
                </div>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: "16px 18px", fontSize: 13.5, color: "#e2e8f0", lineHeight: 1.6, whiteSpace: "pre-wrap", minHeight: 120 }}>
              {commentary.trim() || (
                <span style={{ color: "#64748b", fontStyle: "italic" }}>
                  Your LinkedIn post content will appear here in real time as you write or generate it with AI...
                </span>
              )}
            </div>

            {/* Image Preview */}
            {imageUrl.trim() && (
              <div style={{ width: "100%", maxHeight: 320, overflow: "hidden", background: "#000", display: "flex", justifyContent: "center" }}>
                <img
                  src={imageUrl.trim()}
                  alt="Creative Preview"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                  style={{ width: "100%", maxHeight: 320, objectFit: "cover" }}
                />
              </div>
            )}

            {/* Footer Engagement Bar */}
            <div
              style={{
                padding: "10px 18px",
                display: "flex",
                justifyContent: "space-around",
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                fontSize: 12,
                color: "#94a3b8",
                fontWeight: 600,
              }}
            >
              <span>👍 Like</span>
              <span>💬 Comment</span>
              <span>🔁 Repost</span>
              <span>📤 Send</span>
            </div>
          </div>

          {/* Quick Tips */}
          <div
            style={{
              padding: "14px 18px",
              borderRadius: 14,
              background: "rgba(10, 102, 194, 0.08)",
              border: "1px solid rgba(10, 102, 194, 0.2)",
              fontSize: 12,
              color: "#93c5fd",
              lineHeight: 1.6,
            }}
          >
            <strong>💡 Zero Repetition Guarantee:</strong> GabbarInfo AI rotates through 30 unique editorial angles tailored to your crawled services. When all 30 are used, it automatically formulates a fresh seasonal cycle!
          </div>
        </div>
      </div>

      {/* ── AUTONOMOUS LINKEDIN AUTO-PILOT SCHEDULER ── */}
      <div
        style={{
          padding: "26px 28px",
          borderRadius: 20,
          background: "linear-gradient(180deg, rgba(16, 24, 38, 0.85) 0%, rgba(10, 15, 26, 0.95) 100%)",
          border: "1px solid rgba(168, 85, 247, 0.25)",
          boxShadow: "0 20px 50px rgba(0,0,0,0.5), 0 0 25px rgba(168, 85, 247, 0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(168, 85, 247, 0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, border: "1px solid rgba(168, 85, 247, 0.35)" }}>
              🤖
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#ffffff" }}>
                Autonomous LinkedIn Auto-Pilot Engine
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#94a3b8" }}>
                Executes non-repeating B2B topics sequentially from your editorial queue, generating AI visual creatives and broadcasting to your selected LinkedIn destination.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={handleRunAutopilotCycle}
              disabled={runningAutopilot || !status === "connected"}
              style={{
                padding: "9px 18px",
                borderRadius: 10,
                background: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
                border: "none",
                color: "#ffffff",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(168, 85, 247, 0.35)",
              }}
            >
              {runningAutopilot ? "Executing Auto-Pilot Cycle…" : "⚡ Run Auto-Pilot Cycle Now (Test)"}
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 20 }}>
          {/* Autopilot Enabled Switch */}
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
              Auto-Pilot Status
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={autopilotConfig.enabled}
                onChange={(e) => setAutopilotConfig({ ...autopilotConfig, enabled: e.target.checked })}
                style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#a855f7" }}
              />
              <span style={{ fontSize: 13, fontWeight: 700, color: autopilotConfig.enabled ? "#4ade80" : "#94a3b8" }}>
                {autopilotConfig.enabled ? "Active Autonomous Publishing" : "Disabled (Manual Only)"}
              </span>
            </label>
          </div>

          {/* Frequency */}
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
              Publishing Cadence
            </div>
            <select
              value={autopilotConfig.frequency}
              onChange={(e) => setAutopilotConfig({ ...autopilotConfig, frequency: e.target.value })}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                background: "#0b1220",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "#fff",
                fontSize: 12.5,
              }}
            >
              <option value="daily">Daily Broadcast (1 Post / Day)</option>
              <option value="3_per_week">3 Times a Week (Mon, Wed, Fri)</option>
              <option value="weekly">Weekly Pulse (1 Post / Week)</option>
            </select>
          </div>

          {/* AI Creative Generation Toggle */}
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
              Visual Graphic Creation
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={autopilotConfig.generateImage}
                onChange={(e) => setAutopilotConfig({ ...autopilotConfig, generateImage: e.target.checked })}
                style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#a855f7" }}
              />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                Generate 1:1 AI Graphic with every post
              </span>
            </label>
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={handleSaveAutopilot}
          disabled={savingAutopilot}
          style={{
            padding: "11px 24px",
            borderRadius: 10,
            background: "#2563eb",
            border: "none",
            color: "#ffffff",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {savingAutopilot ? "Saving Settings…" : "💾 Save Auto-Pilot Schedule"}
        </button>
      </div>
    </div>
  );
}
