"use client";

import { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import FacebookBusinessConnect from "./components/facebook/FacebookBusinessConnect";

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
        {/* 📧 MISSING EMAIL WARNING */}
        {!session.user.email && (
          <div
            style={{
              padding: "16px 20px",
              borderRadius: 12,
              background: "#fff5f5",
              border: "1px solid #feb2b2",
              color: "#c53030",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
              maxWidth: 640,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              ⚠️ Missing Email Address
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>
              We couldn't retrieve your email from your login. This will prevent
              you from connecting Facebook Business assets.
              <br />
              <strong>Fix:</strong> Please sign out and log in using **Google**,
              or ensure your Facebook account has a primary email address
              shared.
            </div>
            <button
              onClick={() => signOut()}
              style={{
                width: "fit-content",
                padding: "8px 16px",
                background: "#c53030",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                marginTop: 4,
              }}
            >
              Sign out and try again
            </button>
          </div>
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
    </div>
  );
}
