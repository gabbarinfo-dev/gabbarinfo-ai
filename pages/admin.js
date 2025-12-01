// pages/admin.js
"use client";

import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const role = session?.user?.role || "client";

  const [email, setEmail] = useState("");
  const [userRole, setUserRole] = useState("client");
  const [creditsToAdd, setCreditsToAdd] = useState("0");

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  if (status === "loading") {
    return <div style={{ padding: 40 }}>Checking session…</div>;
  }

  if (!session) {
    return (
      <div style={{ fontFamily: "Inter, Arial", padding: 40 }}>
        <h1>Admin – Sign in</h1>
        <p>Only GabbarInfo AI owners can access this page.</p>
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

  if (role !== "owner") {
    return (
      <div style={{ fontFamily: "Inter, Arial", padding: 40 }}>
        <h1>Access denied</h1>
        <p>Your account is not marked as <b>owner</b>. Ask admin to upgrade you.</p>
        <button
          onClick={() => signOut()}
          style={{ marginTop: 16, padding: "8px 14px", borderRadius: 6 }}
        >
          Sign out
        </button>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/add-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          role: userRole,
          creditsToAdd: Number(creditsToAdd) || 0,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setResult({
          type: "error",
          message: data.error || "Something went wrong.",
          details: data.details,
        });
      } else {
        setResult({
          type: "success",
          message: `User ${data.user?.email} set as ${data.user?.role}.`,
          details: data.credits?.message,
        });
      }
    } catch (err) {
      setResult({
        type: "error",
        message: err.message || "Network error.",
      });
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
        padding: 32,
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 24,
          alignItems: "center",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>GabbarInfo AI – Admin</h1>
          <div style={{ fontSize: 13, color: "#666" }}>
            Logged in as {session.user?.email} (Owner)
          </div>
        </div>
        <button
          onClick={() => signOut()}
          style={{ padding: "6px 10px", borderRadius: 6 }}
        >
          Sign out
        </button>
      </header>

      <main
        style={{
          maxWidth: 520,
          margin: "0 auto",
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #eee",
          padding: 24,
          boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
        }}
      >
        <h2>Add / Update User</h2>
        <p style={{ fontSize: 13, color: "#555" }}>
          Use this form to allow a new client to sign in, set their role, and
          optionally add credits. You no longer need to touch Supabase or URLs.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
          <label style={{ fontSize: 13 }}>
            Email (Google account)
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="client@example.com"
              style={{
                width: "100%",
                marginTop: 4,
                padding: 8,
                borderRadius: 6,
                border: "1px solid #ddd",
              }}
            />
          </label>

          <label style={{ fontSize: 13 }}>
            Role
            <select
              value={userRole}
              onChange={(e) => setUserRole(e.target.value)}
              style={{
                width: "100%",
                marginTop: 4,
                padding: 8,
                borderRadius: 6,
                border: "1px solid #ddd",
              }}
            >
              <option value="client">Client</option>
              <option value="owner">Owner</option>
            </select>
          </label>

          <label style={{ fontSize: 13 }}>
            Credits to add now
            <input
              type="number"
              value={creditsToAdd}
              onChange={(e) => setCreditsToAdd(e.target.value)}
              min="0"
              style={{
                width: "100%",
                marginTop: 4,
                padding: 8,
                borderRadius: 6,
                border: "1px solid #ddd",
              }}
            />
            <div style={{ fontSize: 11, color: "#777", marginTop: 4 }}>
              - If this is a brand new email that has never logged into GabbarInfo AI,
                the user will be allowed to sign in, but credits will be added
                only after their profile exists.  
              - You can always run this again later to top up.
            </div>
          </label>

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
              cursor: "pointer",
            }}
          >
            {loading ? "Saving…" : "Save user & credits"}
          </button>
        </form>

        {result && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 8,
              border:
                result.type === "success"
                  ? "1px solid #bbf7d0"
                  : "1px solid #fecaca",
              background:
                result.type === "success" ? "#ecfdf3" : "#fef2f2",
              fontSize: 13,
            }}
          >
            <strong>
              {result.type === "success" ? "Success" : "Error"}
            </strong>
            <div>{result.message}</div>
            {result.details && (
              <div style={{ marginTop: 4, color: "#555" }}>
                {result.details}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
