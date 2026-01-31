"use client";

import { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import FacebookBusinessConnect from "./components/facebook/FacebookBusinessConnect";
import AnimatedSkyBackground from "./components/facebook/ui/AnimatedSkyBackground";

export default function HomePage() {
  const { data: session, status } = useSession();

  const [credits, setCredits] = useState(null);
  const [unlimited, setUnlimited] = useState(false);
  const [loadingCredits, setLoadingCredits] = useState(true);

  const role = session?.user?.role || "client";

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
    <AnimatedSkyBackground>
      <>
        <style jsx>{`
          .hero-title {
            font-size: 44px;
            font-weight: 600;
            color: #ffffff;
            margin-bottom: 12px;
            position: relative;
            text-shadow:
              0 0 12px rgba(140,180,255,0.35),
              0 0 26px rgba(120,160,255,0.25);
          }

          /* ELECTRIC TEXT CORE */
          .ai-electric {
            position: relative;
            display: inline-block;
          }

          /* ELECTRIC EDGE SPARKS */
          .ai-electric::before,
          .ai-electric::after {
            content: attr(data-text);
            position: absolute;
            inset: 0;
            color: transparent;
            -webkit-text-stroke: 1px rgba(160,200,255,0.9);
            opacity: 0;
            pointer-events: none;
            animation: spark 3.2s infinite steps(1);
          }

          .ai-electric::after {
            -webkit-text-stroke: 1px rgba(210,230,255,0.9);
            animation-delay: 1.6s;
          }

          @keyframes spark {
            0% { opacity: 0; transform: translate(0,0); }
            4% { opacity: 1; transform: translate(-1px,1px); }
            5% { opacity: 0; }
            22% { opacity: 0; }
            26% { opacity: 1; transform: translate(1px,-1px); }
            27% { opacity: 0; }
            100% { opacity: 0; }
          }

          .hero-subtitle {
            font-size: 16px;
            color: rgba(255,255,255,0.75);
            margin-bottom: 26px;
            text-shadow: 0 0 10px rgba(255,255,255,0.15);
          }
        `}</style>

        <div style={{ padding: 40, textAlign: "center" }}>
          {/* ⚡ ELECTRIC AI TITLE */}
          <h1 className="hero-title">
            <span
              className="ai-electric"
              data-text="GabbarInfo AI"
            >
              GabbarInfo AI
            </span>
          </h1>

          <p className="hero-subtitle">
            Please sign in to use GabbarInfo AI.
          </p>

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

          <footer
            style={{
              marginTop: 60,
              fontSize: 13,
              color: "#888",
            }}
          >
            © 2026 GabbarInfo AI ·{" "}
            <a
              href="https://gabbarinfo.com/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#888", textDecoration: "none" }}
            >
              Privacy Policy
            </a>
          </footer>
        </div>
      </>
    </AnimatedSkyBackground>
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
        backgroundImage: "url('/backgrounds/dashboard-bg.jpg')",
backgroundSize: "cover",
backgroundPosition: "center",
backgroundRepeat: "no-repeat",
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
            Logged in as {session.user.email} ({role})
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

      <main>
        {/* CREDITS */}
        <section
          style={{
            padding: 20,
            borderRadius: 12,
            background: "#fff",
            border: "1px solid #eee",
            maxWidth: 640,
            marginBottom: 24,
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
            <p>
              You currently have <strong>{credits ?? 0}</strong> credits left.
            </p>
          )}
        </section>

        {/* ACTIONS */}
        <section
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            maxWidth: 640,
            marginBottom: 24,
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

      {/* FOOTER */}
      <footer
        style={{
          marginTop: 40,
          textAlign: "center",
          fontSize: 13,
          color: "#888",
          paddingBottom: 20,
        }}
      >
        &copy; 2026 GabbarInfo AI &middot;{" "}
        <a
          href="https://gabbarinfo.com/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#888", textDecoration: "none" }}
          onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
          onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
        >
          Privacy Policy
        </a>
      </footer>
    </div>
  );
}
