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
            font-size: 42px;
            font-weight: 600;
            letter-spacing: 0.6px;
            color: #ffffff;
            margin-bottom: 10px;
            text-shadow:
              0 0 20px rgba(255,255,255,0.25),
              0 0 40px rgba(140,180,255,0.25);
          }

          .hero-subtitle {
            font-size: 16px;
            color: rgba(255,255,255,0.75);
            margin-bottom: 26px;
            text-shadow: 0 0 10px rgba(255,255,255,0.15);
          }
        `}</style>
/* ⚡ Electric current flowing through AI name */
.ai-electric {
  position: relative;
  display: inline-block;
}

/* moving electric shimmer */
.ai-electric::after {
  content: "";
  position: absolute;
  inset: -6px -10px;
  border-radius: 12px;

  background: linear-gradient(
    120deg,
    transparent 20%,
    rgba(120,180,255,0.9) 40%,
    rgba(180,220,255,0.9) 50%,
    rgba(120,180,255,0.9) 60%,
    transparent 80%
  );

  opacity: 0.6;
  filter: blur(8px);
  mix-blend-mode: screen;

  animation: electricFlow 3s linear infinite;
  pointer-events: none;
}

/* subtle power pulse */
@keyframes electricFlow {
  0% {
    transform: translateX(-120%);
    opacity: 0.2;
  }
  50% {
    opacity: 0.8;
  }
  100% {
    transform: translateX(120%);
    opacity: 0.2;
  }
}

        <div style={{ padding: 40, textAlign: "center" }}>
          <h1 className="hero-title">
  <span className="ai-electric">GabbarInfo AI</span>
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

          {/* FOOTER */}
          <footer
            style={{
              marginTop: 60,
              fontSize: 13,
              color: "#888",
            }}
          >
            &copy; 2026 GabbarInfo AI &middot;{" "}
            <a
              href="https://gabbarinfo.com/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#888", textDecoration: "none" }}
              onMouseOver={(e) =>
                (e.currentTarget.style.textDecoration = "underline")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.textDecoration = "none")
              }
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
