"use client";

import { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Head from "next/head";
import FacebookBusinessConnect from "./components/facebook/FacebookBusinessConnect";
import GoogleAdsAccountConnect from "./components/google/googleadsaccountconnect";
import WordPressSiteConnect from "./components/wordpress/WordPressSiteConnect";
import BuyCreditsModal from "./components/BuyCreditsModal";

export default function HomePage() {
  const { data: session, status } = useSession();

  const [credits, setCredits] = useState(null);
  const [unlimited, setUnlimited] = useState(false);
  const [loadingCredits, setLoadingCredits] = useState(true);

  const role = session?.user?.role || "client";
  const [showBuyCredits, setShowBuyCredits] = useState(false);

  /* -------------------------
     LOAD CREDITS
  ------------------------- */
  useEffect(() => {
    if (!session) return;

    async function fetchCredits() {
      try {
        const res = await fetch("/api/credits/get");
        if (!res.ok) return;

        const data = await res.json();
        setCredits(typeof data.credits === "number" ? data.credits : null);
        setUnlimited(Boolean(data.unlimited));
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingCredits(false);
      }
    }

    fetchCredits();
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
     NOT LOGGED IN (LUXURY DARK SPLIT SCREEN)
  ------------------------- */
  if (!session) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "radial-gradient(circle at 50% 0%, #151d30 0%, #080b11 75%)",
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

        {/* Ambient luxury golden & emerald glows */}
        <div
          style={{
            position: "absolute",
            top: "-15%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 720,
            height: 500,
            background: "radial-gradient(circle, rgba(245,183,22,0.18) 0%, rgba(16,185,129,0.08) 50%, transparent 75%)",
            filter: "blur(90px)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-10%",
            right: "10%",
            width: 500,
            height: 500,
            background: "radial-gradient(circle, rgba(245,183,22,0.12) 0%, transparent 70%)",
            filter: "blur(100px)",
            pointerEvents: "none",
          }}
        />

        {/* Subtle Luxury Neural Matrix Grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(rgba(245, 183, 22, 0.08) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            pointerEvents: "none",
            maskImage: "radial-gradient(ellipse 60% 60% at 50% 50%, #000 30%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(ellipse 60% 60% at 50% 50%, #000 30%, transparent 100%)",
          }}
        />

        {/* Luxury AI Glass Card */}
        <div
          style={{
            maxWidth: 480,
            width: "100%",
            background: "linear-gradient(180deg, rgba(17, 24, 39, 0.85) 0%, rgba(8, 11, 17, 0.95) 100%)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1.5px solid rgba(245, 183, 22, 0.35)",
            borderRadius: 24,
            padding: "44px 36px",
            boxShadow: "0 30px 70px -15px rgba(0, 0, 0, 0.85), 0 0 50px rgba(245, 183, 22, 0.18)",
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
              width: 72,
              height: 72,
              borderRadius: 22,
              background: "linear-gradient(135deg, rgba(245, 183, 22, 0.25) 0%, rgba(8, 11, 17, 0.9) 100%)",
              border: "1.5px solid rgba(245, 183, 22, 0.5)",
              marginBottom: 20,
              boxShadow: "0 0 28px rgba(245, 183, 22, 0.35)",
            }}
          >
            <span style={{ fontSize: 36 }}>🚀</span>
          </div>

          {/* Premium Tagline */}
          <div style={{ display: "inline-block", marginBottom: 12 }}>
            <span
              style={{
                display: "inline-block",
                padding: "4px 14px",
                borderRadius: 999,
                background: "rgba(245, 183, 22, 0.12)",
                border: "1px solid rgba(245, 183, 22, 0.4)",
                color: "#F5B716",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "1.5px",
                textTransform: "uppercase",
              }}
            >
              Enterprise AI Command Center
            </span>
          </div>

          <h1
            style={{
              margin: "0 0 10px 0",
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: "-0.5px",
              background: "linear-gradient(135deg, #ffffff 40%, #F5B716 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            GabbarInfo AI
          </h1>

          <p style={{ margin: "0 0 28px 0", fontSize: 14, color: "#94a3b8", lineHeight: 1.6 }}>
            Autonomous Digital Marketing Strategist. Google Ads, Meta Ads, Social Publishing, and WordPress SEO on Autopilot.
          </p>

          {/* Capabilities Badges */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32, textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#e2e8f0", background: "rgba(245, 183, 22, 0.04)", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(245, 183, 22, 0.15)" }}>
              <span style={{ color: "#F5B716", fontSize: 15, fontWeight: "bold" }}>✓</span> Autonomous Google Ads Search Campaigns
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#e2e8f0", background: "rgba(245, 183, 22, 0.04)", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(245, 183, 22, 0.15)" }}>
              <span style={{ color: "#F5B716", fontSize: 15, fontWeight: "bold" }}>✓</span> Meta Ads & 1-Click Instagram/Facebook Publishing
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#e2e8f0", background: "rgba(245, 183, 22, 0.04)", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(245, 183, 22, 0.15)" }}>
              <span style={{ color: "#F5B716", fontSize: 15, fontWeight: "bold" }}>✓</span> WordPress SEO & Daily Autonomous Content Engine
            </div>
          </div>

          {/* SIGNATURE GABBARINFO YELLOW SLIDING BUTTONS */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <button
              onClick={() => signIn("google")}
              className="btn-gabbar-gold"
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
              className="btn-gabbar-dark"
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
      }}
    >
      <Head>
        <title>Dashboard | GabbarInfo AI</title>
      </Head>

      {/* TOP HEADER */}
      <header
        style={{
          borderBottom: "1px solid #1e293b",
          padding: "16px 28px",
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
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
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
              👑 Owner · Unlimited
            </span>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: 12,
                  padding: "5px 12px",
                  borderRadius: 999,
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                  background: "rgba(59, 130, 246, 0.1)",
                  color: "#60a5fa",
                  fontWeight: 600,
                }}
              >
                {loadingCredits ? "Credits: …" : `⚡ Credits: ${credits ?? 0}`}
              </span>
              <button
                onClick={() => setShowBuyCredits(true)}
                style={{
                  padding: "5px 10px",
                  borderRadius: 6,
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                + Add
              </button>
            </div>
          )}

          <a
            href="/chat"
            className="btn-gabbar-dark"
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
            className="btn-gabbar-gold"
            style={{
              padding: "8px 18px",
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            🌐 SEO Suite ↗
          </a>

          {role === "owner" && (
            <a
              href="/admin"
              className="btn-gabbar-dark"
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
              border: "1px solid rgba(245, 183, 22, 0.25)",
              background: "rgba(19, 27, 46, 0.6)",
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

      {/* MAIN CONTAINER */}
      <main style={{ maxWidth: 1040, margin: "0 auto", padding: "36px 20px" }}>
        {/* Email fallback notification if needed */}
        {session?.user?.email?.includes("@facebook.gabbarinfo.ai") && (
          <EmailFallbackForm />
        )}

        {/* WELCOME HERO BANNER */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 16,
            padding: "28px 32px",
            marginBottom: 32,
            boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 style={{ margin: "0 0 6px 0", fontSize: 24, fontWeight: 800, color: "#fff" }}>
                Welcome to GabbarInfo AI 🚀
              </h1>
              <p style={{ margin: 0, color: "#94a3b8", fontSize: 14 }}>
                Your autonomous marketing command center. Connect your assets below to automate Google Ads, Meta Ads, and WordPress SEO.
              </p>
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <a
                href="/chat"
                className="btn-gabbar-dark"
                style={{
                  padding: "11px 22px",
                  fontSize: 14,
                  textDecoration: "none",
                }}
              >
                💬 Launch Chat Agent
              </a>
              <a
                href="/seo"
                className="btn-gabbar-gold"
                style={{
                  padding: "11px 24px",
                  fontSize: 14,
                  textDecoration: "none",
                }}
              >
                🌐 Open SEO Suite ↗
              </a>
            </div>
          </div>
        </div>

        {/* ── 3 CORE ENGINE PANELS ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* 1. WORDPRESS WEBSITE & SEO ENGINE */}
          <section
            style={{
              padding: 24,
              borderRadius: 16,
              background: "rgba(15, 23, 42, 0.65)",
              backdropFilter: "blur(16px)",
              border: "1.5px solid rgba(245, 183, 22, 0.22)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.4), 0 0 20px rgba(245, 183, 22, 0.05)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 20 }}>🌐</span>
              <h2 style={{ margin: 0, fontSize: 18, color: "#fff" }}>WordPress Website & SEO Engine</h2>
            </div>
            <WordPressSiteConnect />
          </section>

          {/* 2. GOOGLE ADS ACCOUNT */}
          <section
            style={{
              padding: 24,
              borderRadius: 16,
              background: "rgba(15, 23, 42, 0.65)",
              backdropFilter: "blur(16px)",
              border: "1.5px solid rgba(245, 183, 22, 0.22)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.4), 0 0 20px rgba(245, 183, 22, 0.05)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 20 }}>🎯</span>
              <h2 style={{ margin: 0, fontSize: 18, color: "#fff" }}>Google Ads Account</h2>
            </div>
            <GoogleAdsAccountConnect />
          </section>

          {/* 3. FACEBOOK BUSINESS */}
          <section
            style={{
              padding: 24,
              borderRadius: 16,
              background: "rgba(15, 23, 42, 0.65)",
              backdropFilter: "blur(16px)",
              border: "1.5px solid rgba(245, 183, 22, 0.22)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.4), 0 0 20px rgba(245, 183, 22, 0.05)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 20 }}>📘</span>
              <h2 style={{ margin: 0, fontSize: 18, color: "#fff" }}>Facebook Business & Instagram</h2>
            </div>
            <FacebookBusinessConnect />
          </section>
        </div>
      </main>

      {/* Buy Credits Modal */}
      <BuyCreditsModal
        isOpen={showBuyCredits}
        onClose={() => setShowBuyCredits(false)}
        userEmail={session?.user?.email}
      />
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
