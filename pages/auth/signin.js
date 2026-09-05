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
        background: "radial-gradient(circle at 50% 10%, #172554 0%, #080b11 60%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Head>
        <title>Sign In | GabbarInfo AI</title>
      </Head>

      {/* Ambient decorative glow spheres */}
      <div
        style={{
          position: "absolute",
          top: "15%",
          left: "20%",
          width: 320,
          height: 320,
          background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)",
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "15%",
          right: "20%",
          width: 360,
          height: 360,
          background: "radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)",
          filter: "blur(70px)",
          pointerEvents: "none",
        }}
      />

      {/* Main Glass Card */}
      <div
        style={{
          maxWidth: 460,
          width: "100%",
          background: "rgba(15, 23, 42, 0.75)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 20,
          padding: "40px 36px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(59, 130, 246, 0.1)",
          position: "relative",
          zIndex: 1,
          textAlign: "center",
        }}
      >
        {/* Brand Icon & Heading */}
        <div style={{ display: "inline-flex", padding: 12, borderRadius: 16, background: "rgba(37, 99, 235, 0.15)", border: "1px solid rgba(59, 130, 246, 0.3)", marginBottom: 16 }}>
          <span style={{ fontSize: 32 }}>🚀</span>
        </div>

        <h1
          style={{
            margin: "0 0 8px 0",
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: "-0.5px",
            background: "linear-gradient(135deg, #ffffff 30%, #94a3b8 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          GabbarInfo AI
        </h1>

        <p style={{ margin: "0 0 28px 0", fontSize: 14, color: "#94a3b8", lineHeight: 1.5 }}>
          Your Autonomous Digital Marketing Strategist. Plan campaigns, automate ads, and publish content on autopilot.
        </p>

        {/* Feature Pills */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32, textAlign: "left" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#cbd5e1" }}>
            <span style={{ color: "#34d399", fontSize: 14 }}>✓</span> Autonomous Google Ads Search Campaigns
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#cbd5e1" }}>
            <span style={{ color: "#34d399", fontSize: 14 }}>✓</span> Meta Ads & 1-Click Instagram/Facebook Publishing
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#cbd5e1" }}>
            <span style={{ color: "#34d399", fontSize: 14 }}>✓</span> WordPress SEO & Daily Autonomous Content Engine
          </div>
        </div>

        {/* OAuth Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Google Button */}
          <button
            onClick={() => signIn("google", { callbackUrl: "/chat" })}
            style={{
              width: "100%",
              padding: "13px 18px",
              borderRadius: 12,
              border: "1px solid rgba(255, 255, 255, 0.15)",
              background: "#ffffff",
              color: "#0f172a",
              fontWeight: 600,
              fontSize: 15,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              transition: "all 0.2s ease",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
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
            Continue with Google
          </button>

          {/* Facebook Button */}
          <button
            onClick={() => signIn("facebook", { callbackUrl: "/chat" })}
            style={{
              width: "100%",
              padding: "13px 18px",
              borderRadius: 12,
              border: "none",
              background: "linear-gradient(135deg, #1877F2 0%, #1558b0 100%)",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: 15,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              boxShadow: "0 4px 14px rgba(24, 119, 242, 0.35)",
              transition: "all 0.2s ease",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#ffffff">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            Continue with Facebook
          </button>
        </div>

        {/* Security Tag */}
        <div style={{ marginTop: 24, fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <span>🔒</span> Enterprise 256-Bit Encrypted OAuth Security
        </div>
      </div>
    </div>
  );
}
