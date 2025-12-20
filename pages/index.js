"use client";

import { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

export default function HomePage() {
  const { data: session, status } = useSession();

  const [credits, setCredits] = useState(null);
  const [unlimited, setUnlimited] = useState(false);
  const [loadingCredits, setLoadingCredits] = useState(true);
  const role = session?.user?.role || "client";

  // Load credits when user is logged in
  useEffect(() => {
    if (!session) return;

    async function fetchCredits() {
      try {
        const res = await fetch("/api/credits/get");
        if (!res.ok) {
          console.error("Failed to load credits:", await res.text());
          return;
        }
        const data = await res.json();
        setCredits(typeof data.credits === "number" ? data.credits : null);
        setUnlimited(Boolean(data.unlimited));
      } catch (err) {
        console.error("Error loading credits:", err);
      } finally {
        setLoadingCredits(false);
      }
    }

    fetchCredits();
  }, [session]);

  // ---- Auth loading states ----
  if (status === "loading") {
    return (
      <div style={{ padding: 40, fontFamily: "Inter, Arial" }}>
        Checking session…
      </div>
    );
  }

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

            {/* Facebook */}
      <button
        onClick={() => signIn("facebook")}
        style={{
          marginTop: 12,
          padding: "10px 16px",
          borderRadius: 6,
          border: "1px solid #1877F2",
          background: "#1877F2",
          color: "#fff",
          cursor: "pointer",
          display: "block",
        }}
      >
        Continue with Facebook (Test)
      </button>
      </div>
    );
  }

  // ---- Logged-in view ----
  return (
    <div
      style={{
        fontFamily: "Inter, Arial",
        minHeight: "100vh",
        padding: 32,
        background: "#fafafa",
      }}
    >
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
            Logged in as {session.user?.email} ({role})
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

          {role === "owner" && (
            <p style={{ marginBottom: 8 }}>
              You have <strong>unlimited</strong> access. Credits are not
              deducted for your account.
            </p>
          )}

          {role !== "owner" && (
            <>
              {loadingCredits ? (
                <p>Loading your credits…</p>
              ) : (
                <p>
                  You currently have{" "}
                  <strong>{credits == null ? 0 : credits}</strong> credits left.
                </p>
              )}
              <p style={{ fontSize: 13, color: "#666" }}>
                1 credit = 1 AI answer. When credits hit 0, GabbarInfo AI will
                stop responding until you are topped up.
              </p>
            </>
          )}
        </section>

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
              fontSize: 14,
            }}
          >
            Open Chat
          </a>

{/* ✅ ADD THIS BELOW */}
<button
  onClick={() => {
    window.location.href = "/api/facebook/connect";
  }}
  style={{
    padding: "10px 16px",
    borderRadius: 8,
    border: "1px solid #ddd",
    background: "#1877F2",
    color: "#fff",
    fontSize: 14,
    cursor: "pointer",
  }}
>
  Connect Facebook Business
</button>

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
              Open Admin (add clients & credits)
            </a>
          )}
        </section>
      </main>
    </div>
  );
}
