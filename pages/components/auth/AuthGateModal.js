"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";

export default function AuthGateModal({ isOpen, onClose, title = "Sign In Required", subtitle }) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(3, 7, 18, 0.82)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
        padding: "20px 16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          maxWidth: 460,
          width: "100%",
          background: "linear-gradient(180deg, rgba(16, 22, 34, 0.96) 0%, rgba(8, 11, 17, 0.98) 100%)",
          border: "1px solid rgba(255, 255, 255, 0.16)",
          borderRadius: 24,
          padding: "36px 32px 30px",
          boxShadow: "0 30px 80px rgba(0, 0, 0, 0.9), 0 0 40px rgba(59, 130, 246, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
          position: "relative",
          textAlign: "center",
          animation: "modalFadeIn 0.22s ease-out forwards",
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 18,
            right: 18,
            background: "rgba(255, 255, 255, 0.06)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            color: "#94a3b8",
            width: 34,
            height: 34,
            borderRadius: "50%",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.14)";
            e.currentTarget.style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
            e.currentTarget.style.color = "#94a3b8";
          }}
          title="Close (Keep Browsing)"
        >
          ✕
        </button>

        {/* Brand Emblem */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 62,
            height: 62,
            borderRadius: 18,
            background: "linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(8, 11, 17, 0.9) 100%)",
            border: "1px solid rgba(59, 130, 246, 0.4)",
            marginBottom: 16,
            boxShadow: "0 0 25px rgba(59, 130, 246, 0.35)",
          }}
        >
          <span style={{ fontSize: 28 }}>🚀</span>
        </div>

        <h2
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "-0.5px",
            margin: "0 0 8px 0",
            color: "#ffffff",
          }}
        >
          {title}
        </h2>

        <p
          style={{
            color: "#94a3b8",
            fontSize: 13.5,
            margin: "0 0 24px 0",
            lineHeight: 1.5,
          }}
        >
          {subtitle || "Sign in with your Google or Facebook account to activate autonomous marketing agents, connect platforms, or purchase a subscription plan."}
        </p>

        {/* Action Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button
            onClick={() => signIn("google")}
            style={{
              width: "100%",
              padding: "13px 20px",
              fontSize: 14.5,
              fontWeight: 700,
              background: "#ffffff",
              color: "#0f172a",
              border: "none",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(255, 255, 255, 0.15)",
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 6px 20px rgba(255, 255, 255, 0.25)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "0 4px 14px rgba(255, 255, 255, 0.15)";
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Continue with Google</span>
          </button>

          <button
            onClick={() => signIn("facebook")}
            style={{
              width: "100%",
              padding: "13px 20px",
              fontSize: 14.5,
              fontWeight: 700,
              background: "#1877F2",
              color: "#ffffff",
              border: "none",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(24, 119, 242, 0.3)",
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 6px 20px rgba(24, 119, 242, 0.45)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "0 4px 14px rgba(24, 119, 242, 0.3)";
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            <span>Continue with Facebook</span>
          </button>
        </div>

        {/* Security / Compliance Badges */}
        <div
          style={{
            marginTop: 22,
            paddingTop: 16,
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            fontSize: 11.5,
            color: "#64748b",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <span>🔒</span> Enterprise 256-Bit Encrypted OAuth Security
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
            <Link href="/terms" style={{ color: "#94a3b8", textDecoration: "underline" }} target="_blank">
              Terms & Conditions
            </Link>
            <Link href="/privacy-policy" style={{ color: "#94a3b8", textDecoration: "underline" }} target="_blank">
              Privacy Policy
            </Link>
            <Link href="/refund-policy" style={{ color: "#94a3b8", textDecoration: "underline" }} target="_blank">
              Refund Policy
            </Link>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes modalFadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
