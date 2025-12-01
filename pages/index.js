// pages/index.js (client-facing page)
"use client";

import { useState } from "react";
import { useSession, signIn } from "next-auth/react";

export default function HomePage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info"); // "success" | "error" | "info"

  // Loading state while checking session
  if (status === "loading") {
    return <div style={{ padding: 40 }}>Checking session...</div>;
  }

  // If user is logged out
  if (!session) {
    return (
      <div style={{ fontFamily: "Inter, Arial", padding: 40 }}>
        <h1>Welcome to GabbarInfo AI</h1>
        <p>Please sign in to continue.</p>
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

  // If user is logged in, show credits and role
  const { user } = session;

  return (
    <div
      style={{
        fontFamily: "Inter, Arial",
        minHeight: "100vh",
        background: "#f5f5f5",
        padding: 40,
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
            Logged in as {user?.email}
          </div>
        </div>
        <button
          onClick={() => signIn("google")}
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
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <h2>Welcome {user?.email}</h2>

        <p>
          You are logged in as a{" "}
          <strong>{user?.role || "client"}</strong> with{" "}
          <strong>{user?.credits || 0}</strong> credits.
        </p>

        {message && (
          <div
            style={{
              marginTop: 16,
              padding: "10px 12px",
              borderRadius: 8,
              fontSize: 13,
              background:
                messageType === "success"
                  ? "#ecfdf3"
                  : messageType === "error"
                  ? "#fef2f2"
                  : "#f3f4f6",
              color:
                messageType === "success"
                  ? "#166534"
                  : messageType === "error"
                  ? "#b91c1c"
                  : "#111827",
              border:
                messageType === "success"
                  ? "1px solid #bbf7d0"
                  : messageType === "error"
                  ? "1px solid #fecaca"
                  : "1px solid #e5e7eb",
            }}
          >
            {message}
          </div>
        )}
      </main>
    </div>
  );
}
