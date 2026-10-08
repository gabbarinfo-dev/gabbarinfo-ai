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
  const [publishing, setPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(null);
  const [publishError, setPublishError] = useState(null);

  const fetchStatus = async () => {
    try {
      setStatus("loading");
      const res = await fetch("/api/linkedin/status");
      const data = await res.json();
      if (data.ok && data.connected) {
        setStatus("connected");
        setConnData(data);
        if (data.member?.urn) {
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

  useEffect(() => {
    fetchStatus();

    // Check query params for newly connected notification
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("linkedin_connected") === "1") {
        setPublishSuccess({
          message: "LinkedIn connected successfully! You can now compose and publish posts.",
        });
      }
    }
  }, []);

  const handleConnect = () => {
    window.location.href = "/api/linkedin/connect";
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

  const handleGenerateAiPost = async () => {
    if (!postTopic.trim()) {
      alert("Please enter a topic or theme for the AI to draft your post.");
      return;
    }
    try {
      setGenerating(true);
      setPublishError(null);
      const res = await fetch("/api/linkedin/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: postTopic,
          brandName: connData?.member?.name || "Business",
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

  const handlePublishPost = async () => {
    if (!commentary.trim()) {
      alert("Post commentary cannot be empty.");
      return;
    }
    try {
      setPublishing(true);
      setPublishError(null);
      setPublishSuccess(null);

      const res = await fetch("/api/linkedin/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentary: commentary.trim(),
          imageUrl: imageUrl.trim() || null,
          targetUrn: selectedAuthorUrn || connData?.member?.urn,
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

  const member = connData?.member;
  const orgs = connData?.organizations || [];

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
                LinkedIn Pilot & B2B Syndicate
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
              Autonomous thought-leadership publishing, personal branding, and company page broadcasts via GabbarInfo AI.
            </p>
          </div>
        </div>

        {status === "connected" ? (
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            style={{
              padding: "9px 18px",
              borderRadius: 10,
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#f87171",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            {disconnecting ? "Disconnecting…" : "Disconnect Account"}
          </button>
        ) : (
          <button
            onClick={handleConnect}
            style={{
              padding: "10px 22px",
              borderRadius: 10,
              background: "#0a66c2",
              border: "none",
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(10, 102, 194, 0.4)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>Connect LinkedIn</span>
            <span>↗</span>
          </button>
        )}
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

      {/* ── VIEW 1: DISCONNECTED ONBOARDING ── */}
      {status === "idle" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 460px), 1fr))",
            gap: 24,
          }}
        >
          {/* Card A: Connect CTA & Value */}
          <div
            style={{
              padding: 28,
              borderRadius: 20,
              background: "rgba(14, 19, 30, 0.85)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "1px",
                  color: "#60a5fa",
                  textTransform: "uppercase",
                }}
              >
                LinkedIn Pilot Engine
              </span>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: "10px 0 14px" }}>
                Supercharge Your B2B Organic Reach
              </h3>
              <p style={{ color: "#94a3b8", fontSize: 13.5, lineHeight: 1.6, margin: "0 0 20px" }}>
                Connect your LinkedIn profile or company page to authorize GabbarInfo AI to publish high-engagement thought-leadership insights, industry analyses, and brand updates on autopilot.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                {[
                  { icon: "✍️", title: "AI Copy Engine", desc: "Crafts high-converting B2B copy with hooks & hashtags." },
                  { icon: "🖼️", title: "Visual Media Support", desc: "Uploads and attaches high-res creatives with your posts." },
                  { icon: "🔒", title: "Zero Interference", desc: "Completely separated from Facebook & Instagram schedules." },
                ].map((item, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <span style={{ fontSize: 18 }}>{item.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{item.title}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleConnect}
              style={{
                width: "100%",
                padding: "14px 20px",
                borderRadius: 12,
                background: "#0a66c2",
                border: "none",
                color: "#ffffff",
                fontWeight: 800,
                fontSize: 14,
                cursor: "pointer",
                boxShadow: "0 4px 20px rgba(10, 102, 194, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
            >
              <span>Connect with LinkedIn</span>
              <span>↗</span>
            </button>
          </div>

          {/* Card B: Developer Portal Status & Readiness Checklist */}
          <div
            style={{
              padding: 28,
              borderRadius: 20,
              background: "rgba(10, 15, 26, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "1px",
                color: "#38bdf8",
                textTransform: "uppercase",
              }}
            >
              Setup Checklist
            </span>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#fff", margin: "10px 0 14px" }}>
              App Configuration Status
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                }}
              >
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Client ID</div>
                <div style={{ fontSize: 13, color: "#38bdf8", fontFamily: "monospace", marginTop: 2 }}>
                  77oka1wp8jfhsu
                </div>
              </div>

              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                }}
              >
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Authorized Redirect URL</div>
                <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace", marginTop: 2 }}>
                  https://ai.gabbarinfo.com/api/linkedin/callback
                </div>
              </div>

              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "rgba(59, 130, 246, 0.08)",
                  border: "1px solid rgba(59, 130, 246, 0.2)",
                  marginTop: 6,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: "#93c5fd", marginBottom: 6 }}>
                  💡 In LinkedIn Developer Portal:
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>
                  <li>Click <strong>Request access</strong> on <strong>Share on LinkedIn</strong> (instant)</li>
                  <li>Click <strong>Request access</strong> on <strong>Sign In with LinkedIn using OpenID Connect</strong> (instant)</li>
                  <li>In <strong>Auth</strong> tab, verify Redirect URL matches above.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW 2: CONNECTED PILOT WORKSTATION ── */}
      {status === "connected" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 460px), 1fr))", gap: 24 }}>
          {/* Column 1: Connected Profile & AI Composer */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Account Card */}
            <div
              style={{
                padding: "20px 24px",
                borderRadius: 18,
                background: "rgba(14, 19, 30, 0.85)",
                border: "1px solid rgba(10, 102, 194, 0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {member?.picture ? (
                  <img
                    src={member.picture}
                    alt={member.name}
                    style={{ width: 48, height: 48, borderRadius: "50%", border: "2px solid #0a66c2", objectFit: "cover" }}
                  />
                ) : (
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      background: "rgba(10, 102, 194, 0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                      color: "#60a5fa",
                    }}
                  >
                    👤
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#ffffff" }}>
                    {member?.name || "Connected Member"}
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>
                    {member?.email || connData?.member?.urn}
                  </div>
                </div>
              </div>

              {orgs.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>Post As:</label>
                  <select
                    value={selectedAuthorUrn}
                    onChange={(e) => setSelectedAuthorUrn(e.target.value)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      background: "#0b1220",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      color: "#fff",
                      fontSize: 12,
                    }}
                  >
                    <option value={member?.urn}>Personal Profile ({member?.name})</option>
                    {orgs.map((org, i) => (
                      <option key={i} value={org.organizationalTarget}>
                        Organization ({org.organizationalTarget})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* AI Composer */}
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

              {/* AI Prompt Input */}
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  type="text"
                  placeholder="Enter topic e.g. '5 Lessons in scaling B2B SaaS' or 'Hiring tips'..."
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
                rows={7}
                placeholder="Write your LinkedIn thought-leadership post here..."
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

              {/* Image URL Input */}
              <div>
                <label style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Optional Image URL (Public HTTPS link):
                </label>
                <input
                  type="text"
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#fff",
                    fontSize: 12.5,
                  }}
                />
              </div>

              {/* Action Buttons */}
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
                {member?.picture ? (
                  <img src={member.picture} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#0a66c2", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800 }}>
                    IN
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffff" }}>
                    {member?.name || "Your Name"}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    Thought Leader • Just now • 🌐 Public
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
              <strong>💡 LinkedIn Engagement Pro-Tip:</strong> Posts with 3-5 line breaks and 3 targeted hashtags receive up to 40% higher organic impressions. Add an open-ended question at the end to trigger comments and algorithmic boosts!
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
