// pages/admin/index.js
"use client";

import { useState } from "react";
import { useSession, signOut, signIn } from "next-auth/react";

export default function AdminPage() {
  const { data: session, status } = useSession();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("client");
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // NEW STATES FOR FILE UPLOAD
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);

  if (status === "loading") {
    return <div style={{ padding: 40 }}>Checking session…</div>;
  }

  if (!session) {
    return (
      <div style={{ padding: 40, fontFamily: "Inter, Arial" }}>
        <h1>GabbarInfo AI — Admin</h1>
        <p>You must sign in as the owner to use this page.</p>
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

  if (session.user?.role !== "owner") {
    return (
      <div style={{ padding: 40, fontFamily: "Inter, Arial" }}>
        <h1>GabbarInfo AI — Admin</h1>
        <p>Access denied. Only owner accounts can use this page.</p>
        <button
          onClick={() => signOut()}
          style={{
            marginTop: 12,
            padding: "8px 14px",
            borderRadius: 6,
          }}
        >
          Sign out
        </button>
      </div>
    );
  }

  // ---------------------------------------------
  // HANDLE USER CREATION / UPDATE
  // ---------------------------------------------
  async function handleSubmit(e) {
    e.preventDefault();
    setMessage(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setMessage({ type: "error", text: "Please enter an email." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/add-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          role,
          creditsToAdd: Number(credits) || 0,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({
          type: "error",
          text: data.error || "Failed to save user.",
        });
      } else {
        setMessage({
          type: "success",
          text:
            data.message ||
            `User ${trimmedEmail} saved as ${data.role}. Credits: ${
              data.credits ?? "unchanged"
            }.`,
        });
      }
    } catch (err) {
      console.error(err);
      setMessage({
        type: "error",
        text: "Unexpected error while saving user.",
      });
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------
  // NEW: HANDLE FILE UPLOAD
  // ---------------------------------------------
  async function handleFileUpload(e) {
    e.preventDefault();
    setUploadMsg(null);

    if (!file) {
      setUploadMsg({ type: "error", text: "Please select a file first." });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("clientId", session.user.email);

    setUploading(true);

    try {
      const res = await fetch("/api/rag/upload-file", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setUploadMsg({
          type: "error",
          text: data.error || "Upload failed",
        });
      } else {
        setUploadMsg({
          type: "success",
          text: data.message || "File uploaded successfully!",
        });
      }
    } catch (err) {
      setUploadMsg({
        type: "error",
        text: "Unexpected error during upload.",
      });
    } finally {
      setUploading(false);
    }
  }

  // ---------------------------------------------
  // RENDER PAGE
  // ---------------------------------------------
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
          <h1 style={{ margin: 0 }}>GabbarInfo AI — Admin</h1>
          <div style={{ fontSize: 13, color: "#555" }}>
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

      <main style={{ maxWidth: 520, margin: "0 auto" }}>

        {/* ----------------------------------- */}
        {/* SECTION 1: Add / Update Users */}
        {/* ----------------------------------- */}
        <section
          style={{
            padding: 24,
            borderRadius: 12,
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            marginBottom: 30,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Add / Update User</h2>
          <p style={{ fontSize: 13, color: "#555" }}>
            Use this form to allow a new client to sign in, set their role, and
            optionally add credits.
          </p>

          <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
            <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
              Email (Google account)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 6,
                border: "1px solid #ddd",
                marginBottom: 12,
              }}
              required
            />

            <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 6,
                border: "1px solid #ddd",
                marginBottom: 12,
              }}
            >
              <option value="client">Client</option>
              <option value="owner">Owner</option>
            </select>

            <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
              Credits to add now
            </label>
            <input
              type="number"
              min="0"
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 6,
                border: "1px solid #ddd",
                marginBottom: 16,
              }}
            />

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
                background: "#111827",
                color: "#fff",
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
                padding: 12,
                borderRadius: 6,
                fontSize: 13,
                background:
                  message.type === "success" ? "#ecfdf3" : "#fef2f2",
                color: message.type === "success" ? "#166534" : "#b91c1c",
                border:
                  message.type === "success"
                    ? "1px solid #bbf7d0"
                    : "1px solid #fecaca",
              }}
            >
              {message.text}
            </div>
          )}
        </section>

        {/* ----------------------------------- */}
        {/* SECTION 2: FILE UPLOAD */}
        {/* ----------------------------------- */}
        <section
          style={{
            padding: 24,
            borderRadius: 12,
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Upload Knowledge Files</h2>
          <p style={{ fontSize: 13, color: "#555" }}>
            Supported formats: <b>PDF, DOCX, Images (PNG/JPG)</b>.
            <br />
            Files will be stored in your Supabase Knowledge Base.
          </p>

          <form onSubmit={handleFileUpload} style={{ marginTop: 16 }}>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files[0])}
              style={{ marginBottom: 16 }}
              accept=".pdf,.docx,.jpg,.jpeg,.png"
            />

            <button
              type="submit"
              disabled={uploading}
              style={{
                width: "100%",
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
                background: "#2563eb",
                color: "#fff",
                cursor: uploading ? "default" : "pointer",
              }}
            >
              {uploading ? "Uploading…" : "Upload File"}
            </button>
          </form>

          {uploadMsg && (
            <div
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: 6,
                fontSize: 13,
                background:
                  uploadMsg.type === "success" ? "#ecfdf3" : "#fef2f2",
                color: uploadMsg.type === "success" ? "#166534" : "#b91c1c",
                border:
                  uploadMsg.type === "success"
                    ? "1px solid #bbf7d0"
                    : "1px solid #fecaca",
              }}
            >
              {uploadMsg.text}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
