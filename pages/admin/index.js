// pages/admin/index.js
"use client";

import { useState } from "react";
import { useSession, signOut, signIn } from "next-auth/react";

export default function AdminPage() {
  const { data: session, status } = useSession();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("client");
  const [creditsToAdd, setCreditsToAdd] = useState("0");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info"); // "success" | "error" | "info"

  if (status === "loading") {
    return <div style={{ padding: 40 }}>Checking session…</div>;
  }

  // Not logged in
  if (!session) {
    return (
      <div style={{ fontFamily: "Inter, Arial", padding: 40 }}>
        <h1>GabbarInfo AI – Admin</h1>
        <p>You must sign in as the owner to access the admin panel.</p>
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

  // Logged in but not owner
  if (session.user?.role !== "owner") {
    return (
      <div style={{ fontFamily: "Inter, Arial", padding: 40 }}>
        <h1>GabbarInfo AI – Admin</h1>
        <p>Access denied. Only owner accounts can use this page.</p>
        <button
          onClick={() => signOut()}
          style={{
            padding: "8px 14px",
            borderRadius: 6,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
            marginTop: 12,
          }}
        >
          Sign out
        </button>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setMessageType("info");

    try {
      const res = await fetch("/api/admin/add-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          role,
          creditsToAdd,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage(
          data.error || "Something went wrong while saving the user."
        );
        setMessageType("error");
        return;
      }

      setMessage(
        data.message ||
          `User ${data.email} saved as ${data.role}${
            typeof data.credits === "number"
              ? ` · Credits now: ${data.credits}`
              : ""
          }`
      );
      setMessageType("success");
    } catch (err) {
      console.error("ADMIN SUBMIT ERROR:", err);
      setMessage("Unexpected error while saving user.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

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
          <div style={{ fontSize: 20, fontWeight: 600 }}>
            GabbarInfo AI — Admin
          </div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
            Logged in as {session.user?.email} (Owner)
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
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 520,
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            padding: 24,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>Add / Update User</h2>
          <p style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>
            Use this form to allow a new client to sign in, set their role, and
            optionally add credits.
          </p>

          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            {/* Email */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  marginBottom: 4,
                  fontWeight: 500,
                }}
              >
                Email (Google account)
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid #ddd",
                  fontSize: 14,
                }}
              />
            </div>

            {/* Role */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  marginBottom: 4,
                  fontWeight: 500,
                }}
              >
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid #ddd",
                  fontSize: 14,
                }}
              >
                <option value="client">Client</option>
                <option value="owner">Owner</option>
              </select>
            </div>

            {/* Credits */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  marginBottom: 4,
                  fontWeight: 500,
                }}
              >
                Credits to add now
              </label>
              <input
                type="number"
                min="0"
                value={creditsToAdd}
                onChange={(e) => setCreditsToAdd(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid #ddd",
                  fontSize: 14,
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 8,
                padding: "10px 14px",
                borderRadius: 8,
                border: "none",
                background: "#111827",
                color: "#fff",
                fontSize: 14,
                cursor: loading ? "default" : "pointer",
              }}
            >
              {loading ? "Saving…" : "Save user & credits"}
            </button>
          </form>

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
        </div>
      </main>
    </div>
  );
}
