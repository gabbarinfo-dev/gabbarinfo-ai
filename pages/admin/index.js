// pages/admin/index.js
"use client";

import { useState, useEffect } from "react";
import { useSession, signOut, signIn } from "next-auth/react";
import Head from "next/head";

const ALL_SERVICES = [
  { key: "SEO", label: "SEO Blog", icon: "📝" },
  { key: "SOCIAL", label: "Social Media", icon: "📱" },
  { key: "SOCIAL_PLANNER", label: "Planner 30D", icon: "📅" },
  { key: "META_ADS", label: "Meta Ads", icon: "🎯" },
  { key: "GOOGLE_ADS", label: "Google Ads", icon: "📈" },
  { key: "IMAGE_GENERATION", label: "AI Images", icon: "🎨" },
  { key: "AI_CHAT", label: "AI Chat", icon: "💬" },
];

export default function AdminPage() {
  const { data: session, status } = useSession();

  // ---------------- TAB STATE ----------------
  const [activeTab, setActiveTab] = useState("tenants"); // "tenants" | "quick-user" | "knowledge"

  // ---------------- TENANT MANAGEMENT STATES ----------------
  const [tenants, setTenants] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [tenantSearch, setTenantSearch] = useState("");
  const [tenantActionMessage, setTenantActionMessage] = useState(null);

  // Credit adjustment modal/state
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [creditAmount, setCreditAmount] = useState(500);
  const [creditMode, setCreditMode] = useState("add"); // "add" | "set"
  const [adjustingCredits, setAdjustingCredits] = useState(false);

  // ---------------- USER FORM STATES (QUICK PROVISION) ----------------
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("client");
  const [credits, setCredits] = useState(500);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // ---------------- FILE UPLOAD STATES (RAG) ----------------
  const [file, setFile] = useState(null);
  const [memoryType, setMemoryType] = useState("global"); // "global" | "client"
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [saveFile, setSaveFile] = useState("yes"); // "yes" | "no"
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState(null);

  // ---------------- MEMORY LIST STATES (RAG) ----------------
  const [memoryList, setMemoryList] = useState([]);
  const [loadingMemory, setLoadingMemory] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [totalItems, setTotalItems] = useState(0);

  const isOwner =
    session?.user?.role === "owner" ||
    session?.user?.email?.toLowerCase() === "ndantare@gmail.com";

  // ---------------- LOAD TENANTS ----------------
  async function loadTenants() {
    setLoadingTenants(true);
    try {
      const res = await fetch("/api/admin/manage-tenant?action=list_tenants");
      const data = await res.json();
      if (data.success) {
        setTenants(data.tenants || []);
      }
    } catch (err) {
      console.error("Load tenants error:", err);
    } finally {
      setLoadingTenants(false);
    }
  }

  // ---------------- LOAD CLIENT LIST & MEMORY ----------------
  useEffect(() => {
    if (isOwner) {
      loadTenants();

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
      loadMemory(1);
    }
  }, [isOwner]);

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

  // ---------------- SERVICE TOGGLE HANDLER ----------------
  async function handleToggleService(userEmail, serviceKey, currentEnabled) {
    try {
      const res = await fetch("/api/admin/manage-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_service",
          userEmail,
          serviceKey,
          enabled: !currentEnabled,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTenants((prev) =>
          prev.map((t) => {
            if (t.email?.toLowerCase() !== userEmail.toLowerCase()) return t;
            return {
              ...t,
              businesses: t.businesses.map((b) => ({
                ...b,
                features: data.features,
              })),
            };
          })
        );
        setTenantActionMessage({
          type: "success",
          text: `Updated ${serviceKey} for ${userEmail}: ${!currentEnabled ? "ENABLED" : "REVOKED"}.`,
        });
        setTimeout(() => setTenantActionMessage(null), 3000);
      } else {
        alert(data.error || "Failed to toggle service.");
      }
    } catch (err) {
      console.error("Toggle service error:", err);
      alert("Failed to toggle service.");
    }
  }

  // ---------------- SUSPENSION TOGGLE HANDLER ----------------
  async function handleToggleSuspension(userEmail, currentSuspended) {
    const actionName = currentSuspended ? "Reactivate" : "FREEZE / SUSPEND";
    if (!confirm(`Are you sure you want to ${actionName} account ${userEmail}?`)) return;

    try {
      const res = await fetch("/api/admin/manage-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_suspension",
          userEmail,
          isSuspended: !currentSuspended,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await loadTenants();
        setTenantActionMessage({
          type: "success",
          text: `Account ${userEmail} status updated to ${!currentSuspended ? "Suspended" : "Active"}.`,
        });
        setTimeout(() => setTenantActionMessage(null), 3000);
      } else {
        alert(data.error || "Failed to update suspension status.");
      }
    } catch (err) {
      console.error("Suspension toggle error:", err);
      alert("Failed to update suspension status.");
    }
  }

  // ---------------- BUSINESS LIMIT HANDLER ----------------
  async function handleUpdateBusinessLimit(userEmail, currentLimit) {
    const promptVal = prompt(`Enter max allowed businesses for ${userEmail}:`, currentLimit || 1);
    if (!promptVal) return;
    const newLimit = parseInt(promptVal, 10);
    if (isNaN(newLimit) || newLimit < 1) {
      alert("Please enter a valid number (>= 1)");
      return;
    }

    try {
      const res = await fetch("/api/admin/manage-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_business_limit",
          userEmail,
          maxBusinesses: newLimit,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTenants((prev) =>
          prev.map((t) => (t.email === userEmail ? { ...t, maxBusinesses: newLimit } : t))
        );
        setTenantActionMessage({
          type: "success",
          text: `Business limit for ${userEmail} set to ${newLimit}.`,
        });
        setTimeout(() => setTenantActionMessage(null), 3000);
      }
    } catch (err) {
      console.error("Business limit error:", err);
      alert("Failed to update business limit.");
    }
  }

  // ---------------- SAVE CREDITS HANDLER ----------------
  async function handleAdjustCredits(e) {
    e.preventDefault();
    if (!selectedTenant) return;
    setAdjustingCredits(true);

    try {
      const res = await fetch("/api/admin/manage-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_credits",
          userEmail: selectedTenant.email,
          businessId: selectedTenant.businesses?.[0]?.id,
          mode: creditMode,
          amount: Number(creditAmount) || 0,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTenants((prev) =>
          prev.map((t) =>
            t.email === selectedTenant.email ? { ...t, credits: data.newBalance } : t
          )
        );
        setTenantActionMessage({
          type: "success",
          text: `Credits for ${selectedTenant.email} updated to ${data.newBalance}.`,
        });
        setSelectedTenant(null);
        setTimeout(() => setTenantActionMessage(null), 3000);
      } else {
        alert(data.error || "Failed to update credits");
      }
    } catch (err) {
      console.error("Adjust credits error:", err);
      alert("Server error adjusting credits.");
    } finally {
      setAdjustingCredits(false);
    }
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
        setMessage({ type: "success", text: data.message || "User provisioned successfully!" });
        setEmail("");
        loadTenants();
      }
    } catch (err) {
      setMessage({ type: "error", text: "Unexpected error" });
    } finally {
      setLoading(false);
    }
  }

  // ---------------- DELETE MEMORY HANDLER ----------------
  async function deleteMemory(id) {
    const confirmDelete = confirm("Are you sure you want to delete this memory entry?");
    if (!confirmDelete) return;

    try {
      const res = await fetch("/api/rag/delete-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const data = await res.json();
      if (data.success) {
        setTenantActionMessage({ type: "success", text: "Memory deleted." });
        setTimeout(() => setTenantActionMessage(null), 3000);
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

      loadMemory(1);
    } catch (err) {
      console.error("Upload error", err);
      setUploadMessage({ type: "error", text: "Server error during upload." });
      setUploading(false);
      setProgress(0);
    }
  }

  // Pagination helpers
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  function prevPage() {
    if (page > 1) loadMemory(page - 1);
  }
  function nextPage() {
    if (page < totalPages) loadMemory(page + 1);
  }

  // ---------------- AUTH PROTECTION ----------------
  if (status === "loading") {
    return (
      <div className="admin-shell loading-shell">
        <div className="loading-spinner"></div>
        <p>Verifying Super Admin credentials...</p>
        <style jsx>{`
          .admin-shell {
            min-height: 100vh;
            background: #080b11;
            color: #f8fafc;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-family: 'Plus Jakarta Sans', sans-serif;
          }
          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(255,255,255,0.1);
            border-top: 3px solid #3b82f6;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 16px;
          }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="admin-shell center-card-shell">
        <Head><title>Admin Authentication · GabbarInfo AI</title></Head>
        <div className="auth-card">
          <div className="auth-badge">SECURITY GATEWAY</div>
          <h1 className="auth-title">Super Admin Portal</h1>
          <p className="auth-desc">Authenticate with authorized owner account to access system governance.</p>
          <button onClick={() => signIn("google")} className="btn-gabbar-primary auth-btn">
            Authenticate with Google
          </button>
        </div>
        <style jsx>{`
          .admin-shell {
            min-height: 100vh;
            background: #080b11;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .auth-card {
            background: #0f172a;
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 16px;
            padding: 40px;
            max-width: 440px;
            width: 100%;
            text-align: center;
            box-shadow: 0 20px 50px rgba(0,0,0,0.6);
          }
          .auth-badge {
            display: inline-block;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.1em;
            color: #38bdf8;
            background: rgba(56, 189, 248, 0.1);
            border: 1px solid rgba(56, 189, 248, 0.25);
            padding: 4px 12px;
            border-radius: 999px;
            margin-bottom: 16px;
          }
          .auth-title {
            font-size: 24px;
            font-weight: 700;
            color: #f8fafc;
            margin: 0 0 8px 0;
          }
          .auth-desc {
            font-size: 14px;
            color: #94a3b8;
            margin: 0 0 24px 0;
            line-height: 1.5;
          }
          .auth-btn {
            width: 100%;
            padding: 12px 20px;
          }
        `}</style>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="admin-shell center-card-shell">
        <Head><title>Access Prohibited · GabbarInfo AI</title></Head>
        <div className="auth-card">
          <div className="auth-badge error-badge">ACCESS PROHIBITED</div>
          <h1 className="auth-title">Permission Denied</h1>
          <p className="auth-desc">Account <b>{session.user?.email}</b> does not have Super Admin authority.</p>
          <button onClick={() => signOut()} className="btn-gabbar-secondary auth-btn">
            Sign out & Switch Account
          </button>
        </div>
        <style jsx>{`
          .admin-shell {
            min-height: 100vh;
            background: #080b11;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .auth-card {
            background: #0f172a;
            border: 1px solid rgba(239, 68, 68, 0.3);
            border-radius: 16px;
            padding: 40px;
            max-width: 440px;
            width: 100%;
            text-align: center;
          }
          .error-badge {
            color: #f87171 !important;
            background: rgba(239, 68, 68, 0.1) !important;
            border-color: rgba(239, 68, 68, 0.3) !important;
          }
          .auth-title { font-size: 24px; font-weight: 700; color: #f8fafc; margin-bottom: 8px; }
          .auth-desc { font-size: 14px; color: #94a3b8; margin-bottom: 24px; line-height: 1.5; }
          .auth-btn { width: 100%; padding: 12px; }
        `}</style>
      </div>
    );
  }

  const filteredTenants = tenants.filter((t) => {
    const q = tenantSearch.toLowerCase();
    const matchEmail = t.email?.toLowerCase().includes(q);
    const matchBiz = t.businesses?.some((b) => b.name?.toLowerCase().includes(q));
    return matchEmail || matchBiz;
  });

  const totalCreditsCirculation = tenants.reduce((acc, t) => acc + (t.credits || 0), 0);
  const activeTenantsCount = tenants.filter((t) => !t.isSuspended).length;

  return (
    <div className="admin-container">
      <Head>
        <title>Super Admin Master Control · GabbarInfo AI</title>
      </Head>

      {/* TOP HEADER */}
      <header className="admin-header">
        <div className="header-left">
          <div className="brand-row">
            <span className="live-radar-dot"></span>
            <span className="brand-tag">GABBARINFO AI ENTERPRISE</span>
            <span className="owner-tag">SUPER ADMIN SYSTEM</span>
          </div>
          <h1 className="header-title">Master Control & Tenancy Governance</h1>
          <p className="header-subtitle">
            Owner: <span className="highlight-text">{session.user?.email}</span> • Zero Credit Deductions • Universal Multi-Tenant Access
          </p>
        </div>

        <div className="header-actions">
          <a href="/" className="btn-gabbar-secondary return-link">
            ← Live Workspace
          </a>
          <button onClick={() => signOut()} className="btn-gabbar-secondary signout-btn">
            Sign out
          </button>
        </div>
      </header>

      {/* METRICS OVERVIEW CARDS */}
      <section className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Registered Tenants</span>
            <span className="metric-icon">👥</span>
          </div>
          <div className="metric-value">{tenants.length}</div>
          <div className="metric-sub">Active agencies & client accounts</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Operational Workspaces</span>
            <span className="metric-icon">🏢</span>
          </div>
          <div className="metric-value text-emerald">{activeTenantsCount}</div>
          <div className="metric-sub">Unrestricted active production workspaces</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Circulating Credits</span>
            <span className="metric-icon">⚡</span>
          </div>
          <div className="metric-value text-blue">{totalCreditsCirculation.toLocaleString()}</div>
          <div className="metric-sub">Total balance held across all tenant wallets</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Super Admin Quota</span>
            <span className="metric-icon">♾️</span>
          </div>
          <div className="metric-value text-purple">Unlimited</div>
          <div className="metric-sub">Bypass credit meter & rate limiters</div>
        </div>
      </section>

      {/* NAVIGATION TABS */}
      <nav className="tabs-nav">
        <button
          onClick={() => setActiveTab("tenants")}
          className={`tab-btn ${activeTab === "tenants" ? "tab-active" : ""}`}
        >
          🏢 Tenant Service Switchboard ({tenants.length})
        </button>
        <button
          onClick={() => setActiveTab("quick-user")}
          className={`tab-btn ${activeTab === "quick-user" ? "tab-active" : ""}`}
        >
          ➕ Provision Client / Business
        </button>
        <button
          onClick={() => setActiveTab("knowledge")}
          className={`tab-btn ${activeTab === "knowledge" ? "tab-active" : ""}`}
        >
          🧠 Global RAG & Knowledge ({totalItems})
        </button>
      </nav>

      {/* FLASH ACTION NOTIFICATION */}
      {tenantActionMessage && (
        <div className={`toast-banner ${tenantActionMessage.type}`}>
          <span className="toast-icon">✓</span>
          <span>{tenantActionMessage.text}</span>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 1: TENANT SERVICE CONTROL SWITCHBOARD            */}
      {/* ==================================================== */}
      {activeTab === "tenants" && (
        <section className="tab-pane">
          <div className="pane-toolbar">
            <div className="search-wrap">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search tenant email, workspace name, or agency..."
                value={tenantSearch}
                onChange={(e) => setTenantSearch(e.target.value)}
                className="dark-input search-input"
              />
              {tenantSearch && (
                <button onClick={() => setTenantSearch("")} className="clear-btn">✕</button>
              )}
            </div>

            <button
              onClick={loadTenants}
              disabled={loadingTenants}
              className="btn-gabbar-secondary refresh-btn"
            >
              {loadingTenants ? "Refreshing..." : "🔄 Refresh Tenants"}
            </button>
          </div>

          <div className="table-responsive">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Tenant / Account</th>
                  <th>Workspace Details</th>
                  <th>Credits Balance</th>
                  <th>Granular Service Switchboard</th>
                  <th>Max Workspaces</th>
                  <th>Account Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      {loadingTenants ? "Scanning tenant database..." : "No matching tenants found."}
                    </td>
                  </tr>
                ) : (
                  filteredTenants.map((t) => {
                    const primaryBiz = t.businesses?.[0] || {};
                    const isSuspended = t.isSuspended || primaryBiz.status === "suspended";
                    const isSelfAdmin = t.email?.toLowerCase() === "ndantare@gmail.com";

                    return (
                      <tr key={t.email} className={isSuspended ? "row-suspended" : ""}>
                        {/* User Email & Role */}
                        <td>
                          <div className="tenant-email">{t.email}</div>
                          <div className="badge-row">
                            <span className={`role-pill ${isSelfAdmin ? "role-admin" : "role-client"}`}>
                              {isSelfAdmin ? "SUPER ADMIN" : (t.role || "client").toUpperCase()}
                            </span>
                            {isSuspended && (
                              <span className="role-pill role-frozen">SUSPENDED</span>
                            )}
                          </div>
                        </td>

                        {/* Business Workspace */}
                        <td>
                          <div className="workspace-name">
                            {primaryBiz.name || "Default Business"}
                          </div>
                          <div className="workspace-id">
                            ID: {primaryBiz.id ? `${primaryBiz.id.slice(0, 16)}...` : "System-Assigned"}
                          </div>
                        </td>

                        {/* Credit Balance & Manage */}
                        <td>
                          {isSelfAdmin ? (
                            <div className="unlimited-pill">
                              <span>♾️</span> Unlimited
                            </div>
                          ) : (
                            <div className="credit-cell">
                              <span className={`credit-val ${t.credits > 100 ? "val-green" : t.credits > 0 ? "val-amber" : "val-red"}`}>
                                {t.credits ?? 0}
                              </span>
                              <button
                                onClick={() => {
                                  setSelectedTenant(t);
                                  setCreditAmount(500);
                                  setCreditMode("add");
                                }}
                                className="adjust-btn"
                                title="Adjust credit balance"
                              >
                                ⚡ Adjust
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Granular Service Switchboard */}
                        <td>
                          <div className="switch-grid">
                            {ALL_SERVICES.map((s) => {
                              const isEnabled = (primaryBiz.features || []).includes(s.key);
                              return (
                                <button
                                  key={s.key}
                                  onClick={() =>
                                    handleToggleService(t.email, s.key, isEnabled)
                                  }
                                  className={`service-toggle ${isEnabled ? "toggle-active" : "toggle-disabled"}`}
                                  title={`Click to ${isEnabled ? "Revoke" : "Grant"} access to ${s.label}`}
                                >
                                  <span className="toggle-indicator"></span>
                                  <span className="toggle-label">{s.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </td>

                        {/* Max Business Limit */}
                        <td>
                          <button
                            onClick={() => handleUpdateBusinessLimit(t.email, t.maxBusinesses)}
                            className="limit-badge"
                            title="Click to change max businesses allowed"
                          >
                            <span>🏢</span> {t.maxBusinesses || 1} limit ✎
                          </button>
                        </td>

                        {/* Status & Emergency Killswitch */}
                        <td>
                          {isSelfAdmin ? (
                            <span className="master-badge">🛡️ IMMUTABLE</span>
                          ) : (
                            <button
                              onClick={() =>
                                handleToggleSuspension(t.email, isSuspended)
                              }
                              className={`freeze-btn ${isSuspended ? "btn-reactivate" : "btn-freeze"}`}
                            >
                              {isSuspended ? "✓ Reactivate" : "⛔ Freeze"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* CREDIT ADJUSTMENT MODAL */}
          {selectedTenant && (
            <div className="modal-backdrop">
              <div className="modal-box">
                <div className="modal-header">
                  <h3>Adjust Tenant Credits</h3>
                  <button onClick={() => setSelectedTenant(null)} className="close-x">✕</button>
                </div>
                <div className="modal-body">
                  <p className="target-tenant-info">
                    Target: <b>{selectedTenant.email}</b>
                    <br />
                    Current Balance: <span className="text-emerald font-bold">{selectedTenant.credits} credits</span>
                  </p>

                  <form onSubmit={handleAdjustCredits}>
                    <div className="field-group">
                      <label>Adjustment Mode</label>
                      <select
                        value={creditMode}
                        onChange={(e) => setCreditMode(e.target.value)}
                        className="dark-input"
                      >
                        <option value="add">Add credits to current balance (+)</option>
                        <option value="set">Set exact credit balance</option>
                      </select>
                    </div>

                    <div className="field-group">
                      <label>Amount of Credits</label>
                      <input
                        type="number"
                        value={creditAmount}
                        onChange={(e) => setCreditAmount(e.target.value)}
                        className="dark-input"
                        min="0"
                        placeholder="e.g. 500"
                        required
                      />
                    </div>

                    <div className="modal-actions">
                      <button
                        type="button"
                        onClick={() => setSelectedTenant(null)}
                        className="btn-gabbar-secondary"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={adjustingCredits}
                        className="btn-gabbar-primary"
                      >
                        {adjustingCredits ? "Updating..." : "Confirm & Save Balance"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ==================================================== */}
      {/* TAB 2: PROVISION USER WORKSPACE                      */}
      {/* ==================================================== */}
      {activeTab === "quick-user" && (
        <section className="tab-pane">
          <div className="form-card">
            <h2 className="card-title">Provision New Client / Business</h2>
            <p className="card-subtitle">
              Authorize an email address into the system with role classification and initial fuel credits.
            </p>

            <form onSubmit={handleSubmit} className="provision-form">
              <div className="field-group">
                <label>User Google Account Email</label>
                <input
                  type="email"
                  className="dark-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="client@agency.com"
                  required
                />
              </div>

              <div className="field-grid">
                <div className="field-group">
                  <label>Access Tier / Role</label>
                  <select
                    className="dark-input"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="client">Client (Metered Services)</option>
                    <option value="owner">Platform Owner (Unrestricted)</option>
                  </select>
                </div>

                <div className="field-group">
                  <label>Initial Credit Grant</label>
                  <input
                    type="number"
                    className="dark-input"
                    value={credits}
                    onChange={(e) => setCredits(e.target.value)}
                    min="0"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-gabbar-primary submit-btn"
              >
                {loading ? "Provisioning Access..." : "⚡ Provision User & Grant Credits"}
              </button>
            </form>

            {message && (
              <div className={`form-feedback ${message.type}`}>
                {message.type === "success" ? "✓" : "⚠"} {message.text}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ==================================================== */}
      {/* TAB 3: KNOWLEDGE BASE (GLOBAL RAG)                   */}
      {/* ==================================================== */}
      {activeTab === "knowledge" && (
        <section className="tab-pane">
          <div className="knowledge-grid">
            {/* UPLOAD FORM */}
            <div className="form-card">
              <h2 className="card-title">Upload RAG Intelligence File</h2>
              <p className="card-subtitle">
                Upload brand documents, product sheets, or client briefs for vector retrieval.
              </p>

              <div className="upload-form">
                <div className="field-group">
                  <label>Document File (PDF, DOCX, TXT, CSV)</label>
                  <input
                    type="file"
                    onChange={(e) => setFile(e.target.files[0])}
                    className="file-input-dark"
                  />
                </div>

                <div className="field-group">
                  <label>Target Memory Scope</label>
                  <select
                    value={memoryType}
                    onChange={(e) => setMemoryType(e.target.value)}
                    className="dark-input"
                  >
                    <option value="global">Global Memory (All platform tenants)</option>
                    <option value="client">Client Isolated Memory</option>
                  </select>
                </div>

                {memoryType === "client" && (
                  <div className="field-group">
                    <label>Assign to Client Account</label>
                    <select
                      value={selectedClient}
                      onChange={(e) => setSelectedClient(e.target.value)}
                      className="dark-input"
                    >
                      <option value="">-- Choose Client Email --</option>
                      {clients.map((c) => (
                        <option key={c.email} value={c.email}>
                          {c.email}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="field-group">
                  <label>Persistent Storage</label>
                  <select
                    value={saveFile}
                    onChange={(e) => setSaveFile(e.target.value)}
                    className="dark-input"
                  >
                    <option value="yes">Yes — Retain physical file in storage</option>
                    <option value="no">No — Extract embeddings only</option>
                  </select>
                </div>

                {uploading && (
                  <div className="progress-container">
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                    </div>
                    <span className="progress-label">Vectorizing chunks: {progress}%</span>
                  </div>
                )}

                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="btn-gabbar-primary upload-btn"
                >
                  {uploading ? "Extracting & Indexing..." : "⚡ Vectorize & Save to RAG"}
                </button>

                {uploadMessage && (
                  <div className={`form-feedback ${uploadMessage.type}`}>
                    {uploadMessage.type === "success" ? "✓" : "⚠"} {uploadMessage.text}
                  </div>
                )}
              </div>
            </div>

            {/* MEMORY ITEMS */}
            <div className="form-card memory-list-card">
              <h2 className="card-title">Indexed Knowledge Chunks ({totalItems})</h2>
              <p className="card-subtitle">Active documents available in vector memory.</p>

              {loadingMemory ? (
                <div className="loading-state">Loading indexed memories...</div>
              ) : memoryList.length === 0 ? (
                <div className="empty-state">No knowledge memories uploaded yet.</div>
              ) : (
                <div className="memory-cards-container">
                  {memoryList.map((m) => (
                    <div key={m.id} className="memory-item">
                      <div className="memory-item-content">
                        <div className="memory-title">
                          📄 {m.filename || m.title || "Untitled Knowledge Document"}
                        </div>
                        <div className="memory-meta">
                          <span className="scope-tag">{m.memory_type}</span>
                          {m.email && <span className="user-tag">{m.email}</span>}
                          <span className="date-tag">
                            {new Date(m.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteMemory(m.id)}
                        className="delete-mem-btn"
                        title="Delete from vector memory"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  ))}

                  <div className="pagination-bar">
                    <button
                      onClick={prevPage}
                      disabled={page <= 1}
                      className="page-btn"
                    >
                      ← Prev
                    </button>
                    <span className="page-indicator">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={nextPage}
                      disabled={page >= totalPages}
                      className="page-btn"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* LUXURY ENTERPRISE DARK STYLING */}
      <style jsx>{`
        .admin-container {
          min-height: 100vh;
          background: #080b11;
          color: #f8fafc;
          padding: 32px;
          font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        /* Top Header */
        .admin-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding-bottom: 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          margin-bottom: 28px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .brand-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .live-radar-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 10px #10b981;
          animation: radarPulse 2s infinite;
        }

        .brand-tag {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.1em;
          color: #38bdf8;
        }

        .owner-tag {
          font-size: 10px;
          font-weight: 700;
          background: rgba(168, 85, 247, 0.15);
          color: #c084fc;
          padding: 2px 8px;
          border-radius: 4px;
          border: 1px solid rgba(168, 85, 247, 0.3);
        }

        .header-title {
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #ffffff;
          margin: 0 0 6px 0;
        }

        .header-subtitle {
          font-size: 13px;
          color: #94a3b8;
          margin: 0;
        }

        .highlight-text {
          color: #38bdf8;
          font-weight: 600;
        }

        .header-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .return-link,
        .signout-btn {
          padding: 9px 16px !important;
          font-size: 13px !important;
        }

        /* Metrics */
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
          margin-bottom: 28px;
        }

        .metric-card {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 20px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          transition: transform 0.2s ease, border-color 0.2s ease;
        }

        .metric-card:hover {
          transform: translateY(-2px);
          border-color: rgba(255, 255, 255, 0.18);
        }

        .metric-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .metric-label {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #94a3b8;
        }

        .metric-icon {
          font-size: 16px;
        }

        .metric-value {
          font-size: 30px;
          font-weight: 800;
          color: #f8fafc;
          margin-bottom: 4px;
        }

        .metric-sub {
          font-size: 12px;
          color: #64748b;
        }

        .text-emerald { color: #34d399 !important; }
        .text-blue { color: #60a5fa !important; }
        .text-purple { color: #c084fc !important; }

        /* Tabs Nav */
        .tabs-nav {
          display: flex;
          gap: 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          margin-bottom: 24px;
          padding-bottom: 0;
          overflow-x: auto;
        }

        .tab-btn {
          padding: 12px 20px;
          font-size: 14px;
          font-weight: 600;
          color: #94a3b8;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .tab-btn:hover {
          color: #ffffff;
        }

        .tab-active {
          color: #38bdf8 !important;
          border-bottom: 2px solid #38bdf8 !important;
        }

        /* Toast Message */
        .toast-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 18px;
          border-radius: 10px;
          margin-bottom: 24px;
          font-size: 14px;
          font-weight: 600;
        }

        .toast-banner.success {
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #34d399;
        }

        /* Toolbar */
        .pane-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 18px;
          flex-wrap: wrap;
          gap: 12px;
        }

        .search-wrap {
          position: relative;
          width: 100%;
          max-width: 440px;
        }

        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 13px;
          color: #64748b;
        }

        .search-input {
          width: 100%;
          padding: 11px 36px 11px 38px !important;
        }

        .clear-btn {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #94a3b8;
          font-size: 12px;
          cursor: pointer;
        }

        .refresh-btn {
          padding: 10px 18px !important;
          font-size: 13px !important;
        }

        /* Table */
        .table-responsive {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          overflow-x: auto;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
        }

        .enterprise-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .enterprise-table th {
          background: #111b2e;
          padding: 14px 18px;
          font-size: 12px;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .enterprise-table td {
          padding: 16px 18px;
          vertical-align: middle;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          color: #e2e8f0;
          font-size: 13px;
        }

        .row-suspended {
          background: rgba(239, 68, 68, 0.06);
        }

        .tenant-email {
          font-weight: 600;
          color: #ffffff;
          font-size: 14px;
          margin-bottom: 4px;
        }

        .badge-row {
          display: flex;
          gap: 6px;
        }

        .role-pill {
          font-size: 10px;
          font-weight: 800;
          padding: 2px 7px;
          border-radius: 4px;
          letter-spacing: 0.03em;
        }

        .role-admin {
          background: rgba(168, 85, 247, 0.2);
          color: #d8b4fe;
          border: 1px solid rgba(168, 85, 247, 0.4);
        }

        .role-client {
          background: rgba(59, 130, 246, 0.15);
          color: #93c5fd;
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .role-frozen {
          background: rgba(239, 68, 68, 0.2);
          color: #fca5a5;
          border: 1px solid rgba(239, 68, 68, 0.4);
        }

        .workspace-name {
          font-weight: 600;
          color: #f1f5f9;
        }

        .workspace-id {
          font-size: 11px;
          color: #64748b;
          font-family: monospace;
          margin-top: 2px;
        }

        .unlimited-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #c084fc;
          font-weight: 700;
          font-size: 13px;
          background: rgba(192, 132, 252, 0.1);
          padding: 4px 10px;
          border-radius: 6px;
          border: 1px solid rgba(192, 132, 252, 0.25);
        }

        .credit-cell {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .credit-val {
          font-size: 16px;
          font-weight: 800;
        }

        .val-green { color: #34d399; }
        .val-amber { color: #fbbf24; }
        .val-red { color: #f87171; }

        .adjust-btn {
          background: #1e293b;
          color: #cbd5e1;
          border: 1px solid rgba(255, 255, 255, 0.12);
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .adjust-btn:hover {
          background: #334155;
          color: #ffffff;
          border-color: #38bdf8;
        }

        /* Switch Grid */
        .switch-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          max-width: 440px;
        }

        .service-toggle {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          border: 1px solid transparent;
        }

        .toggle-indicator {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .toggle-active {
          background: rgba(16, 185, 129, 0.15);
          border-color: rgba(16, 185, 129, 0.4);
          color: #34d399;
        }

        .toggle-active .toggle-indicator {
          background: #34d399;
          box-shadow: 0 0 6px #34d399;
        }

        .toggle-disabled {
          background: rgba(15, 23, 42, 0.6);
          border-color: rgba(255, 255, 255, 0.08);
          color: #64748b;
        }

        .toggle-disabled .toggle-indicator {
          background: #475569;
        }

        .service-toggle:hover {
          transform: translateY(-1px);
          filter: brightness(1.15);
        }

        .limit-badge {
          background: #1e293b;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #cbd5e1;
          padding: 5px 10px;
          font-size: 12px;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .limit-badge:hover {
          border-color: #38bdf8;
          color: #ffffff;
        }

        .master-badge {
          font-size: 11px;
          font-weight: 800;
          color: #94a3b8;
          letter-spacing: 0.05em;
        }

        .freeze-btn {
          font-size: 12px;
          font-weight: 700;
          padding: 6px 14px;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-freeze {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.4);
        }

        .btn-freeze:hover {
          background: #ef4444;
          color: #ffffff;
        }

        .btn-reactivate {
          background: rgba(16, 185, 129, 0.15);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.4);
        }

        .btn-reactivate:hover {
          background: #10b981;
          color: #ffffff;
        }

        .empty-state {
          text-align: center;
          padding: 40px;
          color: #64748b;
          font-size: 14px;
        }

        /* Forms & Inputs */
        .dark-input {
          background: #1e293b !important;
          color: #ffffff !important;
          border: 1px solid rgba(255, 255, 255, 0.12) !important;
          border-radius: 8px !important;
          padding: 10px 14px !important;
          font-size: 14px !important;
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
          width: 100%;
        }

        .dark-input:focus {
          border-color: #38bdf8 !important;
          box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2) !important;
        }

        .file-input-dark {
          background: #1e293b;
          color: #f8fafc;
          border: 1px dashed rgba(255, 255, 255, 0.2);
          padding: 12px;
          border-radius: 8px;
          width: 100%;
          cursor: pointer;
        }

        .form-card {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 28px;
          max-width: 600px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
        }

        .card-title {
          font-size: 20px;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 6px 0;
        }

        .card-subtitle {
          font-size: 13px;
          color: #94a3b8;
          margin: 0 0 22px 0;
          line-height: 1.5;
        }

        .field-group {
          margin-bottom: 18px;
        }

        .field-group label {
          display: block;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #94a3b8;
          margin-bottom: 6px;
        }

        .field-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .submit-btn,
        .upload-btn {
          width: 100%;
          padding: 12px !important;
          font-size: 14px !important;
          margin-top: 8px;
        }

        .form-feedback {
          margin-top: 16px;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
        }

        .form-feedback.success {
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #34d399;
        }

        .form-feedback.error {
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #f87171;
        }

        /* Knowledge Base Layout */
        .knowledge-grid {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 24px;
          align-items: start;
        }

        @media (max-width: 960px) {
          .knowledge-grid {
            grid-template-columns: 1fr;
          }
        }

        .memory-list-card {
          max-width: 100% !important;
        }

        .memory-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px;
          background: #111b2e;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          margin-bottom: 10px;
        }

        .memory-title {
          font-size: 14px;
          font-weight: 600;
          color: #ffffff;
          margin-bottom: 4px;
        }

        .memory-meta {
          display: flex;
          gap: 8px;
          font-size: 11px;
        }

        .scope-tag {
          color: #38bdf8;
          font-weight: 700;
        }

        .user-tag {
          color: #94a3b8;
        }

        .date-tag {
          color: #64748b;
        }

        .delete-mem-btn {
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #f87171;
          padding: 6px 12px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
        }

        .delete-mem-btn:hover {
          background: #ef4444;
          color: #ffffff;
        }

        .pagination-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 16px;
          padding-top: 14px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .page-btn {
          background: #1e293b;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #cbd5e1;
          padding: 6px 14px;
          border-radius: 6px;
          cursor: pointer;
        }

        .page-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .page-indicator {
          font-size: 12px;
          color: #94a3b8;
        }

        .progress-container {
          margin-bottom: 16px;
        }

        .progress-track {
          width: 100%;
          height: 6px;
          background: #1e293b;
          border-radius: 999px;
          overflow: hidden;
          margin-bottom: 4px;
        }

        .progress-fill {
          height: 100%;
          background: #38bdf8;
          transition: width 0.3s ease;
        }

        .progress-label {
          font-size: 11px;
          color: #94a3b8;
        }

        /* Modal */
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 99999;
          padding: 20px;
        }

        .modal-box {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 16px;
          padding: 24px;
          max-width: 440px;
          width: 100%;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .modal-header h3 {
          font-size: 18px;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
        }

        .close-x {
          background: none;
          border: none;
          color: #94a3b8;
          font-size: 16px;
          cursor: pointer;
        }

        .target-tenant-info {
          font-size: 13px;
          color: #94a3b8;
          margin-bottom: 18px;
          line-height: 1.6;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 24px;
        }
      `}</style>
    </div>
  );
}
