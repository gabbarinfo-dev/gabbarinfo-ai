"use client";

import { useState, useEffect } from "react";

export default function SocialMediaPlannerModal({ onClose }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingQueue, setGeneratingQueue] = useState(false);
  const [regeneratingIdx, setRegeneratingIdx] = useState(null);
  const [testingPost, setTestingPost] = useState(false);
  const [activeTab, setActiveTab] = useState("planner"); // "planner" | "history" | "settings"

  const [hasFacebook, setHasFacebook] = useState(false);
  const [hasInstagram, setHasInstagram] = useState(false);
  const [fbPageName, setFbPageName] = useState(null);
  const [igUsername, setIgUsername] = useState(null);

  const [config, setConfig] = useState({
    enabled: false,
    destination: "BOTH", // "BOTH" | "FACEBOOK_ONLY" | "INSTAGRAM_ONLY"
    cadence: "daily",
    businessName: "GabbarInfo",
    industry: "Digital Marketing & Growth",
    services: ["SEO Optimization", "Google Ads Management", "Meta Social Ads", "Website Design"],
    brandVoice: "Bold, authoritative, and consultative",
    queue: [],
    history: [],
    publishedCount: 0,
    lastPublishedAt: null,
  });

  const [newServiceTag, setNewServiceTag] = useState("");
  const [editingIndex, setEditingIndex] = useState(null);
  const [editTopicText, setEditTopicText] = useState("");
  const [editHookText, setEditHookText] = useState("");
  const [testingStatus, setTestingStatus] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [isRestricted, setIsRestricted] = useState(false);
  const [restrictionReason, setRestrictionReason] = useState("");

  // Load initial config
  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    setLoading(true);
    try {
      const res = await fetch("/api/social/autopilot-config");
      const data = await res.json();
      if (data.ok) {
        setConfig(data.config);
        setIsOwner(Boolean(data.isOwner));
        setIsRestricted(Boolean(data.isRestricted));
        setRestrictionReason(data.restrictionReason || "");
        setHasFacebook(data.hasFacebook);
        setHasInstagram(data.hasInstagram);
        setFbPageName(data.fbPageName);
        setIgUsername(data.igUsername);
      }
    } catch (e) {
      console.error("Failed to load social config:", e);
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig(updated = {}) {
    setSaving(true);
    try {
      const payload = { ...config, ...updated };
      const res = await fetch("/api/social/autopilot-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", config: payload }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setConfig(data.config);
        return true;
      } else {
        const errorMsg = data?.error || `Server error (${res.status})`;
        if (res.status === 403 || errorMsg.includes("restricted") || errorMsg.includes("revoked")) {
          setIsRestricted(true);
          alert("Service is restricted: " + errorMsg);
        } else {
          alert("Failed to save: " + errorMsg);
        }
        return false;
      }
    } catch (e) {
      alert("Error saving: " + e.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleEnabled() {
    if (isRestricted && !config.enabled) {
      alert("Service is restricted: Social Media service has been revoked or is not enabled for your account.");
      return;
    }
    const nextState = !config.enabled;
    const ok = await saveConfig({ enabled: nextState });
    if (!ok && nextState) {
      // Revert in UI if saving failed or was rejected with 403
      setConfig((prev) => ({ ...prev, enabled: false }));
    }
  }

  async function handleGenerateFullQueue() {
    setGeneratingQueue(true);
    try {
      const res = await fetch("/api/social/autopilot-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate-queue", config }),
      });
      const data = await res.json();
      if (data.ok) {
        setConfig((prev) => ({ ...prev, queue: data.queue }));
      }
    } catch (e) {
      alert("Queue generation failed: " + e.message);
    } finally {
      setGeneratingQueue(false);
    }
  }

  async function handleRegenerateTopic(index) {
    setRegeneratingIdx(index);
    try {
      const res = await fetch("/api/social/autopilot-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate-topic", dayIndex: index }),
      });
      const data = await res.json();
      if (data.ok) {
        setConfig((prev) => ({ ...prev, queue: data.queue }));
      }
    } catch (e) {
      alert("Regeneration failed: " + e.message);
    } finally {
      setRegeneratingIdx(null);
    }
  }

  function handleOpenEdit(index, item) {
    setEditingIndex(index);
    setEditTopicText(item.topic || "");
    setEditHookText(item.hook || "");
  }

  async function handleSaveEdit() {
    if (editingIndex === null) return;
    try {
      const res = await fetch("/api/social/autopilot-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-topic",
          dayIndex: editingIndex,
          customTopic: editTopicText,
          customHook: editHookText,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setConfig((prev) => ({ ...prev, queue: data.queue }));
        setEditingIndex(null);
      }
    } catch (e) {
      alert("Update failed: " + e.message);
    }
  }

  function handleAddServiceTag() {
    const trimmed = newServiceTag.trim();
    if (!trimmed) return;
    if (config.services.includes(trimmed)) return;
    const updated = [...config.services, trimmed];
    setConfig((prev) => ({ ...prev, services: updated }));
    setNewServiceTag("");
    saveConfig({ services: updated });
  }

  function handleRemoveServiceTag(tag) {
    const updated = config.services.filter((s) => s !== tag);
    setConfig((prev) => ({ ...prev, services: updated }));
    saveConfig({ services: updated });
  }

  async function handleTestPostNow() {
    const testPostsUsed = config.testPostsUsed || 0;
    if (!isOwner && testPostsUsed >= 1 && isRestricted) {
      alert("You have already used your 1 free test post. Social Media service is restricted for your account.");
      return;
    }

    const destLabel =
      config.destination === "BOTH"
        ? "Both Facebook Page & Instagram"
        : config.destination === "FACEBOOK_ONLY"
        ? "Facebook Page"
        : "Instagram";

    const confirmMsg = (!isOwner && testPostsUsed >= 1)
      ? `Publish an immediate live creative to ${destLabel}? This will consume 1 social post allowance from your monthly plan.`
      : `Post an immediate live test creative now to ${destLabel}? (1 free test post)`;

    const confirmPost = confirm(confirmMsg);
    if (!confirmPost) return;

    setTestingPost(true);
    setTestingStatus("Generating creative with AI...");
    const postStartTime = Date.now();

    try {
      const res = await fetch("/api/social/autopilot-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test-post" }),
      });
      const rawText = await res.text();
      let data = null;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        // Non-JSON response
      }

      if (res.ok && data?.ok) {
        if (data.config) {
          setConfig(data.config);
        }
        const postLink = data.postUrl ? `\n\nDirect Link: ${data.postUrl}` : "";
        alert(`🎉 Success! Autonomous test creative published successfully to ${destLabel}!${postLink}`);
        fetchConfig();
        return;
      }

      // Handle restricted / error responses immediately
      if (res.status === 403 || data?.error?.includes("Restricted") || data?.error?.includes("restricted") || data?.code === "FEATURE_NOT_INCLUDED" || data?.code === "MONTHLY_QUOTA_EXHAUSTED") {
        setIsRestricted(true);
        alert(data?.error || "Social post quota exhausted or feature not included in current plan. Please upgrade.");
        fetchConfig();
        return;
      }

      if (res.status === 402 || data?.error?.includes("Insufficient credits")) {
        alert(data?.error || "Publishing a post requires remaining social post quota on your plan.");
        fetchConfig();
        return;
      }

      if (!res.ok && res.status !== 504) {
        alert("Publishing error: " + (data?.error || rawText || "Server error"));
        fetchConfig();
        return;
      }

      // If serverless function timed out (status 504), poll in background
      setTestingStatus("Publishing to your page... (almost ready)");
      let completed = false;
      for (let attempt = 0; attempt < 8; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        try {
          const pollRes = await fetch("/api/social/autopilot-config");
          const pollData = await pollRes.json();
          if (pollData.ok && pollData.config) {
            const lastPublished = pollData.config.lastPublishedAt
              ? new Date(pollData.config.lastPublishedAt).getTime()
              : 0;
            if (lastPublished >= postStartTime - 5000) {
              setConfig(pollData.config);
              const latest = pollData.config.history?.[0];
              const postLink = latest?.postUrl ? `\n\nDirect Link: ${latest.postUrl}` : "";
              alert(`🎉 Success! Autonomous test creative published successfully to ${destLabel}!${postLink}`);
              completed = true;
              fetchConfig();
              break;
            }
          }
        } catch (pollErr) {
          console.warn("Autopilot polling check:", pollErr.message);
        }
      }

      if (!completed) {
        alert("Publishing request timed out on the gateway. Please refresh your page in a moment to verify if your post appeared.");
        fetchConfig();
      }
    } catch (e) {
      alert("Test post status: " + e.message);
    } finally {
      setTestingPost(false);
      setTestingStatus("");
    }
  }

  const pillarBadges = {
    educational_tips: { label: "💡 Expert Tip", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.12)" },
    service_spotlight: { label: "🎯 Special Offer", color: "#34d399", bg: "rgba(52, 211, 153, 0.12)" },
    myth_busting: { label: "🔍 Myth vs Fact", color: "#fb923c", bg: "rgba(251, 146, 60, 0.12)" },
    problem_solution: { label: "📈 Growth Win", color: "#c084fc", bg: "rgba(192, 132, 252, 0.12)" },
    interactive_poll: { label: "💬 Community Question", color: "#f472b6", bg: "rgba(244, 114, 182, 0.12)" },
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(3, 7, 18, 0.85)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(6px, 2vw, 16px)",
        boxSizing: "border-box",
        width: "100vw",
        maxWidth: "100vw",
        overflowX: "hidden",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 960,
          minWidth: 0,
          maxHeight: "94vh",
          background: "linear-gradient(180deg, rgba(16, 22, 34, 0.98) 0%, rgba(8, 11, 17, 0.99) 100%)",
          border: "1px solid rgba(255, 255, 255, 0.14)",
          borderRadius: "clamp(12px, 3vw, 20px)",
          boxShadow: "0 30px 90px rgba(0, 0, 0, 0.9), 0 0 60px rgba(56, 189, 248, 0.12)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          color: "#f8fafc",
          fontFamily: "Plus Jakarta Sans, sans-serif",
          boxSizing: "border-box",
        }}
      >
        {/* ── TOP HEADER ── */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            background: "rgba(255, 255, 255, 0.02)",
            width: "100%",
            boxSizing: "border-box",
            flexShrink: 0,
          }}
        >
          {/* Row 1: App Identity (Left) + Autopilot Toggle & Close Button (Right) */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
              gap: 8,
              minWidth: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: "linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%)",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                📱
              </div>
              <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: "clamp(15px, 3.5vw, 19px)", fontWeight: 800, letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  Social Media Planner
                </h2>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 700,
                    background: isRestricted
                      ? "rgba(239, 68, 68, 0.15)"
                      : config.enabled
                      ? "rgba(16, 185, 129, 0.15)"
                      : "rgba(148, 163, 184, 0.1)",
                    color: isRestricted ? "#f87171" : config.enabled ? "#34d399" : "#94a3b8",
                    border: `1px solid ${
                      isRestricted
                        ? "rgba(239, 68, 68, 0.3)"
                        : config.enabled
                        ? "rgba(16, 185, 129, 0.3)"
                        : "rgba(148, 163, 184, 0.2)"
                    }`,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: isRestricted ? "#ef4444" : config.enabled ? "#10b981" : "#64748b",
                      boxShadow: isRestricted ? "0 0 8px #ef4444" : config.enabled ? "0 0 8px #10b981" : "none",
                    }}
                  />
                  {isRestricted ? "RESTRICTED" : config.enabled ? "ACTIVE" : "PAUSED"}
                </span>
              </div>
            </div>

            {/* Controls pinned safely on top right */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <button
                onClick={handleToggleEnabled}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none",
                  background: isRestricted
                    ? "rgba(239, 68, 68, 0.15)"
                    : config.enabled
                    ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                    : "rgba(255, 255, 255, 0.08)",
                  color: isRestricted ? "#fca5a5" : config.enabled ? "#042416" : "#cbd5e1",
                  boxShadow: config.enabled && !isRestricted ? "0 0 20px rgba(16, 185, 129, 0.35)" : "none",
                  transition: "all 0.2s ease",
                  whiteSpace: "nowrap",
                }}
              >
                {isRestricted ? "🔒 Service Restricted" : config.enabled ? "Autopilot ON ✓" : "Turn ON Autopilot"}
              </button>

              <button
                onClick={onClose}
                aria-label="Close modal"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  background: "rgba(255, 255, 255, 0.04)",
                  color: "#94a3b8",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Row 2: Subtitle text */}
          <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.4, paddingLeft: 44 }}>
            AI-driven creative graphic posters & daily publishing to Meta feeds.
          </p>
        </div>

        {/* ── TABS NAVIGATION (TOUCH SCROLLABLE) ── */}
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: "8px 12px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(10, 14, 23, 0.7)",
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            whiteSpace: "nowrap",
            width: "100%",
            boxSizing: "border-box",
            flexShrink: 0,
            minHeight: 44,
            alignItems: "center",
          }}
        >
          {[
            { id: "planner", label: "🗓️ 30-Day Queue", count: config.queue?.length || 0 },
            { id: "settings", label: "⚙️ Schedule & Settings" },
            { id: "history", label: "📜 Published", count: config.history?.length || config.publishedCount || 0 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                border: "none",
                background: activeTab === tab.id ? "rgba(56, 189, 248, 0.15)" : "transparent",
                color: activeTab === tab.id ? "#38bdf8" : "#94a3b8",
                transition: "all 0.2s ease",
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              {tab.label} {tab.count !== undefined && `(${tab.count})`}
            </button>
          ))}
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div style={{ padding: "16px 14px", overflowY: "auto", flex: "1 1 auto", minHeight: 0, maxWidth: "100%", boxSizing: "border-box" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
              <div style={{ fontSize: 24, marginBottom: 10 }}>⚡</div>
              Loading Social Media Planner data...
            </div>
          ) : activeTab === "planner" ? (
            /* ═══════════════════════════════════════════
               TAB 1: 30-DAY CONTENT QUEUE
            ═══════════════════════════════════════════ */
            <div>
              {/* Queue Controls Bar */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                  marginBottom: 16,
                  padding: "12px 14px",
                  borderRadius: 14,
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  maxWidth: "100%",
                  boxSizing: "border-box",
                }}
              >
                <div>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>Target: </span>
                  <strong style={{ color: "#38bdf8", fontSize: 12 }}>
                    {config.destination === "BOTH"
                      ? "Both FB & IG"
                      : config.destination === "FACEBOOK_ONLY"
                      ? "Facebook Only"
                      : "Instagram Only"}
                  </strong>
                  <span style={{ color: "#475569", margin: "0 6px" }}>•</span>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>Cadence: </span>
                  <strong style={{ color: "#34d399", fontSize: 12, textTransform: "capitalize" }}>
                    {config.cadence.replace("_", " ")}
                  </strong>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", width: "100%", boxSizing: "border-box" }}>
                  <button
                    onClick={handleTestPostNow}
                    disabled={testingPost || (!isOwner && (config.testPostsUsed || 0) >= 1 && isRestricted)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      background: (!isOwner && (config.testPostsUsed || 0) >= 1 && isRestricted)
                        ? "rgba(255, 255, 255, 0.05)"
                        : (!isOwner && (config.testPostsUsed || 0) >= 1)
                        ? "rgba(168, 85, 247, 0.12)"
                        : "rgba(56, 189, 248, 0.12)",
                      border: (!isOwner && (config.testPostsUsed || 0) >= 1 && isRestricted)
                        ? "1px solid rgba(255, 255, 255, 0.1)"
                        : (!isOwner && (config.testPostsUsed || 0) >= 1)
                        ? "1px solid rgba(168, 85, 247, 0.3)"
                        : "1px solid rgba(56, 189, 248, 0.3)",
                      color: (!isOwner && (config.testPostsUsed || 0) >= 1 && isRestricted)
                        ? "#94a3b8"
                        : (!isOwner && (config.testPostsUsed || 0) >= 1)
                        ? "#c084fc"
                        : "#38bdf8",
                      cursor: testingPost || (!isOwner && (config.testPostsUsed || 0) >= 1 && isRestricted)
                        ? "not-allowed"
                        : "pointer",
                      flex: "1 1 140px",
                      minWidth: 0,
                      textAlign: "center",
                      opacity: (!isOwner && (config.testPostsUsed || 0) >= 1 && isRestricted) ? 0.75 : 1,
                    }}
                  >
                    {testingPost
                      ? (testingStatus || "Publishing Test...")
                      : (!isOwner && (config.testPostsUsed || 0) >= 1 && isRestricted)
                      ? "🔒 Service Restricted (Free Test Used)"
                      : (!isOwner && (config.testPostsUsed || 0) >= 1)
                      ? "🚀 Post Creative Now"
                      : !isOwner
                      ? "🚀 Test Post Now (1 Free Left)"
                      : "🚀 Test Post Now"}
                  </button>

                  <button
                    onClick={handleGenerateFullQueue}
                    disabled={generatingQueue}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      background: "rgba(16, 185, 129, 0.12)",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      color: "#34d399",
                      cursor: generatingQueue ? "not-allowed" : "pointer",
                      flex: "1 1 140px",
                      minWidth: 0,
                      textAlign: "center",
                    }}
                  >
                    {generatingQueue ? "AI Generating..." : "⚡ Generate 30-Day Queue"}
                  </button>
                </div>
              </div>

              {/* Queue List / Grid */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", boxSizing: "border-box" }}>
                {(() => {
                  let pendingRank = 0;
                  return (config.queue || []).map((item, idx) => {
                    const badge = pillarBadges[item.pillar] || { label: "💡 Post", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.1)" };
                    const isRegen = regeneratingIdx === idx;
                    const isPublished = item.status === "published";

                    let projectedDateLabel = null;
                    if (!isPublished) {
                      const rank = pendingRank++;
                      const d = new Date();
                      let daysToAdd = 0;
                      if (config.cadence === "daily") {
                        daysToAdd = rank;
                      } else if (config.cadence === "alternate") {
                        daysToAdd = rank * 2;
                      } else if (config.cadence === "weekly_4") {
                        daysToAdd = Math.round(rank * 1.75);
                      } else if (config.cadence === "weekly") {
                        daysToAdd = rank * 7;
                      } else {
                        daysToAdd = rank;
                      }
                      d.setDate(d.getDate() + daysToAdd);
                      projectedDateLabel = daysToAdd === 0 ? "Today" : daysToAdd === 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                    }

                    return (
                      <div
                        key={idx}
                        style={{
                          padding: "14px 16px",
                          borderRadius: 14,
                          background: isPublished
                            ? "rgba(16, 185, 129, 0.05)"
                            : "rgba(255, 255, 255, 0.025)",
                          border: `1px solid ${
                            isPublished
                              ? "rgba(16, 185, 129, 0.2)"
                              : "rgba(255, 255, 255, 0.07)"
                          }`,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          flexWrap: "wrap",
                          transition: "all 0.2s ease",
                          width: "100%",
                          boxSizing: "border-box",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: "1 1 auto", minWidth: 0 }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 10,
                              background: isPublished ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.05)",
                              border: `1px solid ${isPublished ? "rgba(16, 185, 129, 0.4)" : "rgba(255, 255, 255, 0.1)"}`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 13,
                              fontWeight: 800,
                              color: isPublished ? "#34d399" : "#e2e8f0",
                              flexShrink: 0,
                            }}
                          >
                            {isPublished ? "✓" : `D${item.day || idx + 1}`}
                          </div>

                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: "2px 8px",
                                  borderRadius: 6,
                                  background: badge.bg,
                                  color: badge.color,
                                  border: `1px solid ${badge.color}33`,
                                }}
                              >
                                {badge.label}
                              </span>

                              {item.service && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    padding: "2px 8px",
                                    borderRadius: 6,
                                    background: "rgba(255, 255, 255, 0.05)",
                                    color: "#94a3b8",
                                  }}
                                >
                                  {item.service}
                                </span>
                              )}

                              {isPublished ? (
                                <span style={{ fontSize: 11, color: "#34d399", fontWeight: 700 }}>
                                  Live on Feed
                                </span>
                              ) : projectedDateLabel ? (
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    padding: "2px 8px",
                                    borderRadius: 6,
                                    background: config.enabled ? "rgba(56, 189, 248, 0.12)" : "rgba(255, 255, 255, 0.05)",
                                    color: config.enabled ? "#38bdf8" : "#94a3b8",
                                    border: `1px solid ${config.enabled ? "rgba(56, 189, 248, 0.25)" : "rgba(255, 255, 255, 0.1)"}`,
                                  }}
                                >
                                  📅 {config.enabled ? `Scheduled: ${projectedDateLabel}` : `Slot: ${projectedDateLabel}`}
                                </span>
                              ) : null}
                            </div>

                          <h4 style={{ margin: "0 0 4px 0", fontSize: 15, fontWeight: 700, color: "#ffffff", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                            {item.hook}
                          </h4>

                          <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.4, wordBreak: "break-word", overflowWrap: "anywhere" }}>
                            {item.topic}
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      {!isPublished && (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginLeft: "auto" }}>
                          <button
                            onClick={() => handleOpenEdit(idx, item)}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 600,
                              background: "rgba(255, 255, 255, 0.04)",
                              border: "1px solid rgba(255, 255, 255, 0.1)",
                              color: "#cbd5e1",
                              cursor: "pointer",
                            }}
                          >
                            ✏️ Edit
                          </button>

                          <button
                            onClick={() => handleRegenerateTopic(idx)}
                            disabled={isRegen}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 600,
                              background: "rgba(56, 189, 248, 0.08)",
                              border: "1px solid rgba(56, 189, 248, 0.25)",
                              color: "#38bdf8",
                              cursor: isRegen ? "not-allowed" : "pointer",
                            }}
                          >
                            {isRegen ? "Rerolling..." : "🔄 Regenerate"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
              </div>
            </div>
          ) : activeTab === "settings" ? (
            /* ═══════════════════════════════════════════
               TAB 2: SCHEDULE & CHANNEL SETTINGS
            ═══════════════════════════════════════════ */
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* 1. Destination Selection */}
              <div
                style={{
                  padding: "16px 18px",
                  borderRadius: 16,
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  boxSizing: "border-box",
                }}
              >
                <h3 style={{ margin: "0 0 6px 0", fontSize: 15, fontWeight: 800 }}>
                  1. Posting Destination Channel
                </h3>
                <p style={{ margin: "0 0 14px 0", fontSize: 13, color: "#94a3b8" }}>
                  Choose where your autonomous graphics and captions will be published:
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                  {[
                    {
                      id: "BOTH",
                      title: "Both Facebook & Instagram",
                      desc: "Simultaneous cross-posting for maximum reach and audience growth.",
                      badge: "Recommended",
                      icon: "✨",
                    },
                    {
                      id: "FACEBOOK_ONLY",
                      title: "Facebook Page Only",
                      desc: "Publishes graphics & link updates exclusively to your Facebook Page feed.",
                      icon: "📘",
                    },
                    {
                      id: "INSTAGRAM_ONLY",
                      title: "Instagram Only",
                      desc: "Publishes high-aesthetic 1:1 image cards and hashtags exclusively to Instagram.",
                      icon: "📸",
                    },
                  ].map((opt) => (
                    <div
                      key={opt.id}
                      onClick={() => saveConfig({ destination: opt.id })}
                      style={{
                        padding: "14px 16px",
                        borderRadius: 14,
                        cursor: "pointer",
                        background:
                          config.destination === opt.id
                            ? "linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%)"
                            : "rgba(255, 255, 255, 0.03)",
                        border: `1.5px solid ${
                          config.destination === opt.id ? "#38bdf8" : "rgba(255, 255, 255, 0.08)"
                        }`,
                        boxShadow: config.destination === opt.id ? "0 0 25px rgba(56, 189, 248, 0.15)" : "none",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 20 }}>{opt.icon}</span>
                        {opt.badge && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              padding: "2px 8px",
                              borderRadius: 999,
                              background: "rgba(16, 185, 129, 0.2)",
                              color: "#34d399",
                              border: "1px solid rgba(16, 185, 129, 0.4)",
                            }}
                          >
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      <h4 style={{ margin: "0 0 4px 0", fontSize: 13, fontWeight: 700, color: "#ffffff" }}>
                        {opt.title}
                      </h4>
                      <p style={{ margin: 0, fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>
                        {opt.desc}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Connection verification status */}
                <div style={{ marginTop: 14, display: "flex", gap: 16, fontSize: 12, color: "#94a3b8", flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span>Facebook:</span>
                    <strong style={{ color: hasFacebook ? "#34d399" : "#f87171" }}>
                      {hasFacebook ? `✅ Connected (${fbPageName || "Page Linked"})` : "❌ Not Connected"}
                    </strong>
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span>Instagram:</span>
                    <strong style={{ color: hasInstagram ? "#34d399" : "#f87171" }}>
                      {hasInstagram ? `✅ Connected (${igUsername ? `@${igUsername.replace(/^@/, "")}` : "Active"})` : "❌ Not Connected"}
                    </strong>
                  </span>
                  {!hasInstagram && hasFacebook && (
                    <span style={{ fontSize: 11, color: "#cbd5e1", background: "rgba(255, 255, 255, 0.05)", padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(255, 255, 255, 0.1)" }}>
                      💡 Tip: To enable Instagram, link an Instagram Professional account to your Facebook Page in Meta Business Suite, then click "Sync Business Info".
                    </span>
                  )}
                </div>
              </div>

              {/* 2. Frequency & Cadence */}
              <div
                style={{
                  padding: "16px 18px",
                  borderRadius: 16,
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  boxSizing: "border-box",
                }}
              >
                <h3 style={{ margin: "0 0 6px 0", fontSize: 15, fontWeight: 800 }}>
                  2. Autonomous Cadence Frequency
                </h3>
                <p style={{ margin: "0 0 14px 0", fontSize: 13, color: "#94a3b8" }}>
                  How often should GabbarInfo AI automatically generate and publish a creative?
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                  {[
                    { id: "daily", label: "Daily (30 Posts / Mo)", desc: "1 fresh post every single day" },
                    { id: "weekly_4", label: "4 Posts / Week", desc: "~16 posts / mo on peak days" },
                    { id: "alternate", label: "Every 2 Days", desc: "15 posts / mo evenly spaced" },
                    { id: "weekly", label: "Weekly (4 Posts / Mo)", desc: "1 high-impact post per week" },
                  ].map((cad) => (
                    <div
                      key={cad.id}
                      onClick={() => saveConfig({ cadence: cad.id })}
                      style={{
                        padding: "14px 16px",
                        borderRadius: 12,
                        cursor: "pointer",
                        background:
                          config.cadence === cad.id ? "rgba(56, 189, 248, 0.12)" : "rgba(255, 255, 255, 0.03)",
                        border: `1.5px solid ${
                          config.cadence === cad.id ? "#38bdf8" : "rgba(255, 255, 255, 0.08)"
                        }`,
                        transition: "all 0.2s ease",
                      }}
                    >
                      <h4 style={{ margin: "0 0 4px 0", fontSize: 13, fontWeight: 700, color: "#ffffff" }}>
                        {cad.label}
                      </h4>
                      <p style={{ margin: 0, fontSize: 11.5, color: "#94a3b8" }}>{cad.desc}</p>
                    </div>
                  ))}
                </div>

                {/* ── UPCOMING 7-DAY AUTONOMOUS DISPATCH CADENCE (PROJECTED DISPATCH SCHEDULE) ── */}
                <div
                  style={{
                    marginTop: 18,
                    paddingTop: 16,
                    borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 7,
                        background: "rgba(56, 189, 248, 0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        color: "#38bdf8",
                      }}
                    >
                      📅
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#fff" }}>
                        Upcoming 7-Day Velocity Cadence (Projected Dispatch Schedule)
                      </h4>
                      <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 2 }}>
                        Preview of automated creative generation days based on your chosen frequency ({
                          config.cadence === "daily"
                            ? "Daily Rollout (30 Posts/Mo)"
                            : config.cadence === "weekly_4"
                            ? "4 Posts / Week Frequency"
                            : config.cadence === "alternate"
                            ? "Every 2 Days Pace (15 Posts/Mo)"
                            : "Weekly Frequency (4 Posts/Mo)"
                        }). Creatives are generated & posted to your Meta feeds on active dates.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 }}>
                    {[0, 1, 2, 3, 4, 5, 6].map((offset) => {
                      const d = new Date();
                      d.setDate(d.getDate() + offset);
                      const isToday = offset === 0;

                      let isScheduled = false;
                      if (config.enabled && !isRestricted) {
                        if (config.cadence === "daily") {
                          isScheduled = true;
                        } else if (config.cadence === "alternate") {
                          isScheduled = offset % 2 === 0;
                        } else if (config.cadence === "weekly_4") {
                          isScheduled = [0, 2, 4, 5].includes(offset);
                        } else if (config.cadence === "weekly") {
                          isScheduled = offset === 0;
                        }
                      }

                      return (
                        <div
                          key={offset}
                          style={{
                            background: isToday ? "rgba(30, 41, 59, 0.9)" : "rgba(19, 27, 46, 0.7)",
                            border: isToday ? "1.5px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.08)",
                            borderRadius: 10,
                            padding: "12px 8px",
                            textAlign: "center",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            minHeight: 88,
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 10, color: isToday ? "#38bdf8" : "#94a3b8", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                              {isToday ? "TODAY" : d.toLocaleDateString("en-US", { weekday: "short" })}
                            </div>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#fff", marginTop: 3 }}>
                              {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </div>
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              marginTop: 8,
                              fontWeight: 700,
                              padding: "3px 6px",
                              borderRadius: 6,
                              background: !config.enabled
                                ? "rgba(255, 255, 255, 0.04)"
                                : isScheduled
                                ? "rgba(16, 185, 129, 0.15)"
                                : "rgba(255, 255, 255, 0.04)",
                              color: !config.enabled
                                ? "#64748b"
                                : isScheduled
                                ? "#34d399"
                                : "#64748b",
                              border: isScheduled && config.enabled
                                ? "1px solid rgba(16, 185, 129, 0.3)"
                                : "1px solid transparent",
                            }}
                          >
                            {!config.enabled
                              ? "⚪ Paused"
                              : isScheduled
                              ? "🟢 Active Dispatch"
                              : "⚪ Rest Day"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 3. Core Services & Brand Niche */}
              <div
                style={{
                  padding: "20px 24px",
                  borderRadius: 16,
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <h3 style={{ margin: "0 0 6px 0", fontSize: 16, fontWeight: 800 }}>
                  3. Services & Content Topics to Cycle
                </h3>
                <p style={{ margin: "0 0 14px 0", fontSize: 13, color: "#94a3b8" }}>
                  The AI rotates through these core services to ensure non-repetitive topic generation:
                </p>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {(config.services || []).map((service, sIdx) => (
                    <span
                      key={sIdx}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        borderRadius: 8,
                        background: "rgba(56, 189, 248, 0.12)",
                        border: "1px solid rgba(56, 189, 248, 0.25)",
                        color: "#e2e8f0",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {service}
                      <button
                        onClick={() => handleRemoveServiceTag(service)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#94a3b8",
                          cursor: "pointer",
                          padding: 0,
                          fontSize: 14,
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 10, maxWidth: 450 }}>
                  <input
                    type="text"
                    value={newServiceTag}
                    onChange={(e) => setNewServiceTag(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddServiceTag()}
                    placeholder="Add a service or product (e.g. Graphic Design)..."
                    style={{
                      flex: 1,
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#fff",
                      fontSize: 13,
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={handleAddServiceTag}
                    style={{
                      padding: "10px 18px",
                      borderRadius: 10,
                      border: "none",
                      background: "#38bdf8",
                      color: "#030712",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ═══════════════════════════════════════════
               TAB 3: PUBLISHED POSTS HISTORY
            ═══════════════════════════════════════════ */
            <div>
              {(!config.history || config.history.length === 0) ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>📸</div>
                  <h4 style={{ margin: "0 0 6px 0", color: "#ffffff", fontSize: 16 }}>
                    No Automated Posts Published Yet
                  </h4>
                  <p style={{ margin: 0, fontSize: 13 }}>
                    When Autopilot triggers, your published graphics and direct links will appear here.
                  </p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))", gap: 16, width: "100%", boxSizing: "border-box" }}>
                  {config.history.map((hist, hIdx) => (
                    <div
                      key={hIdx}
                      style={{
                        borderRadius: 16,
                        overflow: "hidden",
                        background: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      {hist.imageUrl && (
                        <div style={{ position: "relative", width: "100%", height: 200, background: "#0a0e17" }}>
                          <img
                            src={hist.imageUrl}
                            alt={hist.topic}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        </div>
                      )}

                      <div style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>
                            {new Date(hist.date).toLocaleDateString()}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              padding: "2px 8px",
                              borderRadius: 6,
                              background: "rgba(16, 185, 129, 0.15)",
                              color: "#34d399",
                            }}
                          >
                            {hist.destination}
                          </span>
                        </div>

                        <h5 style={{ margin: "0 0 6px 0", fontSize: 14, fontWeight: 700, color: "#ffffff" }}>
                          {hist.hook}
                        </h5>
                        <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#94a3b8", lineHeight: 1.4, flex: 1 }}>
                          {hist.topic}
                        </p>

                        {hist.postUrl && (
                          <a
                            href={hist.postUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                              padding: "8px 12px",
                              borderRadius: 8,
                              background: "rgba(56, 189, 248, 0.12)",
                              border: "1px solid rgba(56, 189, 248, 0.25)",
                              color: "#38bdf8",
                              fontSize: 12,
                              fontWeight: 700,
                              textDecoration: "none",
                              marginTop: 6,
                              transition: "all 0.2s ease",
                            }}
                          >
                            View Live Post ↗
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── EDIT TOPIC POPUP MODAL ── */}
        {editingIndex !== null && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 10000,
              background: "rgba(0, 0, 0, 0.75)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 480,
                background: "#0f172a",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: 18,
                padding: "24px 26px",
                color: "#ffffff",
              }}
            >
              <h3 style={{ margin: "0 0 14px 0", fontSize: 17, fontWeight: 800 }}>
                ✏️ Edit Planned Topic (Day {editingIndex + 1})
              </h3>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>
                  Headline Hook:
                </label>
                <input
                  type="text"
                  value={editHookText}
                  onChange={(e) => setEditHookText(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#ffffff",
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>
                  Topic Angle & Details:
                </label>
                <textarea
                  rows={3}
                  value={editTopicText}
                  onChange={(e) => setEditTopicText(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#ffffff",
                    fontSize: 13,
                    outline: "none",
                    resize: "none",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  onClick={() => setEditingIndex(null)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    background: "transparent",
                    color: "#cbd5e1",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 8,
                    border: "none",
                    background: "#38bdf8",
                    color: "#030712",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
