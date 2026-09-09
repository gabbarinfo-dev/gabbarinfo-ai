"use client";

import { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Head from "next/head";
import FacebookBusinessConnect from "./components/facebook/FacebookBusinessConnect";
import GoogleAdsAccountConnect from "./components/google/googleadsaccountconnect";
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

          {/* Live Radar Pulse Badge */}
          <div style={{ display: "inline-block", marginBottom: 12 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 14px",
                borderRadius: 999,
                background: "rgba(16, 185, 129, 0.12)",
                border: "1px solid rgba(16, 185, 129, 0.35)",
                color: "#34d399",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "1.2px",
                textTransform: "uppercase",
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 10px #10b981", animation: "radarPulse 2s infinite" }} />
              AUTONOMOUS AI COMMAND CENTER
            </span>
          </div>

          <h1
            style={{
              margin: "0 0 10px 0",
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: "-0.5px",
              background: "linear-gradient(135deg, #ffffff 40%, #38bdf8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            GabbarInfo AI
          </h1>

          <p style={{ margin: "0 0 28px 0", fontSize: 14, color: "#94a3b8", lineHeight: 1.6 }}>
            Self-driving digital marketing strategist. Google Ads, Meta Ads, and WordPress SEO on autopilot.
          </p>

          {/* Capabilities Badges */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32, textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#e2e8f0", background: "rgba(255, 255, 255, 0.04)", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
              <span style={{ color: "#38bdf8", fontSize: 15, fontWeight: "bold" }}>✓</span> Autonomous Google Ads Search Campaigns
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#e2e8f0", background: "rgba(255, 255, 255, 0.04)", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
              <span style={{ color: "#38bdf8", fontSize: 15, fontWeight: "bold" }}>✓</span> Meta Ads & 1-Click Instagram/Facebook Publishing
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#e2e8f0", background: "rgba(255, 255, 255, 0.04)", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
              <span style={{ color: "#38bdf8", fontSize: 15, fontWeight: "bold" }}>✓</span> WordPress SEO & Daily Autonomous Content Engine
            </div>
          </div>

          {/* SIGNATURE SLIDING BUTTONS */}
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
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
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

          <div style={{ marginTop: 26, fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <span>🔒</span> Enterprise 256-Bit Encrypted OAuth Security
          </div>
        </div>
      </div>
    );
  }

  /* -------------------------
     LOGGED IN VIEW (LUXURY DARK DASHBOARD)
  ------------------------- */
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#080b11",
        color: "#f8fafc",
        fontFamily: "Plus Jakarta Sans, sans-serif",
        overflowX: "hidden",
        width: "100%",
        maxWidth: "100vw",
        position: "relative",
      }}
    >
      <Head>
        <title>Dashboard | GabbarInfo AI</title>
      </Head>

      {/* TOP HEADER */}
      <header
        style={{
          borderBottom: "1px solid #1e293b",
          padding: "clamp(12px, 3vw, 16px) clamp(14px, 3vw, 28px)",
          background: "rgba(11, 15, 25, 0.9)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "sticky",
          top: 0,
          zIndex: 100,
          flexWrap: "wrap",
          gap: 12,
          width: "100%",
          maxWidth: "100vw",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>🚀</span>
            <span
              style={{
                fontWeight: 800,
                fontSize: 18,
                letterSpacing: "-0.5px",
                background: "linear-gradient(135deg, #ffffff 30%, #94a3b8 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              GabbarInfo AI
            </span>
          </div>
          <span style={{ color: "#334155" }}>|</span>
          <span style={{ fontSize: 13, color: "#94a3b8" }}>
            {session.user.email || "User"}
          </span>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {role === "owner" ? (
            <span
              style={{
                fontSize: 11,
                padding: "5px 12px",
                borderRadius: 999,
                border: "1px solid rgba(245, 158, 11, 0.3)",
                background: "rgba(245, 158, 11, 0.1)",
                color: "#fbbf24",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              👑 Owner · Unlimited Plan
            </span>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {(() => {
                const planId = (subData?.subscription?.planId || "none").toLowerCase();
                const isTrialOrNone = planId === "none" || planId === "try";
                return (
                  <>
                    <span
                      style={{
                        fontSize: 12,
                        padding: "5px 12px",
                        borderRadius: 999,
                        border: isTrialOrNone
                          ? "1px solid rgba(245, 158, 11, 0.4)"
                          : "1px solid rgba(59, 130, 246, 0.3)",
                        background: isTrialOrNone
                          ? "rgba(245, 158, 11, 0.12)"
                          : "rgba(59, 130, 246, 0.1)",
                        color: isTrialOrNone ? "#fbbf24" : "#60a5fa",
                        fontWeight: 700,
                        letterSpacing: "0.5px",
                      }}
                    >
                      {loadingSub
                        ? "Plan: …"
                        : isTrialOrNone
                        ? "⚡ Active Plan: None (Free Trial)"
                        : `⚡ Plan: ${subData?.subscription?.planName}`}
                    </span>
                    <button
                      onClick={() => setShowSubscriptionModal(true)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 8,
                        border: "none",
                        background: isTrialOrNone
                          ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                          : "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        boxShadow: isTrialOrNone
                          ? "0 0 15px rgba(245, 158, 11, 0.3)"
                          : "0 0 15px rgba(37, 99, 235, 0.3)",
                      }}
                    >
                      {isTrialOrNone ? "Subscribe to a Plan ↗" : "Manage Plan"}
                    </button>
                  </>
                );
              })()}
            </div>
          )}

          <a
            href="/chat"
            className="btn-gabbar-secondary"
            style={{
              padding: "8px 16px",
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            💬 Chat Agent
          </a>

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
              padding: "8px 18px",
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            🌐 SEO Suite ↗
          </a>

          <button
            onClick={() => setShowSocialPlanner(true)}
            className="btn-gabbar-secondary"
            style={{
              padding: "8px 16px",
              fontSize: 13,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            📱 Social Planner
          </button>

          {role === "owner" && (
            <a
              href="/admin"
              className="btn-gabbar-secondary"
              style={{
                padding: "8px 14px",
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              ⚙️ Admin
            </a>
          )}

          <button
            onClick={() => signOut()}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid rgba(255, 255, 255, 0.14)",
              background: "rgba(16, 22, 34, 0.6)",
              color: "#94a3b8",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* AMBIENT TOP LIGHT CONE & SUBTLE CYBER GRID (WHIZWISER / LINEAR AESTHETICS) */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: "100vw",
          height: 520,
          background: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(56, 189, 248, 0.15) 0%, rgba(99, 102, 241, 0.08) 45%, transparent 80%)",
          pointerEvents: "none",
          zIndex: 0,
          overflow: "hidden",
        }}
      />

      {/* MAIN CONTAINER */}
      <main
        style={{
          maxWidth: 1100,
          width: "100%",
          margin: "0 auto",
          padding: "clamp(20px, 4vw, 40px) clamp(14px, 3vw, 24px)",
          position: "relative",
          zIndex: 1,
          boxSizing: "border-box",
        }}
      >
        {/* Email fallback notification if needed */}
        {session?.user?.email?.includes("@facebook.gabbarinfo.ai") && (
          <EmailFallbackForm />
        )}

        {/* ── AUTONOMOUS COMMAND HERO & PIPELINE VISUALIZER ── */}
        <div
          style={{
            background: "linear-gradient(180deg, rgba(16, 22, 34, 0.85) 0%, rgba(10, 14, 23, 0.95) 100%)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: 20,
            padding: "clamp(20px, 4vw, 32px) clamp(16px, 4vw, 36px)",
            marginBottom: 36,
            boxShadow: "0 25px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(56, 189, 248, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
            position: "relative",
            overflow: "hidden",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {/* Subtle Cyber Accent Line */}
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
              {/* Live Radar Pulse Badge */}
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

            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 4, width: "100%", maxWidth: "100%" }}>
              <a
                href="/chat"
                className="btn-gabbar-secondary"
                style={{
                  padding: "12px 22px",
                  fontSize: 14,
                  textDecoration: "none",
                  flex: "1 1 auto",
                  textAlign: "center",
                }}
              >
                💬 Launch Chat Agent
              </a>
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
                  padding: "12px 24px",
                  fontSize: 14,
                  textDecoration: "none",
                  flex: "1 1 auto",
                  textAlign: "center",
                }}
              >
                🌐 Open SEO Suite ↗
              </a>
              <button
                onClick={() => setShowSocialPlanner(true)}
                className="btn-gabbar-secondary"
                style={{
                  padding: "12px 22px",
                  fontSize: 14,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  flex: "1 1 auto",
                  textAlign: "center",
                }}
              >
                📱 Social Media Planner ↗
              </button>
            </div>
          </div>

          {/* ── MONTHLY SERVICE QUOTAS & PLAN OVERVIEW ── */}
          {subData && (() => {
            const planId = (subData?.subscription?.planId || "none").toLowerCase();
            const isTrialOrNone = planId === "none" || planId === "try";

            return (
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
                    <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", color: isTrialOrNone ? "#fbbf24" : "#60a5fa" }}>
                      {isTrialOrNone ? "Free Trial Allowances · No Active Plan" : `Monthly Plan Allowances · ${subData.subscription?.planName}`}
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                      {isTrialOrNone
                        ? "Includes 1 test blog, 1 test social post, 1 AI image & 1 AI query · No free Ads campaigns."
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
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 12,
                }}
              >
                {/* SEO Articles */}
                <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>📝 SEO Articles</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc" }}>
                    {subData.quotas?.seoArticles?.used} <span style={{ fontSize: 13, color: "#64748b" }}>/ {subData.quotas?.seoArticles?.limit}</span>
                  </div>
                </div>

                {/* Social Posts */}
                <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>📱 Social Posts</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc" }}>
                    {subData.quotas?.socialPosts?.used} <span style={{ fontSize: 13, color: "#64748b" }}>/ {subData.quotas?.socialPosts?.limit}</span>
                  </div>
                </div>

                {/* AI Images */}
                <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>🎨 AI Images</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc" }}>
                    {subData.quotas?.images?.used} <span style={{ fontSize: 13, color: "#64748b" }}>/ {subData.quotas?.images?.limit}</span>
                  </div>
                </div>

                {/* Meta Ads */}
                <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>🎯 Meta Ads</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: subData.quotas?.metaCampaigns?.included ? "#38bdf8" : "#64748b" }}>
                    {subData.quotas?.metaCampaigns?.included
                      ? `${subData.quotas?.metaCampaigns?.used} / ${subData.quotas?.metaCampaigns?.limit}`
                      : "Locked"}
                  </div>
                </div>

                {/* Google Ads */}
                <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>📈 Google Ads</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: subData.quotas?.googleCampaigns?.included ? "#facc15" : "#64748b" }}>
                    {subData.quotas?.googleCampaigns?.included
                      ? `${subData.quotas?.googleCampaigns?.used} / ${subData.quotas?.googleCampaigns?.limit}`
                      : "Locked"}
                  </div>
                </div>

                {/* AI Queries */}
                <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>💬 AI Queries</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc" }}>
                    {subData.quotas?.aiQueries?.used} <span style={{ fontSize: 13, color: "#64748b" }}>/ {subData.quotas?.aiQueries?.limit}</span>
                  </div>
                </div>
              </div>
            </div>
            );
          })()}

          {/* ── INTERACTIVE 4-STAGE PIPELINE VISUALIZER (WHIZWISER #HOW-IT-WORKS STYLE) ── */}
          <div style={{ marginTop: 32, paddingTop: 26, borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#cbd5e1", letterSpacing: "1px", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
                <span>⚡ Live Architecture & Execution Pipeline</span>
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
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
                gap: 16,
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              {/* Step 1 */}
              <div
                style={{
                  background: "rgba(18, 24, 38, 0.7)",
                  border: "1px solid rgba(56, 189, 248, 0.2)",
                  borderRadius: 14,
                  padding: "16px 18px",
                  transition: "all 0.3s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 20 }}>🌐</span>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" }}>
                    STAGE 01
                  </span>
                </div>
                <h4 style={{ margin: "0 0 6px 0", fontSize: 14, fontWeight: 700, color: "#ffffff" }}>
                  WordPress Sync
                </h4>
                <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                  Real-time page crawl, anti-duplicate checks, and on-page keyword clustering.
                </p>
              </div>

              {/* Step 2 */}
              <div
                style={{
                  background: "rgba(18, 24, 38, 0.7)",
                  border: "1px solid rgba(129, 140, 248, 0.2)",
                  borderRadius: 14,
                  padding: "16px 18px",
                  transition: "all 0.3s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 20 }}>🧠</span>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: "rgba(129, 140, 248, 0.15)", color: "#818cf8" }}>
                    STAGE 02
                  </span>
                </div>
                <h4 style={{ margin: "0 0 6px 0", fontSize: 14, fontWeight: 700, color: "#ffffff" }}>
                  GabbarInfo AI
                </h4>
                <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                  Synthesizes 1500+ word articles, schema markup, and dual attention-seeking visuals.
                </p>
              </div>

              {/* Step 3 */}
              <div
                style={{
                  background: "rgba(18, 24, 38, 0.7)",
                  border: "1px solid rgba(16, 185, 129, 0.2)",
                  borderRadius: 14,
                  padding: "16px 18px",
                  transition: "all 0.3s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 20 }}>🚀</span>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}>
                    STAGE 03
                  </span>
                </div>
                <h4 style={{ margin: "0 0 6px 0", fontSize: 14, fontWeight: 700, color: "#ffffff" }}>
                  Autonomous Publish
                </h4>
                <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                  Posts directly into WP draft/publish with alt tags, slugs, and auto GSC index pings.
                </p>
              </div>

              {/* Step 4 */}
              <div
                style={{
                  background: "rgba(18, 24, 38, 0.7)",
                  border: "1px solid rgba(244, 114, 182, 0.2)",
                  borderRadius: 14,
                  padding: "16px 18px",
                  transition: "all 0.3s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 20 }}>📈</span>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: "rgba(244, 114, 182, 0.15)", color: "#f472b6" }}>
                    STAGE 04
                  </span>
                </div>
                <h4 style={{ margin: "0 0 6px 0", fontSize: 14, fontWeight: 700, color: "#ffffff" }}>
                  Ads & Social Synergies
                </h4>
                <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                  1-click cross-posts to Facebook & Instagram, and triggers Google Ads keyword sets.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── 3 CORE ENGINE PANELS (FROSTED OBSIDIAN SURFACES) ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* 1. WORDPRESS WEBSITE & SEO ENGINE */}
          <section
            id="wordpress-engine"
            style={{
              padding: "clamp(16px, 3.5vw, 26px) clamp(14px, 3.5vw, 28px)",
              borderRadius: 18,
              background: "rgba(14, 19, 30, 0.78)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.5), 0 0 30px rgba(56, 189, 248, 0.05)",
              transition: "all 0.5s ease",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(56, 189, 248, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, border: "1px solid rgba(56, 189, 248, 0.3)", flexShrink: 0 }}>
                  🌐
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#ffffff" }}>
                    WordPress Website & SEO Engine
                  </h2>
                  <p style={{ margin: "2px 0 0", fontSize: 13, color: "#94a3b8" }}>
                    Autonomous daily content synthesis, dual visual creation, and keyword optimization.
                  </p>
                </div>
              </div>
              <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 999, background: "rgba(56, 189, 248, 0.1)", border: "1px solid rgba(56, 189, 248, 0.3)", color: "#38bdf8", fontWeight: 700 }}>
                CORE ENGINE
              </span>
            </div>
            <WordPressSiteConnect onConnectionChange={(connected) => setHasWpConnected(connected)} />
          </section>

          {/* 2. GOOGLE ADS ACCOUNT */}
          <section
            style={{
              padding: "clamp(16px, 3.5vw, 26px) clamp(14px, 3.5vw, 28px)",
              borderRadius: 18,
              background: "rgba(14, 19, 30, 0.78)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.5), 0 0 30px rgba(59, 130, 246, 0.05)",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(66, 133, 244, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, border: "1px solid rgba(66, 133, 244, 0.3)", flexShrink: 0 }}>
                  🎯
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#ffffff" }}>
                    Google Ads Account
                  </h2>
                  <p style={{ margin: "2px 0 0", fontSize: 13, color: "#94a3b8" }}>
                    Autonomous search campaign drafting, budget allocation, and keyword arbitrage.
                  </p>
                </div>
              </div>
              <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 999, background: "rgba(66, 133, 244, 0.1)", border: "1px solid rgba(66, 133, 244, 0.3)", color: "#60a5fa", fontWeight: 700 }}>
                PPC AUTOMATION
              </span>
            </div>
            <GoogleAdsAccountConnect />
          </section>

          {/* 3. FACEBOOK BUSINESS */}
          <section
            style={{
              padding: "clamp(16px, 3.5vw, 26px) clamp(14px, 3.5vw, 28px)",
              borderRadius: 18,
              background: "rgba(14, 19, 30, 0.78)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.5), 0 0 30px rgba(129, 140, 248, 0.05)",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(24, 119, 242, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, border: "1px solid rgba(24, 119, 242, 0.3)", flexShrink: 0 }}>
                  📘
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#ffffff" }}>
                    Facebook Business & Instagram
                  </h2>
                  <p style={{ margin: "2px 0 0", fontSize: 13, color: "#94a3b8" }}>
                    Social broadcasting, auto-caption generation, and audience retargeting.
                  </p>
                </div>
              </div>
              <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 999, background: "rgba(24, 119, 242, 0.1)", border: "1px solid rgba(24, 119, 242, 0.3)", color: "#93c5fd", fontWeight: 700 }}>
                SOCIAL SYNDICATE
              </span>
            </div>
            <FacebookBusinessConnect onOpenSocialPlanner={() => setShowSocialPlanner(true)} />
          </section>
        </div>
      </main>

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

      {/* ── SEO SUITE ONBOARDING GUIDANCE MODAL ── */}
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
            {/* Close Button */}
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

            {/* Header Emblem */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: "rgba(56, 189, 248, 0.15)",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                }}
              >
                🌐
              </div>
              <div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: "rgba(56, 189, 248, 0.15)",
                    color: "#38bdf8",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                  }}
                >
                  Step 1 Required for SEO Suite
                </span>
                <h3 style={{ margin: "4px 0 0 0", fontSize: 19, fontWeight: 800, color: "#ffffff" }}>
                  Connect Your Website First
                </h3>
              </div>
            </div>

            {/* Guidance Content */}
            <p style={{ margin: "0 0 18px 0", fontSize: 13.5, color: "#94a3b8", lineHeight: 1.6 }}>
              The <strong>SEO Suite</strong> automatically synthesizes 1,500+ word rank-ready articles, tracks high-intent keywords, and schedules publishing directly into your site. To unlock these features, please link your WordPress website first.
            </p>

            {/* Quick 3-Step Setup Card */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: 14,
                padding: "16px 18px",
                marginBottom: 22,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: "#38bdf8", textTransform: "uppercase", marginBottom: 10 }}>
                Quick 30-Second Setup:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "#cbd5e1" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#38bdf8", color: "#041525", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>1</span>
                  <span>Scroll down to the <strong>WordPress Website &amp; SEO Engine</strong> card.</span>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#38bdf8", color: "#041525", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>2</span>
                  <span>Type in your <strong>business or website name</strong> into the field.</span>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#38bdf8", color: "#041525", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>3</span>
                  <span>Click <strong>Connect WordPress Website</strong> to link your domain.</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={() => {
                  setShowWpConnectPrompt(false);
                  const el = document.getElementById("wordpress-engine");
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                    el.style.boxShadow = "0 0 50px rgba(56, 189, 248, 0.6), 0 0 100px rgba(56, 189, 248, 0.3)";
                    el.style.borderColor = "#38bdf8";
                    setTimeout(() => {
                      el.style.boxShadow = "";
                      el.style.borderColor = "";
                    }, 3500);
                  }
                }}
                style={{
                  width: "100%",
                  padding: "13px 20px",
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none",
                  background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                  color: "#ffffff",
                  boxShadow: "0 4px 20px rgba(2, 132, 199, 0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "all 0.2s ease",
                }}
              >
                <span>👇</span> Take Me to Connect Website
              </button>

              <div style={{ textAlign: "center", marginTop: 4 }}>
                <a
                  href="/seo"
                  onClick={() => setShowWpConnectPrompt(false)}
                  style={{
                    fontSize: 12,
                    color: "#64748b",
                    textDecoration: "underline",
                    cursor: "pointer",
                  }}
                >
                  I'll connect later, open SEO Suite anyway ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
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
