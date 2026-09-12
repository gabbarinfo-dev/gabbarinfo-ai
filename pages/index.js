"use client";

import { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Head from "next/head";
import FacebookBusinessConnect from "./components/facebook/FacebookBusinessConnect";
import GoogleAdsAccountConnect from "./components/google/googleadsaccountconnect";
import GoogleBusinessConnect from "./components/google/GoogleBusinessConnect";
import WordPressSiteConnect from "./components/wordpress/WordPressSiteConnect";
import SubscriptionModal from "./components/SubscriptionModal";
import SocialMediaPlannerModal from "./components/social/SocialMediaPlannerModal";
import CyberMatrixBackground from "./components/CyberMatrixBackground";

export default function HomePage() {
  const { data: session, status } = useSession();

  const [subData, setSubData] = useState(null);
  const [loadingSub, setLoadingSub] = useState(true);

  const role = session?.user?.role || "client";
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showSocialPlanner, setShowSocialPlanner] = useState(false);
  const [hasWpConnected, setHasWpConnected] = useState(false);
  const [showWpConnectPrompt, setShowWpConnectPrompt] = useState(false);

  // ── Workstation Navigation States ──
  // activeTab: "overview" | "wordpress" | "social" | "gmb" | "ads" | "billing"
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // viewMode: "modular" | "classic" (Single-page vertical scroll fallback)
  const [viewMode, setViewMode] = useState("modular");

  /* -------------------------
     LOAD PERSISTED VIEW MODE & PREFERENCES
  ------------------------- */
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem("gabbarinfo_view_mode");
      if (savedMode === "classic" || savedMode === "modular") {
        setViewMode(savedMode);
      }
      const savedTab = localStorage.getItem("gabbarinfo_active_tab");
      if (savedTab) {
        setActiveTab(savedTab);
      }
    } catch (_) {}
  }, []);

  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem("gabbarinfo_view_mode", mode);
    } catch (_) {}
  };

  const handleSelectTab = (tab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    try {
      localStorage.setItem("gabbarinfo_active_tab", tab);
    } catch (_) {}
  };

  /* -------------------------
     LOAD SUBSCRIPTION & WP STATUS
  ------------------------- */
  useEffect(() => {
    if (!session) return;

    async function fetchSubscriptionStatus() {
      try {
        const res = await fetch("/api/subscriptions/status");
        if (!res.ok) return;
        const data = await res.json();
        if (data.ok) {
          setSubData(data);
        }
      } catch (err) {
        console.error("Subscription status fetch error:", err);
      } finally {
        setLoadingSub(false);
      }
    }

    async function checkWpConnections() {
      try {
        const res = await fetch("/api/wordpress/sync?action=get-connection");
        if (!res.ok) return;
        const data = await res.json();
        if (data.ok) {
          const all = data.allConnections || {};
          const hasAny = Boolean(data.connection?.siteUrl || Object.values(all).some((c) => c?.siteUrl));
          setHasWpConnected(hasAny);
        }
      } catch (e) {
        console.warn("Failed to check wp connection:", e);
      }
    }

    fetchSubscriptionStatus();
    checkWpConnections();
  }, [session]);

  /* -------------------------
     AUTH LOADING
  ------------------------- */
  if (status === "loading") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#080b11",
          color: "#94a3b8",
          fontSize: 16,
          fontFamily: "Plus Jakarta Sans, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🚀</div>
          <div>Initializing GabbarInfo AI…</div>
        </div>
      </div>
    );
  }

  /* -------------------------
     NOT LOGGED IN (HIGH-TECH CYBER MATRIX LANDING)
  ------------------------- */
  if (!session) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#080b11",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 16px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Head>
          <title>GabbarInfo AI · Autonomous Digital Marketing Strategist</title>
        </Head>

        {/* Cybernetic Falling Code & 3D Rotating Geometric Wireframes Background */}
        <CyberMatrixBackground showGeometric={true} />

        {/* Luxury AI Glass Card */}
        <div
          style={{
            maxWidth: 480,
            width: "100%",
            background: "linear-gradient(180deg, rgba(16, 22, 34, 0.88) 0%, rgba(8, 11, 17, 0.95) 100%)",
            backdropFilter: "blur(28px)",
            WebkitBackdropFilter: "blur(28px)",
            border: "1px solid rgba(255, 255, 255, 0.16)",
            borderRadius: 24,
            padding: "44px 38px",
            boxShadow: "0 30px 80px rgba(0, 0, 0, 0.85), 0 0 50px rgba(59, 130, 246, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
            position: "relative",
            zIndex: 1,
            textAlign: "center",
          }}
        >
          {/* Brand Emblem */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 68,
              height: 68,
              borderRadius: 20,
              background: "linear-gradient(135deg, rgba(59, 130, 246, 0.25) 0%, rgba(8, 11, 17, 0.9) 100%)",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              marginBottom: 18,
              boxShadow: "0 0 30px rgba(59, 130, 246, 0.35)",
            }}
          >
            <span style={{ fontSize: 32 }}>🚀</span>
          </div>

          <h1
            style={{
              fontSize: "clamp(24px, 5vw, 30px)",
              fontWeight: 800,
              letterSpacing: "-0.8px",
              margin: "0 0 8px 0",
              background: "linear-gradient(135deg, #ffffff 30%, #94a3b8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            GabbarInfo AI
          </h1>

          <p style={{ color: "#94a3b8", fontSize: 14, margin: "0 0 28px 0", lineHeight: 1.5 }}>
            Autonomous Digital Marketing Strategist · Google Ads, Meta Ads & WordPress SEO Autopilot
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "left", marginBottom: 30 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#e2e8f0", background: "rgba(255, 255, 255, 0.04)", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
              <span style={{ color: "#38bdf8", fontSize: 15, fontWeight: "bold" }}>✓</span> Autonomous SEO Content Engine & Rank Acceleration
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#e2e8f0", background: "rgba(255, 255, 255, 0.04)", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
              <span style={{ color: "#38bdf8", fontSize: 15, fontWeight: "bold" }}>✓</span> Performance Google Ads & Search Budget Optimization
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#e2e8f0", background: "rgba(255, 255, 255, 0.04)", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
              <span style={{ color: "#38bdf8", fontSize: 15, fontWeight: "bold" }}>✓</span> Meta Social Media Planner & Dual-Platform Syndication
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <button
              onClick={() => signIn("google")}
              className="btn-gabbar-primary"
              style={{
                width: "100%",
                padding: "14px 22px",
                fontSize: 15,
                justifyContent: "center",
                display: "flex",
                alignItems: "center",
                gap: 12,
                cursor: "pointer",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Continue with Google ↗</span>
            </button>

            <button
              onClick={() => signIn("facebook")}
              className="btn-gabbar-secondary"
              style={{
                width: "100%",
                padding: "14px 22px",
                fontSize: 15,
                justifyContent: "center",
                display: "flex",
                alignItems: "center",
                gap: 12,
                cursor: "pointer",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              <span>Continue with Facebook ↗</span>
            </button>
          </div>

          <div style={{ marginTop: 26, fontSize: 12, color: "#64748b", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span>🔒</span> Enterprise 256-Bit Encrypted OAuth Security
            </div>
            <div>
              <a
                href="https://www.gabbarinfo.com/privacy-policy/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#94a3b8", textDecoration: "underline", fontSize: 12 }}
              >
                Privacy Policy
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* -------------------------
     LOGGED IN VIEW (EXECUTIVE AI SIDEBAR WORKSTATION)
  ------------------------- */
  const planId = (subData?.subscription?.planId || "none").toLowerCase();
  const isTrialOrNone = planId === "none" || planId === "try";
  const isTrial99 = planId === "trial_99" || planId === "trial-99";

  const NAV_ITEMS = [
    { id: "overview", label: "Command Center", icon: "🚀", badge: "Live" },
    { id: "wordpress", label: "WordPress & SEO", icon: "🌐", badge: hasWpConnected ? "Paired" : null },
    { id: "social", label: "Social Autopilot", icon: "📱", badge: "FB + IG" },
    { id: "gmb", label: "Local Maps (GMB)", icon: "📍", badge: "Maps" },
    { id: "ads", label: "Performance Ads", icon: "🎯", badge: "PPC" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#070a10",
        color: "#f8fafc",
        fontFamily: "Plus Jakarta Sans, -apple-system, sans-serif",
        overflowX: "hidden",
        width: "100%",
        maxWidth: "100vw",
        display: "flex",
        position: "relative",
      }}
    >
      <Head>
        <title>Command Center | GabbarInfo AI</title>
      </Head>

      {/* ── MOBILE BACKDROP OVERLAY ── */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(3, 7, 18, 0.8)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            zIndex: 9998,
          }}
        />
      )}

      {/* ── EXECUTIVE LEFT SIDEBAR (COLLAPSIBLE / RESPONSIVE DRAWER) ── */}
      <aside
        style={{
          width: sidebarCollapsed ? 72 : 260,
          minWidth: sidebarCollapsed ? 72 : 260,
          background: "linear-gradient(180deg, #0b101c 0%, #080d16 100%)",
          borderRight: "1px solid rgba(255, 255, 255, 0.08)",
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 9999,
          transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          boxShadow: "10px 0 35px rgba(0, 0, 0, 0.5)",
        }}
        className={`sidebar-container ${mobileMenuOpen ? "mobile-drawer-open" : ""}`}
      >
        {/* Sidebar Brand Header */}
        <div
          style={{
            padding: sidebarCollapsed ? "14px 8px 12px" : "20px 20px 16px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
            display: "flex",
            flexDirection: sidebarCollapsed ? "column" : "row",
            alignItems: "center",
            justifyContent: sidebarCollapsed ? "center" : "space-between",
            gap: sidebarCollapsed ? 8 : 0,
          }}
        >
          <div
            onClick={() => {
              if (sidebarCollapsed) {
                setSidebarCollapsed(false);
              } else {
                handleSelectTab("overview");
              }
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              overflow: "hidden",
            }}
            title={sidebarCollapsed ? "Click to expand sidebar" : "Command Center Overview"}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "linear-gradient(135deg, rgba(59, 130, 246, 0.25) 0%, rgba(8, 11, 17, 0.9) 100%)",
                border: "1px solid rgba(59, 130, 246, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                flexShrink: 0,
                boxShadow: "0 0 15px rgba(59, 130, 246, 0.3)",
              }}
            >
              🚀
            </div>
            {!sidebarCollapsed && (
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em", color: "#fff", whiteSpace: "nowrap" }}>
                  GabbarInfo AI
                </div>
                <div style={{ fontSize: 10.5, color: "#34d399", display: "flex", alignItems: "center", gap: 5, fontWeight: 700 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
                  CLUSTER ONLINE
                </div>
              </div>
            )}
          </div>

          {/* Desktop Collapse / Expand Toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{
              background: sidebarCollapsed ? "rgba(59, 130, 246, 0.18)" : "rgba(255, 255, 255, 0.04)",
              border: sidebarCollapsed ? "1px solid rgba(59, 130, 246, 0.45)" : "1px solid rgba(255, 255, 255, 0.08)",
              color: sidebarCollapsed ? "#60a5fa" : "#94a3b8",
              width: sidebarCollapsed ? 36 : 26,
              height: sidebarCollapsed ? 26 : 26,
              borderRadius: 8,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: sidebarCollapsed ? 15 : 12,
              fontWeight: 800,
              transition: "all 0.2s ease",
              boxShadow: sidebarCollapsed ? "0 0 12px rgba(59, 130, 246, 0.3)" : "none",
            }}
            title={sidebarCollapsed ? "Expand Sidebar (›)" : "Collapse Sidebar (‹)"}
          >
            {sidebarCollapsed ? "›" : "‹"}
          </button>
        </div>

        {/* Plan Status Tile */}
        {!sidebarCollapsed && (
          <div
            style={{
              margin: "14px 14px 10px",
              padding: "12px 14px",
              borderRadius: 14,
              background: isTrial99
                ? "linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(234, 88, 12, 0.08) 100%)"
                : isTrialOrNone
                ? "rgba(245, 158, 11, 0.08)"
                : "linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(30, 64, 175, 0.08) 100%)",
              border: isTrial99 || isTrialOrNone
                ? "1px solid rgba(245, 158, 11, 0.3)"
                : "1px solid rgba(37, 99, 235, 0.3)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: isTrial99 || isTrialOrNone ? "#fbbf24" : "#60a5fa", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Active Plan
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "1px 6px",
                  borderRadius: 999,
                  background: isTrial99 ? "#ea580c" : isTrialOrNone ? "rgba(245, 158, 11, 0.2)" : "#2563eb",
                  color: "#fff",
                }}
              >
                {isTrial99 ? "₹99 Trial" : isTrialOrNone ? "Free" : "Active"}
              </span>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: "#fff", marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {loadingSub ? "Loading…" : isTrial99 ? "🎁 Power Sampler" : isTrialOrNone ? "Free Explorer" : subData?.subscription?.planName}
            </div>
            <button
              onClick={() => setShowSubscriptionModal(true)}
              style={{
                width: "100%",
                padding: "6px 10px",
                borderRadius: 8,
                border: "none",
                background: isTrial99 || isTrialOrNone
                  ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                  : "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                color: isTrial99 || isTrialOrNone ? "#0f172a" : "#ffffff",
                fontWeight: 800,
                fontSize: 11,
                cursor: "pointer",
                boxShadow: "0 2px 10px rgba(0, 0, 0, 0.3)",
              }}
            >
              {isTrial99 || isTrialOrNone ? "⚡ Upgrade Plan ↗" : "Manage Subscription"}
            </button>
          </div>
        )}

        {/* Navigation Items List */}
        <div style={{ flex: 1, overflowY: "auto", padding: sidebarCollapsed ? "12px 8px" : "10px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                style={{
                  width: "100%",
                  padding: sidebarCollapsed ? "12px 0" : "10px 14px",
                  borderRadius: 12,
                  border: isActive ? "1px solid rgba(59, 130, 246, 0.4)" : "1px solid transparent",
                  background: isActive
                    ? "linear-gradient(90deg, rgba(37, 99, 235, 0.22) 0%, rgba(15, 23, 42, 0.4) 100%)"
                    : "transparent",
                  color: isActive ? "#ffffff" : "#94a3b8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: sidebarCollapsed ? "center" : "space-between",
                  cursor: "pointer",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 13,
                  transition: "all 0.15s ease",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                    e.currentTarget.style.color = "#f1f5f9";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#94a3b8";
                  }
                }}
                title={sidebarCollapsed ? item.label : ""}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 18, filter: isActive ? "drop-shadow(0 0 8px rgba(59, 130, 246, 0.6))" : "none" }}>
                    {item.icon}
                  </span>
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </div>

                {!sidebarCollapsed && item.badge && (
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 800,
                      padding: "2px 6px",
                      borderRadius: 999,
                      background: item.badge === "Live" || item.badge === "Paired" ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.08)",
                      color: item.badge === "Live" || item.badge === "Paired" ? "#34d399" : "#94a3b8",
                      border: item.badge === "Live" || item.badge === "Paired" ? "1px solid rgba(16, 185, 129, 0.3)" : "none",
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div style={{ height: 1, background: "rgba(255, 255, 255, 0.06)", margin: "8px 4px" }} />

          {/* Quick Direct Launchers */}
          <a
            href="/chat"
            style={{
              padding: sidebarCollapsed ? "12px 0" : "10px 14px",
              borderRadius: 12,
              color: "#cbd5e1",
              display: "flex",
              alignItems: "center",
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
              gap: 12,
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 600,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            title="Chat Agent"
          >
            <span style={{ fontSize: 18 }}>💬</span>
            {!sidebarCollapsed && <span>AI Strategy Chat ↗</span>}
          </a>

          <a
            href="/seo"
            onClick={(e) => {
              if (!hasWpConnected) {
                e.preventDefault();
                setShowWpConnectPrompt(true);
              }
            }}
            style={{
              padding: sidebarCollapsed ? "12px 0" : "10px 14px",
              borderRadius: 12,
              color: "#cbd5e1",
              display: "flex",
              alignItems: "center",
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
              gap: 12,
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 600,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            title="Full SEO Suite"
          >
            <span style={{ fontSize: 18 }}>🔍</span>
            {!sidebarCollapsed && <span>Autonomous SEO Suite ↗</span>}
          </a>

          <button
            onClick={() => setShowSocialPlanner(true)}
            style={{
              width: "100%",
              padding: sidebarCollapsed ? "12px 0" : "10px 14px",
              borderRadius: 12,
              background: "transparent",
              border: "none",
              color: "#cbd5e1",
              display: "flex",
              alignItems: "center",
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
              gap: 12,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
              textAlign: "left",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            title="Social Media Planner"
          >
            <span style={{ fontSize: 18 }}>📅</span>
            {!sidebarCollapsed && <span>Social Media Planner ↗</span>}
          </button>

          {role === "owner" && (
            <a
              href="/admin"
              style={{
                padding: sidebarCollapsed ? "12px 0" : "10px 14px",
                borderRadius: 12,
                color: "#f59e0b",
                display: "flex",
                alignItems: "center",
                justifyContent: sidebarCollapsed ? "center" : "flex-start",
                gap: 12,
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 600,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(245, 158, 11, 0.08)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              title="Admin Portal"
            >
              <span style={{ fontSize: 18 }}>⚙️</span>
              {!sidebarCollapsed && <span>Admin Console</span>}
            </a>
          )}
        </div>

        {/* Sidebar User Footer */}
        <div
          style={{
            padding: sidebarCollapsed ? "12px 6px" : "16px 18px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            flexDirection: sidebarCollapsed ? "column" : "row",
            alignItems: "center",
            justifyContent: sidebarCollapsed ? "center" : "space-between",
            gap: sidebarCollapsed ? 8 : 0,
            background: "rgba(0, 0, 0, 0.2)",
          }}
        >
          {sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(false)}
              style={{
                background: "rgba(59, 130, 246, 0.12)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                borderRadius: 8,
                color: "#60a5fa",
                cursor: "pointer",
                padding: "6px",
                width: "100%",
                fontSize: 10.5,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                transition: "all 0.15s",
              }}
              title="Expand Sidebar (Reopen)"
            >
              <span>››</span>
              <span>Open</span>
            </button>
          )}

          {!sidebarCollapsed && (
            <div style={{ minWidth: 0, flex: 1, marginRight: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#f1f5f9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {session.user.name || session.user.email?.split("@")[0] || "User"}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {session.user.email}
              </div>
            </div>
          )}

          <button
            onClick={() => signOut()}
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 8,
              color: "#94a3b8",
              cursor: "pointer",
              padding: sidebarCollapsed ? "8px" : "6px 10px",
              width: sidebarCollapsed ? "100%" : "auto",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              transition: "all 0.15s",
            }}
            title="Sign Out"
          >
            <span>🚪</span>
            {!sidebarCollapsed && <span>Exit</span>}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT WORKSTATION AREA ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          width: "100%",
          maxWidth: "100vw",
          boxSizing: "border-box",
          paddingLeft: sidebarCollapsed ? 72 : 260,
          transition: "padding-left 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        className="main-workstation-content"
      >
        {/* TOP WORKSTATION HEADER */}
        <header
          style={{
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            padding: "clamp(12px, 2.5vw, 16px) clamp(16px, 3.5vw, 28px)",
            background: "rgba(10, 14, 23, 0.88)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            position: "sticky",
            top: 0,
            zIndex: 900,
            gap: 12,
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {/* Left: Mobile Hamburger + Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="mobile-hamburger-btn"
              style={{
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: 8,
                color: "#ffffff",
                padding: "8px 10px",
                fontSize: 16,
                cursor: "pointer",
                display: "none",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ☰
            </button>

            {/* Desktop Quick Reopen Toggle when Collapsed */}
            {sidebarCollapsed && (
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="hide-on-mobile"
                style={{
                  background: "rgba(59, 130, 246, 0.12)",
                  border: "1px solid rgba(59, 130, 246, 0.35)",
                  borderRadius: 8,
                  color: "#60a5fa",
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.15s ease",
                }}
                title="Expand Sidebar (Click to reopen)"
              >
                <span style={{ fontSize: 14, fontWeight: 900 }}>›</span>
                <span>Expand Sidebar</span>
              </button>
            )}

            {/* Current Active Tab Title */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{ fontSize: 18 }}>
                {NAV_ITEMS.find((n) => n.id === activeTab)?.icon || "🚀"}
              </span>
              <h2
                style={{
                  margin: 0,
                  fontSize: "clamp(15px, 2.5vw, 18px)",
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  color: "#ffffff",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {viewMode === "classic"
                  ? "All Engines (Classic View)"
                  : NAV_ITEMS.find((n) => n.id === activeTab)?.label || "Command Center"}
              </h2>
            </div>
          </div>

          {/* Right: Quick Plan Pill + Layout View Switcher */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {/* 1-Click View Mode Switcher */}
            <div
              style={{
                display: "flex",
                background: "rgba(255, 255, 255, 0.04)",
                padding: 3,
                borderRadius: 10,
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <button
                onClick={() => handleSetViewMode("modular")}
                style={{
                  padding: "5px 10px",
                  borderRadius: 7,
                  border: "none",
                  background: viewMode === "modular" ? "#2563eb" : "transparent",
                  color: viewMode === "modular" ? "#fff" : "#94a3b8",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                title="Sleek modular tabs with animated AI telemetry"
              >
                🎛️ Modular
              </button>
              <button
                onClick={() => handleSetViewMode("classic")}
                style={{
                  padding: "5px 10px",
                  borderRadius: 7,
                  border: "none",
                  background: viewMode === "classic" ? "#2563eb" : "transparent",
                  color: viewMode === "classic" ? "#fff" : "#94a3b8",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                title="Single-page vertical scroll view"
              >
                📜 Classic
              </button>
            </div>

            {/* Quick Upgrade CTA */}
            {(isTrialOrNone || isTrial99) && (
              <button
                onClick={() => setShowSubscriptionModal(true)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: "none",
                  background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                  color: "#0f172a",
                  fontSize: 11.5,
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: "0 0 15px rgba(245, 158, 11, 0.35)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>⚡</span>
                <span className="hide-on-mobile">{isTrial99 ? "₹99 Active · Upgrade" : "Unlock Growth Suite"}</span>
              </button>
            )}
          </div>
        </header>

        {/* MOBILE HORIZONTAL PILL TABS STRIP (FOR QUICK 1-THUMB NAVIGATION) */}
        {viewMode === "modular" && (
          <div
            className="mobile-tabs-strip"
            style={{
              display: "none",
              overflowX: "auto",
              padding: "10px 14px",
              background: "rgba(11, 16, 28, 0.95)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
              gap: 8,
              scrollbarWidth: "none",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: isActive ? "1px solid #3b82f6" : "1px solid rgba(255, 255, 255, 0.1)",
                    background: isActive ? "#2563eb" : "rgba(255, 255, 255, 0.04)",
                    color: isActive ? "#fff" : "#94a3b8",
                    fontSize: 12,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexShrink: 0,
                  }}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* MAIN BODY CONTAINER */}
        <main
          style={{
            flex: 1,
            padding: "clamp(16px, 3.5vw, 32px) clamp(14px, 3.5vw, 28px)",
            maxWidth: 1200,
            width: "100%",
            margin: "0 auto",
            boxSizing: "border-box",
          }}
        >
          {session?.user?.email?.includes("@facebook.gabbarinfo.ai") && (
            <EmailFallbackForm />
          )}

          {/* ══════════════════════════════════════════════════════════
              VIEW MODE: MODULAR WORKSTATION
          ══════════════════════════════════════════════════════════ */}
          {viewMode === "modular" ? (
            <div>
              {/* TAB 1: COMMAND CENTER (HERO + QUOTAS + 4-STAGE PIPELINE) */}
              {activeTab === "overview" && (
                <div>
                  {/* Hero Box */}
                  <div
                    style={{
                      background: "linear-gradient(180deg, rgba(16, 22, 34, 0.85) 0%, rgba(10, 14, 23, 0.95) 100%)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      borderRadius: 20,
                      padding: "clamp(20px, 4vw, 32px) clamp(16px, 4vw, 36px)",
                      marginBottom: 28,
                      boxShadow: "0 25px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(56, 189, 248, 0.08)",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 2,
                        background: "linear-gradient(90deg, transparent 0%, #38bdf8 30%, #818cf8 70%, transparent 100%)",
                      }}
                    />

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 20 }}>
                      <div style={{ minWidth: 0, flex: "1 1 300px" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 14px", borderRadius: 999, background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.35)", marginBottom: 14 }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 10px #10b981", animation: "radarPulse 2s infinite" }} />
                          <span style={{ color: "#34d399", fontSize: 11, fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase" }}>
                            Autonomous Marketing Cluster Active
                          </span>
                        </div>

                        <h1 style={{ margin: "0 0 10px 0", fontSize: "clamp(22px, 5vw, 30px)", fontWeight: 800, letterSpacing: "-0.6px", color: "#ffffff", wordBreak: "break-word" }}>
                          Welcome to GabbarInfo AI Command Center 🚀
                        </h1>
                        <p style={{ margin: 0, color: "#94a3b8", fontSize: 14, maxWidth: 680, lineHeight: 1.6 }}>
                          Real-time autonomous digital marketing engine. Seamlessly orchestrate autonomous WordPress SEO publishing, Google Ads search campaigns, and Meta social syndication.
                        </p>
                      </div>

                      {/* Action Launchers */}
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", width: "100%", maxWidth: "100%" }}>
                        <button
                          onClick={() => handleSelectTab("wordpress")}
                          className="btn-gabbar-primary"
                          style={{ padding: "11px 20px", fontSize: 13, flex: "1 1 auto" }}
                        >
                          🌐 WordPress & SEO ➔
                        </button>
                        <button
                          onClick={() => handleSelectTab("social")}
                          className="btn-gabbar-secondary"
                          style={{ padding: "11px 20px", fontSize: 13, flex: "1 1 auto" }}
                        >
                          📱 Social Autopilot ➔
                        </button>
                        <button
                          onClick={() => handleSelectTab("gmb")}
                          className="btn-gabbar-secondary"
                          style={{ padding: "11px 20px", fontSize: 13, flex: "1 1 auto" }}
                        >
                          📍 Local Maps & Reviews ➔
                        </button>
                        <button
                          onClick={() => handleSelectTab("ads")}
                          className="btn-gabbar-secondary"
                          style={{ padding: "11px 20px", fontSize: 13, flex: "1 1 auto" }}
                        >
                          🎯 Google & Meta Ads ➔
                        </button>
                      </div>
                    </div>

                    {/* Monthly Service Quotas Grid */}
                    {subData && (
                      <div
                        style={{
                          marginTop: 24,
                          padding: "20px",
                          borderRadius: 16,
                          background: isTrialOrNone ? "rgba(245, 158, 11, 0.04)" : "rgba(255, 255, 255, 0.03)",
                          border: isTrialOrNone ? "1px solid rgba(245, 158, 11, 0.25)" : "1px solid rgba(255, 255, 255, 0.08)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", color: isTrial99 || isTrialOrNone ? "#fbbf24" : "#60a5fa" }}>
                              {isTrial99
                                ? "🎁 Power Sampler (₹99) · Active Trial Allowances"
                                : isTrialOrNone
                                ? "Free Trial Allowances · No Active Plan"
                                : `Monthly Plan Allowances · ${subData.subscription?.planName}`}
                            </div>
                            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                              {isTrial99
                                ? "Includes 2 SEO blogs, 2 social posts (FB+IG), 2 GMB AI review replies, 2 AI images & 10 strategy queries."
                                : isTrialOrNone
                                ? "Includes 5 free AI queries & 1 AI image generation total. Upgrade to unlock autonomous publishing."
                                : `Active Cycle: ${new Date(subData.subscription?.cycleStart).toLocaleDateString()} — ${new Date(subData.subscription?.cycleEnd).toLocaleDateString()}`}
                            </div>
                          </div>
                          <button
                            onClick={() => setShowSubscriptionModal(true)}
                            style={{
                              padding: "6px 14px",
                              borderRadius: 8,
                              border: isTrialOrNone ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid rgba(59, 130, 246, 0.4)",
                              background: isTrialOrNone ? "rgba(245, 158, 11, 0.15)" : "rgba(59, 130, 246, 0.12)",
                              color: isTrialOrNone ? "#fbbf24" : "#93c5fd",
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            {isTrialOrNone ? "Subscribe to a Plan ↗" : "Upgrade / Change Plan"}
                          </button>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                            gap: 12,
                          }}
                        >
                          <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>📝 SEO Articles</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc" }}>
                              {subData.quotas?.seoArticles?.used} <span style={{ fontSize: 13, color: "#64748b" }}>/ {subData.quotas?.seoArticles?.limit}</span>
                            </div>
                          </div>

                          <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>📱 Social Posts</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc" }}>
                              {subData.quotas?.socialPosts?.used} <span style={{ fontSize: 13, color: "#64748b" }}>/ {subData.quotas?.socialPosts?.limit}</span>
                            </div>
                          </div>

                          <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>🎨 AI Images</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc" }}>
                              {subData.quotas?.images?.used} <span style={{ fontSize: 13, color: "#64748b" }}>/ {subData.quotas?.images?.limit}</span>
                            </div>
                          </div>

                          <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>🎯 Meta Ads</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: subData.quotas?.metaCampaigns?.included ? "#38bdf8" : "#64748b" }}>
                              {subData.quotas?.metaCampaigns?.included
                                ? `${subData.quotas?.metaCampaigns?.used} / ${subData.quotas?.metaCampaigns?.limit}`
                                : "Locked"}
                            </div>
                          </div>

                          <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>📈 Google Ads</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: subData.quotas?.googleCampaigns?.included ? "#facc15" : "#64748b" }}>
                              {subData.quotas?.googleCampaigns?.included
                                ? `${subData.quotas?.googleCampaigns?.used} / ${subData.quotas?.googleCampaigns?.limit}`
                                : "Locked"}
                            </div>
                          </div>

                          <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>💬 AI Queries</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc" }}>
                              {subData.quotas?.aiQueries?.used} <span style={{ fontSize: 13, color: "#64748b" }}>/ {subData.quotas?.aiQueries?.limit}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 4-Stage Autonomous Pipeline Visualizer */}
                  <div
                    style={{
                      background: "rgba(14, 19, 30, 0.75)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: 18,
                      padding: "clamp(20px, 3.5vw, 28px)",
                      marginBottom: 28,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#cbd5e1", letterSpacing: "1px", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
                        <span>⚡ Live Architecture & Autonomous Pipeline</span>
                      </div>
                      <div style={{ display: "flex", gap: "8px 14px", fontSize: 11, color: "#64748b", flexWrap: "wrap" }}>
                        <span>● Node Latency: <strong>48ms</strong></span>
                        <span>● Schedule: <strong>Autonomous Cadence</strong></span>
                        <span>● Index Pinging: <strong>GSC Instant</strong></span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
                        gap: 16,
                        width: "100%",
                      }}
                    >
                      <div style={{ background: "rgba(18, 24, 38, 0.7)", border: "1px solid rgba(56, 189, 248, 0.2)", borderRadius: 14, padding: "16px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                          <span style={{ fontSize: 20 }}>🌐</span>
                          <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" }}>
                            STAGE 01
                          </span>
                        </div>
                        <h4 style={{ margin: "0 0 6px 0", fontSize: 14, fontWeight: 700, color: "#ffffff" }}>WordPress Sync</h4>
                        <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                          Real-time crawl, anti-duplicate checks, and on-page keyword clustering.
                        </p>
                      </div>

                      <div style={{ background: "rgba(18, 24, 38, 0.7)", border: "1px solid rgba(129, 140, 248, 0.2)", borderRadius: 14, padding: "16px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                          <span style={{ fontSize: 20 }}>🧠</span>
                          <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: "rgba(129, 140, 248, 0.15)", color: "#818cf8" }}>
                            STAGE 02
                          </span>
                        </div>
                        <h4 style={{ margin: "0 0 6px 0", fontSize: 14, fontWeight: 700, color: "#ffffff" }}>GabbarInfo AI</h4>
                        <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                          Synthesizes 1500+ word articles, schema markup, and dual attention-seeking visuals.
                        </p>
                      </div>

                      <div style={{ background: "rgba(18, 24, 38, 0.7)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: 14, padding: "16px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                          <span style={{ fontSize: 20 }}>🚀</span>
                          <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}>
                            STAGE 03
                          </span>
                        </div>
                        <h4 style={{ margin: "0 0 6px 0", fontSize: 14, fontWeight: 700, color: "#ffffff" }}>Autonomous Publish</h4>
                        <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                          Posts directly into WP draft/publish with alt tags, slugs, and auto GSC index pings.
                        </p>
                      </div>

                      <div style={{ background: "rgba(18, 24, 38, 0.7)", border: "1px solid rgba(244, 114, 182, 0.2)", borderRadius: 14, padding: "16px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                          <span style={{ fontSize: 20 }}>📈</span>
                          <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: "rgba(244, 114, 182, 0.15)", color: "#f472b6" }}>
                            STAGE 04
                          </span>
                        </div>
                        <h4 style={{ margin: "0 0 6px 0", fontSize: 14, fontWeight: 700, color: "#ffffff" }}>Ads & Social Synergies</h4>
                        <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                          1-click cross-posts to Facebook & Instagram, and triggers Google Ads keyword sets.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: WORDPRESS & SEO ENGINE WORKSTATION */}
              {activeTab === "wordpress" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 480px), 1fr))", gap: 24 }}>
                  <section
                    style={{
                      padding: "clamp(18px, 3vw, 28px)",
                      borderRadius: 20,
                      background: "rgba(14, 19, 30, 0.85)",
                      border: "1px solid rgba(56, 189, 248, 0.2)",
                      boxShadow: "0 20px 50px rgba(0,0,0,0.5), 0 0 30px rgba(56, 189, 248, 0.05)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(56, 189, 248, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, border: "1px solid rgba(56, 189, 248, 0.3)" }}>
                          🌐
                        </div>
                        <div>
                          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#ffffff" }}>
                            WordPress Website & SEO Engine
                          </h2>
                          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#94a3b8" }}>
                            Pair your website via the GabbarInfo plugin for autonomous publishing.
                          </p>
                        </div>
                      </div>
                      <span style={{ fontSize: 10.5, padding: "4px 10px", borderRadius: 999, background: "rgba(56, 189, 248, 0.12)", border: "1px solid rgba(56, 189, 248, 0.3)", color: "#38bdf8", fontWeight: 800 }}>
                        CORE ENGINE
                      </span>
                    </div>
                    <WordPressSiteConnect onConnectionChange={(connected) => setHasWpConnected(connected)} />
                  </section>

                  {/* Right Column: High-Tech Live AI SEO Telemetry */}
                  <div
                    style={{
                      padding: "clamp(18px, 3vw, 28px)",
                      borderRadius: 20,
                      background: "linear-gradient(180deg, rgba(16, 24, 38, 0.8) 0%, rgba(10, 15, 26, 0.95) 100%)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#38bdf8", letterSpacing: "1px", textTransform: "uppercase" }}>
                          ⚡ Autonomous Telemetry & Specifications
                        </span>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#38bdf8", boxShadow: "0 0 10px #38bdf8", animation: "radarPulse 2s infinite" }} />
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
                        <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                            <span style={{ color: "#94a3b8" }}>Article Length Synthesizer</span>
                            <span style={{ color: "#34d399", fontWeight: 700 }}>1,500 – 2,200 Words</span>
                          </div>
                          <div style={{ height: 4, borderRadius: 2, background: "rgba(255, 255, 255, 0.06)", overflow: "hidden" }}>
                            <div style={{ width: "88%", height: "100%", background: "linear-gradient(90deg, #38bdf8, #34d399)" }} />
                          </div>
                        </div>

                        <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                            <span style={{ color: "#94a3b8" }}>Schema Generator</span>
                            <span style={{ color: "#60a5fa", fontWeight: 700 }}>Article + FAQPage JSON-LD</span>
                          </div>
                          <div style={{ height: 4, borderRadius: 2, background: "rgba(255, 255, 255, 0.06)", overflow: "hidden" }}>
                            <div style={{ width: "95%", height: "100%", background: "linear-gradient(90deg, #60a5fa, #818cf8)" }} />
                          </div>
                        </div>

                        <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                            <span style={{ color: "#94a3b8" }}>Google Search Console Pings</span>
                            <span style={{ color: "#facc15", fontWeight: 700 }}>Instant Webhook Active</span>
                          </div>
                          <div style={{ height: 4, borderRadius: 2, background: "rgba(255, 255, 255, 0.06)", overflow: "hidden" }}>
                            <div style={{ width: "100%", height: "100%", background: "#facc15" }} />
                          </div>
                        </div>
                      </div>

                      <div style={{ background: "rgba(56, 189, 248, 0.06)", border: "1px solid rgba(56, 189, 248, 0.2)", borderRadius: 14, padding: "14px", marginBottom: 20 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#38bdf8", marginBottom: 4 }}>
                          ⚡ Instant Social Syndication Link
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: "#cbd5e1", lineHeight: 1.5 }}>
                          Every published blog automatically generates an attention-grabbing social card and syndicates to your verified Facebook Page and Instagram Account.
                        </p>
                      </div>
                    </div>

                    <a
                      href="/seo"
                      onClick={(e) => {
                        if (!hasWpConnected) {
                          e.preventDefault();
                          setShowWpConnectPrompt(true);
                        }
                      }}
                      className="btn-gabbar-primary"
                      style={{
                        width: "100%",
                        padding: "12px",
                        fontSize: 13,
                        textDecoration: "none",
                        justifyContent: "center",
                      }}
                    >
                      🚀 Open Full SEO Suite ↗
                    </a>
                  </div>
                </div>
              )}

              {/* TAB 3: SOCIAL AUTOPILOT WORKSTATION */}
              {activeTab === "social" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 480px), 1fr))", gap: 24 }}>
                  <section
                    style={{
                      padding: "clamp(18px, 3vw, 28px)",
                      borderRadius: 20,
                      background: "rgba(14, 19, 30, 0.85)",
                      border: "1px solid rgba(24, 119, 242, 0.2)",
                      boxShadow: "0 20px 50px rgba(0,0,0,0.5), 0 0 30px rgba(24, 119, 242, 0.05)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(24, 119, 242, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, border: "1px solid rgba(24, 119, 242, 0.3)" }}>
                          📘
                        </div>
                        <div>
                          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#ffffff" }}>
                            Facebook Business & Instagram
                          </h2>
                          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#94a3b8" }}>
                            Connect your 1st Brand Pair for social broadcasts and automated scheduling.
                          </p>
                        </div>
                      </div>
                      <span style={{ fontSize: 10.5, padding: "4px 10px", borderRadius: 999, background: "rgba(24, 119, 242, 0.12)", border: "1px solid rgba(24, 119, 242, 0.3)", color: "#93c5fd", fontWeight: 800 }}>
                        SOCIAL SYNDICATE
                      </span>
                    </div>
                    <FacebookBusinessConnect onOpenSocialPlanner={() => setShowSocialPlanner(true)} />
                  </section>

                  {/* Right Column: Social Planner Launch & Telemetry */}
                  <div
                    style={{
                      padding: "clamp(18px, 3vw, 28px)",
                      borderRadius: 20,
                      background: "linear-gradient(180deg, rgba(16, 24, 38, 0.8) 0%, rgba(10, 15, 26, 0.95) 100%)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#a855f7", letterSpacing: "1px", textTransform: "uppercase" }}>
                          📱 Social Engine Dynamics
                        </span>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#a855f7", boxShadow: "0 0 10px #a855f7", animation: "radarPulse 2s infinite" }} />
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
                        <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                          <div style={{ color: "#cbd5e1", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                            🕒 Optimal Posting Cadence
                          </div>
                          <div style={{ color: "#94a3b8", fontSize: 12 }}>
                            AI monitors engagement peaks and deploys content during maximum audience activity (default: 18:30 IST).
                          </div>
                        </div>

                        <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                          <div style={{ color: "#cbd5e1", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                            🎨 Visual Studio & Captions
                          </div>
                          <div style={{ color: "#94a3b8", fontSize: 12 }}>
                            Generates matching square 1:1 visuals with viral hook captions and targeted hashtag clusters.
                          </div>
                        </div>

                        <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                          <div style={{ color: "#cbd5e1", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                            ⚡ Dual-Platform Cross-Post
                          </div>
                          <div style={{ color: "#94a3b8", fontSize: 12 }}>
                            Synchronized publishing across Facebook Page and Instagram Business account simultaneously.
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowSocialPlanner(true)}
                      className="btn-gabbar-primary"
                      style={{
                        width: "100%",
                        padding: "12px",
                        fontSize: 13,
                        justifyContent: "center",
                      }}
                    >
                      📅 Open Social Media Planner Modal ↗
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 4: LOCAL MAPS (GMB) WORKSTATION */}
              {activeTab === "gmb" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 480px), 1fr))", gap: 24 }}>
                  <section
                    style={{
                      padding: "clamp(18px, 3vw, 28px)",
                      borderRadius: 20,
                      background: "rgba(14, 19, 30, 0.85)",
                      border: "1px solid rgba(16, 185, 129, 0.2)",
                      boxShadow: "0 20px 50px rgba(0,0,0,0.5), 0 0 30px rgba(16, 185, 129, 0.05)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(16, 185, 129, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                          📍
                        </div>
                        <div>
                          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#ffffff" }}>
                            Google Business Profile (GMB)
                          </h2>
                          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#94a3b8" }}>
                            Local SEO dominance, maps ranking, and 5-min AI review responder.
                          </p>
                        </div>
                      </div>
                      <span style={{ fontSize: 10.5, padding: "4px 10px", borderRadius: 999, background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#34d399", fontWeight: 800 }}>
                        LOCAL MAPS
                      </span>
                    </div>
                    <GoogleBusinessConnect />
                  </section>

                  {/* Right Column: GMB AI Review Telemetry */}
                  <div
                    style={{
                      padding: "clamp(18px, 3vw, 28px)",
                      borderRadius: 20,
                      background: "linear-gradient(180deg, rgba(16, 24, 38, 0.8) 0%, rgba(10, 15, 26, 0.95) 100%)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#34d399", letterSpacing: "1px", textTransform: "uppercase" }}>
                          📍 Local SEO & Review Intelligence
                        </span>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 10px #34d399", animation: "radarPulse 2s infinite" }} />
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
                        <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                          <div style={{ color: "#cbd5e1", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                            🤖 5-Minute AI Review Responder
                          </div>
                          <div style={{ color: "#94a3b8", fontSize: 12 }}>
                            Instantly replies to incoming customer reviews with polite, keyword-optimized responses to boost local Google Maps ranking.
                          </div>
                        </div>

                        <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                          <div style={{ color: "#cbd5e1", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                            🗺️ Local 3-Pack Target Grid
                          </div>
                          <div style={{ color: "#94a3b8", fontSize: 12 }}>
                            Continuous synchronization of business hours, contact numbers, address coordinates, and geo-targeted keywords.
                          </div>
                        </div>

                        <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                          <div style={{ color: "#cbd5e1", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                            🔗 Google Ads Location Link
                          </div>
                          <div style={{ color: "#94a3b8", fontSize: 12 }}>
                            Enables Google Performance Max & Search ads to display physical store location extensions automatically.
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowSubscriptionModal(true)}
                      className="btn-gabbar-secondary"
                      style={{ width: "100%", padding: "12px", fontSize: 13, justifyContent: "center" }}
                    >
                      ⚡ Manage GMB Locations & Plans ↗
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 5: PERFORMANCE ADS WORKSTATION */}
              {activeTab === "ads" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 480px), 1fr))", gap: 24 }}>
                  <section
                    style={{
                      padding: "clamp(18px, 3vw, 28px)",
                      borderRadius: 20,
                      background: "rgba(14, 19, 30, 0.85)",
                      border: "1px solid rgba(66, 133, 244, 0.2)",
                      boxShadow: "0 20px 50px rgba(0,0,0,0.5), 0 0 30px rgba(66, 133, 244, 0.05)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(66, 133, 244, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, border: "1px solid rgba(66, 133, 244, 0.3)" }}>
                          🎯
                        </div>
                        <div>
                          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#ffffff" }}>
                            Google Ads Account
                          </h2>
                          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#94a3b8" }}>
                            Autonomous search campaign drafting, budget allocation, and keyword arbitrage.
                          </p>
                        </div>
                      </div>
                      <span style={{ fontSize: 10.5, padding: "4px 10px", borderRadius: 999, background: "rgba(66, 133, 244, 0.12)", border: "1px solid rgba(66, 133, 244, 0.3)", color: "#60a5fa", fontWeight: 800 }}>
                        PPC ENGINE
                      </span>
                    </div>
                    <GoogleAdsAccountConnect />
                  </section>

                  {/* Right Column: Ads Engine Telemetry */}
                  <div
                    style={{
                      padding: "clamp(18px, 3vw, 28px)",
                      borderRadius: 20,
                      background: "linear-gradient(180deg, rgba(16, 24, 38, 0.8) 0%, rgba(10, 15, 26, 0.95) 100%)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#facc15", letterSpacing: "1px", textTransform: "uppercase" }}>
                          🎯 PPC Arbitrage & Quality Engine
                        </span>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#facc15", boxShadow: "0 0 10px #facc15", animation: "radarPulse 2s infinite" }} />
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
                        <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                          <div style={{ color: "#cbd5e1", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                            🛡️ Negative Keyword Shield
                          </div>
                          <div style={{ color: "#94a3b8", fontSize: 12 }}>
                            Eliminates wasted ad spend by automatically adding irrelevant search queries to campaign negative lists.
                          </div>
                        </div>

                        <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                          <div style={{ color: "#cbd5e1", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                            💰 Smart Bidding Strategy
                          </div>
                          <div style={{ color: "#94a3b8", fontSize: 12 }}>
                            Pre-configured for Maximize Conversions and Target CPA to maximize ROI from your daily budget.
                          </div>
                        </div>

                        <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                          <div style={{ color: "#cbd5e1", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                            📱 Meta Ads Retargeting
                          </div>
                          <div style={{ color: "#94a3b8", fontSize: 12 }}>
                            Connects website pixel events with Facebook custom audiences to re-engage past visitors.
                          </div>
                        </div>
                      </div>
                    </div>

                    <a
                      href="/chat"
                      className="btn-gabbar-primary"
                      style={{ width: "100%", padding: "12px", fontSize: 13, textDecoration: "none", justifyContent: "center" }}
                    >
                      💬 Draft Ad Campaigns in Chat ↗
                    </a>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ══════════════════════════════════════════════════════════
                VIEW MODE: CLASSIC ALL-IN-ONE SINGLE-PAGE STACK
                (Exact prior layout preserved for 100% reversibility)
            ══════════════════════════════════════════════════════════ */
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {/* Hero & Overview */}
              <div
                style={{
                  background: "linear-gradient(180deg, rgba(16, 22, 34, 0.85) 0%, rgba(10, 14, 23, 0.95) 100%)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: 20,
                  padding: "clamp(20px, 4vw, 32px) clamp(16px, 4vw, 36px)",
                  boxShadow: "0 25px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(56, 189, 248, 0.08)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 20 }}>
                  <div>
                    <h1 style={{ margin: "0 0 10px 0", fontSize: "clamp(22px, 5vw, 30px)", fontWeight: 800, color: "#ffffff" }}>
                      Welcome to GabbarInfo AI Command Center 🚀
                    </h1>
                    <p style={{ margin: 0, color: "#94a3b8", fontSize: 14, maxWidth: 680, lineHeight: 1.6 }}>
                      Real-time autonomous digital marketing engine. Seamlessly orchestrate autonomous WordPress SEO publishing, Google Ads search campaigns, and Meta social syndication.
                    </p>
                  </div>
                </div>
              </div>

              {/* 1. WordPress Engine */}
              <section
                id="wordpress-engine"
                style={{
                  padding: "clamp(16px, 3.5vw, 26px)",
                  borderRadius: 18,
                  background: "rgba(14, 19, 30, 0.78)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                }}
              >
                <h2 style={{ margin: "0 0 14px 0", fontSize: 18, fontWeight: 700, color: "#ffffff" }}>
                  🌐 WordPress Website & SEO Engine
                </h2>
                <WordPressSiteConnect onConnectionChange={(connected) => setHasWpConnected(connected)} />
              </section>

              {/* 2. Google Ads */}
              <section
                style={{
                  padding: "clamp(16px, 3.5vw, 26px)",
                  borderRadius: 18,
                  background: "rgba(14, 19, 30, 0.78)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                }}
              >
                <h2 style={{ margin: "0 0 14px 0", fontSize: 18, fontWeight: 700, color: "#ffffff" }}>
                  🎯 Google Ads Account
                </h2>
                <GoogleAdsAccountConnect />
              </section>

              {/* 3. Google Business Profile */}
              <section
                style={{
                  padding: "clamp(16px, 3.5vw, 26px)",
                  borderRadius: 18,
                  background: "rgba(14, 19, 30, 0.78)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                }}
              >
                <h2 style={{ margin: "0 0 14px 0", fontSize: 18, fontWeight: 700, color: "#ffffff" }}>
                  📍 Google Business Profile (GMB)
                </h2>
                <GoogleBusinessConnect />
              </section>

              {/* 4. Facebook Business */}
              <section
                style={{
                  padding: "clamp(16px, 3.5vw, 26px)",
                  borderRadius: 18,
                  background: "rgba(14, 19, 30, 0.78)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                }}
              >
                <h2 style={{ margin: "0 0 14px 0", fontSize: 18, fontWeight: 700, color: "#ffffff" }}>
                  📘 Facebook Business & Instagram
                </h2>
                <FacebookBusinessConnect onOpenSocialPlanner={() => setShowSocialPlanner(true)} />
              </section>
            </div>
          )}
        </main>

        {/* FOOTER */}
        <footer
          style={{
            marginTop: 40,
            padding: "20px clamp(16px, 3.5vw, 28px)",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            fontSize: 12,
            color: "#64748b",
          }}
        >
          <div>
            © {new Date().getFullYear()} GabbarInfo AI. All rights reserved.
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <a
              href="https://www.gabbarinfo.com/privacy-policy/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#94a3b8", textDecoration: "underline" }}
            >
              Privacy Policy
            </a>
          </div>
        </footer>
      </div>

      {/* Subscription Plans Modal */}
      <SubscriptionModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        currentPlanId={subData?.subscription?.planId || "try"}
        subscriptionStatus={subData?.subscription}
        onSubscriptionUpdated={() => {
          fetch("/api/subscriptions/status")
            .then((r) => r.json())
            .then((d) => d.ok && setSubData(d));
        }}
      />

      {/* Autonomous Social Media Planner Modal */}
      {showSocialPlanner && (
        <SocialMediaPlannerModal onClose={() => setShowSocialPlanner(false)} />
      )}

      {/* SEO Suite Onboarding Guidance Modal */}
      {showWpConnectPrompt && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "rgba(4, 7, 13, 0.85)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowWpConnectPrompt(false);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              background: "linear-gradient(165deg, #101625 0%, #0a0e18 100%)",
              border: "1px solid rgba(56, 189, 248, 0.28)",
              borderRadius: 24,
              boxShadow: "0 30px 80px rgba(0, 0, 0, 0.9), 0 0 50px rgba(56, 189, 248, 0.15)",
              padding: "32px 30px",
              position: "relative",
              color: "#f8fafc",
            }}
          >
            <button
              onClick={() => setShowWpConnectPrompt(false)}
              style={{
                position: "absolute",
                top: 18,
                right: 18,
                width: 32,
                height: 32,
                borderRadius: 8,
                border: "1px solid rgba(255, 255, 255, 0.1)",
                background: "rgba(255, 255, 255, 0.05)",
                color: "#94a3b8",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
              }}
            >
              ✕
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(56, 189, 248, 0.15)", border: "1px solid rgba(56, 189, 248, 0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
                🌐
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#fff" }}>
                  Connect Your WordPress Site First
                </h3>
                <div style={{ fontSize: 12, color: "#38bdf8", fontWeight: 600, marginTop: 2 }}>
                  Required for Autonomous SEO & Blog Publishing
                </div>
              </div>
            </div>

            <p style={{ fontSize: 13.5, color: "#cbd5e1", lineHeight: 1.6, margin: "0 0 20px 0" }}>
              To access the autonomous SEO Suite, keyword generator, and blog publisher, please connect your WordPress website using the official <strong>GabbarInfo Connect</strong> plugin.
            </p>

            <button
              onClick={() => {
                setShowWpConnectPrompt(false);
                handleSelectTab("wordpress");
              }}
              className="btn-gabbar-primary"
              style={{
                width: "100%",
                padding: "13px 20px",
                fontSize: 14,
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <span>👇</span> Go to WordPress Connection
            </button>

            <div style={{ textAlign: "center", marginTop: 4 }}>
              <a
                href="/seo"
                onClick={() => setShowWpConnectPrompt(false)}
                style={{ fontSize: 12, color: "#64748b", textDecoration: "underline", cursor: "pointer" }}
              >
                I'll connect later, open SEO Suite anyway ↗
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── RESPONSIVE CSS OVERRIDES FOR MOBILE & DESKTOP ── */}
      <style jsx>{`
        @media (max-width: 768px) {
          .sidebar-container {
            transform: translateX(-100%);
          }
          .sidebar-container.mobile-drawer-open {
            transform: translateX(0) !important;
          }
          .main-workstation-content {
            padding-left: 0 !important;
          }
          .mobile-hamburger-btn {
            display: flex !important;
          }
          .mobile-tabs-strip {
            display: flex !important;
          }
          .hide-on-mobile {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

/* -------------------------
   EMAIL FALLBACK FORM (DARK THEMED)
------------------------- */
function EmailFallbackForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/user/set-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage("Email saved! Refreshing session in one go...");
        setTimeout(() => {
          signIn("facebook", { callbackUrl: window.location.origin });
        }, 1200);
      } else {
        setMessage("Error: " + (data.error || "Failed to save email"));
      }
    } catch (err) {
      setMessage("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: 24,
        borderRadius: 16,
        background: "rgba(15, 23, 42, 0.8)",
        border: "1px solid #1e293b",
        marginBottom: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <span style={{ fontSize: 20 }}>📧</span>
        <h2 style={{ margin: 0, fontSize: 17, color: "#fff" }}>Link Your Email (Optional)</h2>
      </div>

      <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.5, marginBottom: 16 }}>
        You are currently logged in via Facebook. If you would like to link a personal email for account notifications, you can enter it below.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          type="email"
          placeholder="Enter your email address"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            flex: 1,
            minWidth: 260,
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #1e293b",
            background: "#131b2e",
            color: "#fff",
            fontSize: 14,
          }}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 20px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {loading ? "Saving…" : "Save Email"}
        </button>
      </form>

      {message && (
        <p style={{ marginTop: 12, fontSize: 13, color: message.startsWith("Error") ? "#f87171" : "#34d399", fontWeight: 500 }}>
          {message}
        </p>
      )}
    </div>
  );
}
