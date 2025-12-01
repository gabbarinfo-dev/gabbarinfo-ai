// pages/index.js
"use client";

import { useSession, signIn, signOut } from "next-auth/react";

export default function HomePage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div style={{ padding: 40 }}>Checking session…</div>;
  }

  // Not logged in → show simple login
  if (!session) {
    return (
      <div style={{ fontFamily: "Inter, Arial", padding: 40 }}>
        <h1>Welcome to GabbarInfo AI</h1>
        <p>Please sign in with your approved email to continue.</p>
        <button
          onClick={() => signIn("google")}
          style={{
            padding: "10px 16px",
            borderRadius: 6,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  const { user } = session;
  const role = user?.role || "client";
  const credits = typeof user?.credits === "number" ? user.credits : 0;

  return (
    <div
      style={{
        fontFamily: "Inter, Arial",
        minHeight: "100vh",
        background: "#f5f5f5",
      }}
    >
      <header
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid #ddd",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#fff",
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>GabbarInfo AI</div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
            Logged in as {user?.email} ({role})
          </div>
        </div>
        <button
          onClick={() => signOut()}
          style={{
            padding: "8px 14px",
            borderRadius: 6,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Sign out
        </button>
      </header>

      <main
        style={{
          padding: 24,
        }}
      >
        <h2>Your Credits</h2>
        <p>
          You currently have <strong>{credits}</strong> credits left.
        </p>

        <p style={{ marginTop: 20 }}>
          {/* Placeholder – here you plug in your existing AI UI */}
          This is where your main GabbarInfo AI interface goes.
        </p>
      </main>
    </div>
  );
}
