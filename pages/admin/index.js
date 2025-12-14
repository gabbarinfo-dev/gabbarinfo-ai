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
  const [memoryType, setMemoryType] = useState("global"); // "global" | "client"
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [saveFile, setSaveFile] = useState("yes"); // "yes" | "no"

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState(null);

  // ---------------- MEMORY LIST STATES ----------------
  const [memoryList, setMemoryList] = useState([]);
  const [loadingMemory, setLoadingMemory] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [totalItems, setTotalItems] = useState(0);

  // ---------------- LOAD CLIENT LIST ----------------
  useEffect(() => {
    async function loadClients() {
      try {
        const res = await fetch("/api/admin/list-users");
        const data = await res.json();
        if (data.success) {
          setClients(data.users.filter((u) => u.role === "client"));
        }
      } catch (err) {
        console.error("Load clients error", err);
      }
    }
    loadClients();
  }, []);

  // ---------------- LOAD MEMORY LIST ----------------
  async function loadMemory(p = 1) {
    setLoadingMemory(true);
    try {
      const res = await fetch(`/api/rag/list-memory?page=${p}&page_size=${PAGE_SIZE}`);
      const data = await res.json();
      if (data.success) {
        setMemoryList(data.items || []);
        setTotalItems(data.total || 0);
        setPage(p);
      } else {
        setMemoryList([]);
      }
    } catch (err) {
      console.error("Load memory error", err);
      setMemoryList([]);
    } finally {
      setLoadingMemory(false);
    }
  }

  useEffect(() => {
    loadMemory(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        setMessage({ type: "error", text: data.error || "Failed" });
      } else {
        setMessage({ type: "success", text: data.message || "Saved" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Unexpected error" });
    } finally {
      setLoading(false);
    }
  }

  // ---------------- DELETE MEMORY HANDLER ----------------
  async function deleteMemory(id) {
    const confirmDelete = confirm("Are you sure you want to delete this memory?");
    if (!confirmDelete) return;

    try {
      const res = await fetch("/api/rag/delete-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const data = await res.json();
      if (data.success) {
        alert("Memory deleted.");
        loadMemory(page);
      } else {
        alert("Delete failed: " + (data.error || data.message || ""));
      }
    } catch (err) {
      alert("Delete failed.");
      console.error(err);
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
    setUploadMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("memory_type", memoryType);
      formData.append("client_email", selectedClient || "");
      formData.append("save_file", saveFile);

      const res = await fetch("/api/rag/upload-file", {
        method: "POST",
        body: formData,
      });

      setProgress(80);
      const data = await res.json();
      setProgress(100);
      setTimeout(() => setUploading(false), 800);

      setUploadMessage({
        type: data.ok ? "success" : "error",
        text: data.message || (data.error && JSON.stringify(data.error)) || "Unknown response",
      });

      // refresh memory list
      loadMemory(1);
    } catch (err) {
      console.error("Upload error", err);
      setUploadMessage({ type: "error", text: "Server error." });
      setUploading(false);
      setProgress(0);
    }
  }

  // ---------------- Pagination helpers ----------------
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  function prevPage() {
    if (page > 1) loadMemory(page - 1);
  }
  function nextPage() {
    if (page < totalPages) loadMemory(page + 1);
  }

  // ====================================================
  //                    UI STARTS HERE
  // ====================================================

  return (
    <div style={{ padding: 32 }}>
      {/* HEADER */}
      <header style={{ marginBottom: 24 }}>
        <h1>GabbarInfo AI — Admin</h1>
        <div style={{ fontSize: 13, color: "#555" }}>
          Logged in as {session.user?.email} (Owner)
        </div>
      </header>

      {/* ---------------- USER FORM ---------------- */}
      <section style={{ marginBottom: 40 }}>
        <h2>Add / Update User</h2>

        <form onSubmit={handleSubmit}>
          <label>Email</label>
          <input
            type="email"
            style={{ width: "100%", marginBottom: 12, padding: 8 }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="client@example.com"
          />

          <label>Role</label>
          <select
            style={{ width: "100%", marginBottom: 12, padding: 8 }}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="client">Client</option>
            <option value="owner">Owner</option>
          </select>

          <label>Credits to add</label>
          <input
            type="number"
            style={{ width: "100%", marginBottom: 12, padding: 8 }}
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
          />

          <button type="submit" disabled={loading} style={{ padding: "10px 16px" }}>
            {loading ? "Saving…" : "Save user & credits"}
          </button>
        </form>

        {message && (
          <div style={{ marginTop: 12, color: message.type === "success" ? "green" : "red" }}>
            {message.text}
          </div>
        )}
      </section>

      {/* ---------------- FILE UPLOAD SECTION ---------------- */}
      <section
        style={{
          padding: 24,
          border: "1px solid #ddd",
          borderRadius: 12,
          background: "#fff",
          maxWidth: 700,
          marginBottom: 40,
        }}
      >
        <h2>Upload Knowledge Files</h2>

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: "block", marginBottom: 6 }}>Choose File</label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files[0])}
            style={{ marginBottom: 12 }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 6 }}>Memory Type</label>
          <select
            value={memoryType}
            onChange={(e) => setMemoryType(e.target.value)}
            style={{ width: "100%", padding: 8 }}
          >
            <option value="global">Global Memory</option>
            <option value="client">Client Memory</option>
          </select>
        </div>

        {memoryType === "client" && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", marginBottom: 6 }}>Select Client Email</label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              style={{ width: "100%", padding: 8 }}
            >
              <option value="">-- Select Client --</option>
              {clients.map((c) => (
                <option key={c.email} value={c.email}>
                  {c.email}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 6 }}>Save physical file?</label>
          <select
            value={saveFile}
            onChange={(e) => setSaveFile(e.target.value)}
            style={{ width: "100%", padding: 8 }}
          >
            <option value="yes">Yes — Save File</option>
            <option value="no">No — Only Extract + Embed</option>
          </select>
        </div>

        {uploading && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                width: "100%",
                height: 10,
                background: "#eee",
                borderRadius: 6,
                overflow: "hidden",
                marginBottom: 8,
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
            <div style={{ fontSize: 13, color: "#333" }}>Uploading…</div>
          </div>
        )}

        {uploadMessage && (
          <div
            style={{
              padding: 12,
              marginBottom: 16,
              borderRadius: 6,
              background: uploadMessage.type === "success" ? "#ecfdf3" : "#fef2f2",
              color: uploadMessage.type === "success" ? "#166534" : "#b91c1c",
              border: uploadMessage.type === "success" ? "1px solid #bbf7d0" : "1px solid #fecaca",
            }}
          >
            {uploadMessage.text}
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

      {/* ---------------- MEMORY LIST SECTION ---------------- */}
      <section
        style={{
          padding: 24,
          border: "1px solid #ddd",
          borderRadius: 12,
          background: "#fff",
          maxWidth: 1100,
        }}
      >
        <h2>Manage Memory</h2>

        {loadingMemory ? (
          <p>Loading memory…</p>
        ) : (
          <>
            <table style={{ width: "100%", marginTop: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
                  <th style={{ padding: 8 }}>Type</th>
                  <th style={{ padding: 8 }}>Title</th>
                  <th style={{ padding: 8 }}>Client</th>
                  <th style={{ padding: 8 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {memoryList.map((item) => (
                  <tr key={`${item.table}-${item.id}`} style={{ borderBottom: "1px solid #fafafa" }}>
                    <td style={{ padding: 10 }}>
                      {item.type === "pdf" ? "PDF" : item.type === "docx" ? "DOCX" : "IMAGE"}
                    </td>
                    <td style={{ padding: 10 }}>{item.title}</td>
                    <td style={{ padding: 10 }}>{item.client_email || "GLOBAL"}</td>
                    <td style={{ padding: 10 }}>
                      <button
                        onClick={() => deleteMemory(item.id)}
                        style={{
                          padding: "6px 10px",
                          background: "#fee2e2",
                          border: "1px solid #fecaca",
                          borderRadius: 6,
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}

                {memoryList.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: 12, textAlign: "center" }}>
                      No memory uploaded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Pagination controls */}
            <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={prevPage} disabled={page === 1} style={{ padding: "6px 10px" }}>
                Prev
              </button>
              <div style={{ fontSize: 13 }}>
                Page {page} of {totalPages} — total {totalItems}
              </div>
              <button onClick={nextPage} disabled={page === totalPages} style={{ padding: "6px 10px" }}>
                Next
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
