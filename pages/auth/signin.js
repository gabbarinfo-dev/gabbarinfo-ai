// pages/auth/signin.js
"use client";

import { signIn, useSession } from "next-auth/react";
import { useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";

export default function SignInPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(router.query.callbackUrl || "/chat");
    }
  }, [status, router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at 50% 15%, rgba(245, 183, 22, 0.15) 0%, rgba(16, 185, 129, 0.08) 35%, #080b11 70%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <Head>
        <title>GabbarInfo AI · Autonomous Growth Command Center</title>
      </Head>

      {/* Ambient luxury neural glow orbs */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "15%",
          width: 420,
          height: 420,
          background: "radial-gradient(circle, rgba(245, 183, 22, 0.2) 0%, transparent 70%)",
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "10%",
          right: "15%",
          width: 450,
          height: 450,
          background: "radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, rgba(6, 182, 212, 0.1) 40%, transparent 70%)",
          filter: "blur(90px)",
          pointerEvents: "none",
        }}
      />

      {/* Subtle Golden Geometric Grid Lines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(rgba(245, 183, 22, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(245, 183, 22, 0.04) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
          pointerEvents: "none",
          opacity: 0.7,
        }}
      />

      {/* Main Luxury Glass Card */}
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          background: "rgba(11, 15, 25, 0.82)",
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          border: "1.5px solid rgba(245, 183, 22, 0.35)",
          borderRadius: 24,
          padding: "44px 38px",
          boxShadow: "0 28px 64px rgba(0, 0, 0, 0.75), 0 0 32px rgba(245, 183, 22, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
          position: "relative",
          zIndex: 1,
          textAlign: "center",
        }}
      >
        {/* Brand Tag */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 14px",
            borderRadius: 999,
            background: "rgba(245, 183, 22, 0.12)",
            border: "1px solid rgba(245, 183, 22, 0.4)",
            marginBottom: 20,
            boxShadow: "0 0 16px rgba(245, 183, 22, 0.2)",
          }}
        >
          <span style={{ fontSize: 13, color: "#F5B716" }}>⚡</span>
          <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#F5B716" }}>
            GABBARINFO AI · NEURAL SUITE
          </span>
        </div>

        {/* Brand Name & Headline */}
        <h1
          style={{
            margin: "0 0 10px 0",
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            fontFamily: "'Outfit', sans-serif",
            background: "linear-gradient(135deg, #ffffff 30%, #F5B716 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Autonomous Marketing
        </h1>

        <p style={{ margin: "0 0 28px 0", fontSize: 14, color: "#94a3b8", lineHeight: 1.6 }}>
          High-performance AI engine orchestrating Google Ads, Meta Ads, and automated WordPress SEO on autopilot.
        </p>

        {/* Luxury Feature Pillars */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32, textAlign: "left" }}>
          {[
            { icon: "🎯", text: "Autonomous Google Search & PMax Ad Campaigns" },
            { icon: "📘", text: "Meta Ads & 1-Click Instagram/Facebook Distribution" },
            { icon: "🌐", text: "WordPress SEO & Daily 6:00 AM Content Engine" },
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                borderRadius: 12,
                fontSize: 13,
                color: "#e2e8f0",
              }}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span style={{ fontWeight: 500 }}>{item.text}</span>
            </div>
          ))}
        </div>

        {/* Signature Sliding Action Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Primary Google Button with Sliding Gold Animation */}
          <button
            onClick={() => signIn("google", { callbackUrl: "/chat" })}
            className="btn-gabbar-gold"
            style={{
              width: "100%",
              padding: "14px 20px",
              fontSize: 15,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google ↗</span>
          </button>

          {/* Secondary Facebook Button with Sliding Dark Animation */}
          <button
            onClick={() => signIn("facebook", { callbackUrl: "/chat" })}
            className="btn-gabbar-dark"
            style={{
              width: "100%",
              padding: "13px 20px",
              fontSize: 14,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            <span>Continue with Facebook ↗</span>
          </button>
        </div>

        {/* Security & Verification Footer */}
        <div
          style={{
            marginTop: 28,
            paddingTop: 18,
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            fontSize: 12,
            color: "#64748b",
          }}
        >
          <span style={{ color: "#F5B716" }}>🔒</span>
          <span>Enterprise 256-Bit Neural Encrypted OAuth 2.0 Security</span>
        </div>
      </div>
    </div>
  );
}
