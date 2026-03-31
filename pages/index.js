"use client";

import { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import FacebookBusinessConnect from "./components/facebook/FacebookBusinessConnect";
import BuyCreditsModal from "./components/BuyCreditsModal";

export default function HomePage() {
  const { data: session, status } = useSession();

  const [credits, setCredits] = useState(null);
  const [unlimited, setUnlimited] = useState(false);
  const [loadingCredits, setLoadingCredits] = useState(true);

  const role = session?.user?.role || "client";
  // ── Buy Credits modal state ──
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
      <div style={{ padding: 40, fontFamily: "Inter, Arial" }}>
        Checking session…
      </div>
    );
  }

  /* -------------------------
     NOT LOGGED IN
  ------------------------- */
  if (!session) {
    return (
      <div style={{ padding: 40, fontFamily: "Inter, Arial" }}>
        <h1>GabbarInfo AI</h1>
        <p>Please sign in to use GabbarInfo AI.</p>

        <button
          onClick={() => signIn("google")}
          style={{
            marginTop: 16,
            padding: "10px 16px",
            borderRadius: 6,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Sign in with Google
        </button>
        <div style={{ height: 8 }} />
        <button
          onClick={() => signIn("facebook")}
          style={{
            padding: "10px 16px",
            borderRadius: 6,
            border: "1px solid #ddd",
            background: "#1877F2",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Continue with Facebook
        </button>
      </div>
    );
  }

  /* -------------------------
     LOGGED IN VIEW
  ------------------------- */
  return (
    <div
      style={{
        fontFamily: "Inter, Arial",
        minHeight: "100vh",
        padding: 32,
        background: "#fafafa",
      }}
    >
      {/* HEADER */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>GabbarInfo AI</h1>
          <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>
            Logged in as {session.user.email || "Unknown Email"} ({role})
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {role === "owner" ? (
            <span
              style={{
                fontSize: 11,
                padding: "4px 8px",
                borderRadius: 999,
                border: "1px solid #ddd",
                background: "#ffe8cc",
                color: "#8a3c00",
              }}
            >
              Owner · Unlimited access
            </span>
          ) : (
            <span
              style={{
                fontSize: 11,
                padding: "4px 8px",
                borderRadius: 999,
                border: "1px solid #ddd",
                background: "#e8f0fe",
                color: "#174ea6",
              }}
            >
              {loadingCredits
                ? "Client · Credits: …"
                : `Client · Credits: ${credits ?? 0}`}
            </span>
          )}

          <button
            onClick={() => signOut()}
            style={{ padding: "6px 10px", borderRadius: 6 }}
          >
            Sign out
          </button>
        </div>
      </header>

      <main
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {/* 📧 MISSING EMAIL COLLECTION FLOW */}
        {!session.user.email && (
          <EmailFallbackForm />
        )}

        {/* CREDITS */}
        <section
          style={{
            padding: 20,
            borderRadius: 12,
            background: "#fff",
            border: "1px solid #eee",
            maxWidth: 640,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Your Credits</h2>

          {role === "owner" ? (
            <p>
              You have <strong>unlimited</strong> access.
            </p>
          ) : loadingCredits ? (
            <p>Loading credits…</p>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <p style={{ margin: 0 }}>
                You currently have <strong>{credits ?? 0}</strong> credits left.
              </p>
              {/* ➕ Add Credits button — opens the Buy Credits modal */}
              <button
                onClick={() => setShowBuyCredits(true)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  border: "1.5px solid #4f46e5",
                  background: "#eef2ff",
                  color: "#4f46e5",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                ➕ Add Credits
              </button>
            </div>
          )}
        </section>

        {/* ACTIONS */}
        <section
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            maxWidth: 640,
          }}
        >
          <a
            href="/chat"
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#fff",
              textDecoration: "none",
              color: "#444",
              fontSize: 14,
            }}
          >
            Open Chat
          </a>

          {role === "owner" && (
            <a
              href="/admin"
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "#fff",
                textDecoration: "none",
                color: "#444",
                fontSize: 14,
              }}
            >
              Open Admin
            </a>
          )}
        </section>

        {/* META CONNECTION STATUS */}
        <section
          style={{
            padding: 20,
            borderRadius: 12,
            background: "#fff",
            border: "1px solid #eee",
            maxWidth: 640,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Facebook Business</h2>
          <FacebookBusinessConnect />
        </section>
      </main>

      {/* ── Buy Credits Modal ── */}
      {/* userEmail is read from session and passed as prop */}
      <BuyCreditsModal
        isOpen={showBuyCredits}
        onClose={() => setShowBuyCredits(false)}
        userEmail={session?.user?.email}
      />
    </div>
  );
}
/* -------------------------
   EMAIL FALLBACK FORM COMPONENT
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
        
        // 🚀 THE "ONE-GO" REFRESH
        // We trigger an instant re-auth. Since they are already logged into Facebook,
        // it will just blink and come back with a FRESH token containing the new email.
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
        padding: "24px",
        borderRadius: 16,
        background: "#fff",
        border: "1px solid #e2e8f0",
        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
        maxWidth: 640,
        marginBottom: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ 
          background: "#fee2e2", 
          color: "#dc2626", 
          width: 40, 
          height: 40, 
          borderRadius: "50%", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          fontSize: 20
        }}>
          ⚠️
        </div>
        <h2 style={{ margin: 0, fontSize: 18, color: "#1e293b" }}>Email Required</h2>
      </div>

      <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, marginBottom: 20 }}>
        We couldn't retrieve your email from your Facebook login. 
        Please provide an email address to use as your identifier on this platform.
        <strong> This is required to connect Facebook Business assets.</strong>
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          type="email"
          placeholder="Enter your email address"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            fontSize: 14,
            outline: "none",
          }}
          disabled={loading}
        />
        
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "12px 24px",
              background: "#1877F2",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: 14,
              flex: 1,
            }}
          >
            {loading ? "Saving..." : "Save and Continue"}
          </button>
          
          <button
            type="button"
            onClick={() => signOut()}
            style={{
              padding: "12px 16px",
              background: "#f1f5f9",
              color: "#475569",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Sign out
          </button>
        </div>
      </form>

      {message && (
        <p style={{ 
          marginTop: 16, 
          fontSize: 13, 
          color: message.startsWith("Error") ? "#dc2626" : "#16a34a",
          fontWeight: 500 
        }}>
          {message}
        </p>
      )}
    </div>
  );
}
