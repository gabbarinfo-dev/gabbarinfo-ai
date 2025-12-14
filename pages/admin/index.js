// pages/admin/index.js
"use client";

import { useState, useEffect } from "react";
import { useSession, signOut, signIn } from "next-auth/react";

export default function AdminPage() {
  const { data: session, status } = useSession();

  // ---------------- USER FORM STATES ----------------
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("client");
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // ---------------- FILE UPLOAD STATES ----------------
  const [file, setFile] = useState(null);
  const [memoryType, setMemoryType] = useState("global");
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [saveFile, setSaveFile] = useState("yes");

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // ---------------- LOAD CLIENT LIST ----------------
  useEffect(() => {
    async function loadClients() {
      const res = await fetch("/api/admin/list-users");
      const data = await res.json();
      if (data.success) {
        setClients(data.users.filter(u => u.role === "client"));
      }
    }
    loadClients();
  }, []);

  // ---------------- AUTH PROTECTION ----------------
  if (status === "loading") {
    return <div style={{ padding: 40 }}>Checking session…</div>;
  }

  if (!session) {
    return (
      <div style={{ padding: 40 }}>
        <h1>GabbarInfo AI — Admin</h1>
        <p>You must sign in as the owner.</p>
        <button onClick={() => signIn("google")}>Sign in with Google</button>
      </div>
    );
  }

  if (session.user?.role !== "owner") {
    return (
      <div style={{ padding: 40 }}>
        <h1>GabbarInfo AI — Admin</h1>
        <p>Access denied.</p>
        <button onClick={() => signOut()}>Sign out</button>
      </div>
    );
  }

  // ---------------- SAVE USER HANDLER ----------------
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
        setMessage({ type: "error", text: data.error });
      } else {
        setMessage({ type: "success", text: data.message });
      }
    } finally {
      setLoading(false);
    }
  }

  // ---------------- FILE UPLOAD HANDLER ----------------
  async function handleUpload() {
    if (!file) {
      alert("Please select a file.");
      return;
    }

    if (memoryType === "client" && !selectedClient) {
      alert("Select a client email.");
      return;
    }

    setUploading(true);
    setProgress(10);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("memory_type", memoryType);
    formData.append("client_email", selectedClient);
    formData.append("save_file", saveFile);

    const res = await fetch("/api/rag/upload-file", {
      method: "POST",
      body: formData,
    });

    setProgress(80);

    const data = await res.json();

    setProgress(100);
    setTimeout(() => setUploading(false), 1000);

    alert(data.message || "Upload complete.");
  }

  // ====================================================
  //                    UI STARTS HERE
  // ====================================================

  return (
    <div style={{ padding: 32 }}>
      {/* HEADER */}
      <header style={{ marginBottom: 24 }}>
        <h1>GabbarInfo AI — Admin</h1>
        <p>Logged in as {session.user?.email} (Owner)</p>
      </header>

      {/* ---------------- USER FORM ---------------- */}
      <section style={{ marginBottom: 40 }}>
        <h2>Add / Update User</h2>

        <form onSubmit={handleSubmit}>
          <label>Email</label>
          <input
            type="email"
            style={{ width: "100%", marginBottom: 12 }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label>Role</label>
          <select
            style={{ width: "100%", marginBottom: 12 }}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="client">Client</option>
            <option value="owner">Owner</option>
          </select>

          <label>Credits to add</label>
          <input
            type="number"
            style={{ width: "100%", marginBottom: 12 }}
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
          />

          <button type="submit" disabled={loading}>
            {loading ? "Saving…" : "Save user & credits"}
          </button>
        </form>

        {message && <p>{message.text}</p>}
      </section>

      {/* ---------------- FILE UPLOAD SECTION ---------------- */}
      <section
        style={{
          padding: 24,
          border: "1px solid #ddd",
          borderRadius: 12,
          background: "#fff",
          maxWidth: 600,
        }}
      >
        <h2>Upload Knowledge Files</h2>

        {/* file picker */}
        <label>Choose File</label>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files[0])}
          style={{ marginBottom: 16 }}
        />

        {/* memory type */}
        <label>Memory Type</label>
        <select
          value={memoryType}
          onChange={(e) => setMemoryType(e.target.value)}
          style={{ width: "100%", marginBottom: 16 }}
        >
          <option value="global">Global Memory</option>
          <option value="client">Client Memory</option>
        </select>

        {/* client dropdown */}
        {memoryType === "client" && (
          <>
            <label>Select Client Email</label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              style={{ width: "100%", marginBottom: 16 }}
            >
              <option value="">-- Select Client --</option>
              {clients.map((c) => (
                <option key={c.email} value={c.email}>
                  {c.email}
                </option>
              ))}
            </select>
          </>
        )}

        {/* save file ? */}
        <label>Save physical file into Supabase?</label>
        <select
          value={saveFile}
          onChange={(e) => setSaveFile(e.target.value)}
          style={{ width: "100%", marginBottom: 16 }}
        >
          <option value="yes">Yes — Save File</option>
          <option value="no">No — Only Extract & Embed</option>
        </select>

        {/* progress bar */}
        {uploading && (
          <div
            style={{
              width: "100%",
              height: 10,
              background: "#eee",
              borderRadius: 6,
              overflow: "hidden",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: "#2563eb",
                transition: "0.3s",
              }}
            ></div>
          </div>
        )}

        <button
          onClick={handleUpload}
          style={{ width: "100%", padding: 12 }}
          disabled={uploading}
        >
          {uploading ? "Uploading…" : "Upload File"}
        </button>
      </section>
    </div>
  );
}
