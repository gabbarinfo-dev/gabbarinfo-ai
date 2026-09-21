"use client";

import { useEffect, useState } from "react";

export default function WordPressSiteConnect({ onConnectionChange }) {
  const [businessName, setBusinessName] = useState("");
  const [customBusiness, setCustomBusiness] = useState("");
  const [connection, setConnection] = useState(null);
  const [allConnections, setAllConnections] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState(3); // Default to Step 3 for quick pairing
  const [siteUrlInput, setSiteUrlInput] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [newBizNameInput, setNewBizNameInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const activeBusiness = customBusiness.trim() || (businessName !== "custom" ? businessName : "");

  // Load existing connections
  useEffect(() => {
    fetchConnections();
  }, [activeBusiness]);

  useEffect(() => {
    const profiles = Object.keys(allConnections || {}).filter(k => allConnections[k]?.siteUrl);
    if (profiles.length > 0 && !businessName) {
      setBusinessName(profiles[0]);
    }
  }, [allConnections]);

  const fetchConnections = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/wordpress/sync?action=get-connection&businessName=${encodeURIComponent(activeBusiness || "")}`);
      const data = await res.json();
      if (data.ok) {
        setConnection(data.connection);
        setAllConnections(data.allConnections || {});
        if (onConnectionChange) {
          const hasAny = Boolean(data.connection?.siteUrl || Object.values(data.allConnections || {}).some(c => c?.siteUrl));
          onConnectionChange(hasAny);
        }
      }
    } catch (e) {
      console.error("Failed to fetch wp connection:", e);
    } finally {
      setLoading(false);
    }
  };

  const openNewSiteModal = () => {
    setErrorMsg("");
    setNewBizNameInput("");
    setSiteUrlInput("");
    setApiKeyInput("");
    setModalStep(3);
    setShowModal(true);
  };

  const handleTestConnection = async () => {
    if (!connection?.siteUrl) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/wordpress/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "health",
          siteUrl: connection.siteUrl,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestResult({ ok: true, message: `Connected! WordPress ${data.data?.site_name || ""} (v${data.data?.plugin_version}) is responding.` });
      } else {
        setTestResult({ ok: false, message: "Site responded with error: " + (data.error || "Unable to ping plugin") });
      }
    } catch (e) {
      setTestResult({ ok: false, message: "Connection test failed: " + e.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConnection = async () => {
    const biz = (newBizNameInput.trim() || customBusiness.trim() || (businessName !== "custom" && businessName !== "" ? businessName : "")).trim();
    if (!biz) {
      setErrorMsg("Please enter your business or website name.");
      return;
    }
    if (!siteUrlInput.trim() || !apiKeyInput.trim()) {
      setErrorMsg("Please enter both your Site URL and Plugin Secret Key.");
      return;
    }

    setConnecting(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/wordpress/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-connection",
          siteUrl: siteUrlInput.trim(),
          apiKey: apiKeyInput.trim(),
          businessName: biz,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setConnection(data.connection);
        setBusinessName(biz);
        setCustomBusiness("");
        fetchConnections();
        if (onConnectionChange) onConnectionChange(true);
        setShowModal(false);
        setSiteUrlInput("");
        setApiKeyInput("");
        setNewBizNameInput("");
        alert("🎉 WordPress website paired successfully!");
      } else {
        setErrorMsg(data.error || "Failed to pair with WordPress site.");
      }
    } catch (e) {
      setErrorMsg("Connection error: " + e.message);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm(`Disconnect WordPress site for ${activeBusiness}? You can reconnect anytime.`)) return;

    try {
      await fetch("/api/wordpress/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "disconnect",
          businessName: activeBusiness,
        }),
      });
      setConnection(null);
      setTestResult(null);
      fetchConnections();
      if (onConnectionChange) onConnectionChange(false);
    } catch (e) {
      alert("Failed to disconnect: " + e.message);
    }
  };

  const connectedProfiles = Object.keys(allConnections || {}).filter(k => allConnections[k]?.siteUrl);

  return (
    <div style={{ marginTop: 8, width: "100%", maxWidth: "100%" }}>
      {/* Business Selector Header */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 18, flexWrap: "wrap", width: "100%", maxWidth: "100%" }}>
        <label style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", flexShrink: 0 }}>Target Business Profile:</label>
        <select
          value={businessName}
          onChange={(e) => {
            if (e.target.value === "__add_new__") {
              openNewSiteModal();
            } else {
              setBusinessName(e.target.value);
              setCustomBusiness("");
            }
          }}
          style={{
            padding: "9px 14px",
            borderRadius: 8,
            border: "1px solid rgba(255, 255, 255, 0.16)",
            fontSize: 13,
            background: "#0d111c",
            color: "#38bdf8",
            fontWeight: 700,
            cursor: "pointer",
            outline: "none",
            maxWidth: "100%",
            width: "auto",
            minWidth: 0,
            flex: "1 1 220px",
            textOverflow: "ellipsis",
            overflow: "hidden",
          }}
        >
          {connectedProfiles.length > 0 ? (
            connectedProfiles.map((name) => (
              <option key={name} value={name} style={{ background: "#0d111c", color: "#38bdf8" }}>
                ✓ {name} ({allConnections[name]?.siteUrl})
              </option>
            ))
          ) : (
            <option value="none" style={{ background: "#0d111c", color: "#94a3b8" }}>
              [ No Website Connected Yet ]
            </option>
          )}
          <option value="__add_new__" style={{ background: "#0d111c", color: "#10b981", fontWeight: "bold" }}>
            + Connect New Business / Website ↗
          </option>
        </select>

        <button
          type="button"
          onClick={openNewSiteModal}
          className="btn-gabbar-primary"
          style={{ padding: "8px 14px", fontSize: 12, borderRadius: 8, whiteSpace: "nowrap" }}
        >
          + Add Website
        </button>
      </div>

      {loading ? (
        <div style={{ color: "#94a3b8", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 14, height: 14, border: "2px solid rgba(56, 189, 248, 0.2)", borderTopColor: "#38bdf8", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          Checking connection status…
        </div>
      ) : connection?.siteUrl ? (
        /* 🟢 CONNECTED STATE (DARK LUXURY) */
        <div style={{ background: "rgba(16, 22, 34, 0.8)", border: "1px solid rgba(56, 189, 248, 0.25)", borderRadius: 14, padding: "16px 18px", width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
            <div style={{ minWidth: 0, flex: "1 1 240px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ height: 10, width: 10, borderRadius: "50%", background: "#10b981", display: "inline-block", boxShadow: "0 0 10px #10b981", flexShrink: 0 }}></span>
                <span style={{ fontWeight: 800, fontSize: 15, color: "#f8fafc", wordBreak: "break-all", overflowWrap: "anywhere" }}>Connected: {connection.siteUrl}</span>
                {connection.isWooCommerce && (
                  <span style={{ fontSize: 11, background: "rgba(56, 189, 248, 0.12)", border: "1px solid rgba(56, 189, 248, 0.3)", padding: "2px 8px", borderRadius: 4, color: "#38bdf8", fontWeight: 700 }}>
                    WooCommerce Active
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6, wordBreak: "break-word" }}>
                Site: {connection.siteName || "WordPress"} · Plugin v{connection.pluginVersion || "1.0.0"} · Profile: <strong style={{ color: "#38bdf8" }}>{activeBusiness}</strong>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", width: "auto" }}>
              <a
                href={`/seo?business=${encodeURIComponent(activeBusiness || "")}`}
                onClick={() => {
                  if (activeBusiness && typeof window !== "undefined") {
                    localStorage.setItem("gabbar_active_business", activeBusiness);
                  }
                }}
                className="btn-gabbar-primary"
                style={{
                  padding: "9px 18px",
                  fontSize: 13,
                }}
              >
                <span>🌐</span> Open SEO Suite ↗
              </a>
              <button
                onClick={handleTestConnection}
                disabled={testing}
                className="btn-gabbar-dark"
                style={{
                  padding: "9px 16px",
                  fontSize: 13,
                }}
              >
                {testing ? "Testing…" : "⚡ Test Ping"}
              </button>
              <button
                onClick={handleDisconnect}
                style={{
                  padding: "9px 14px",
                  borderRadius: 8,
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  background: "rgba(239, 68, 68, 0.1)",
                  color: "#f87171",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Disconnect
              </button>
            </div>
          </div>

          {testResult && (
            <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, fontSize: 13, background: testResult.ok ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)", border: `1px solid ${testResult.ok ? "#10b981" : "#ef4444"}`, color: testResult.ok ? "#34d399" : "#f87171" }}>
              {testResult.message}
            </div>
          )}
        </div>
      ) : (
        /* ⚪ DISCONNECTED STATE */
        <div style={{ background: "rgba(16, 22, 34, 0.6)", border: "1px dashed rgba(255, 255, 255, 0.16)", borderRadius: 14, padding: 24 }}>
          <p style={{ margin: "0 0 18px 0", color: "#94a3b8", fontSize: 14, lineHeight: 1.6 }}>
            Connect your WordPress / WooCommerce website to enable autonomous scheduled blogging, on-page SEO optimization, dual visual generation, and Google Search Console indexing.
          </p>
          <button
            onClick={openNewSiteModal}
            className="btn-gabbar-primary"
            style={{
              padding: "12px 24px",
              fontSize: 14,
            }}
          >
            <span>🌐</span>
            <span>Connect WordPress Website ↗</span>
          </button>
        </div>
      )}

      {/* ── ONBOARDING & PAIRING MODAL ── */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(5, 8, 15, 0.85)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: 16,
              maxWidth: 580,
              width: "100%",
              padding: 30,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 30px rgba(37, 99, 235, 0.15)",
              position: "relative",
              color: "#f8fafc",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: "#fff" }}>
                Connect WordPress Site {newBizNameInput ? `for ${newBizNameInput}` : ""}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ border: "none", background: "none", fontSize: 22, cursor: "pointer", color: "#94a3b8" }}
              >
                ✕
              </button>
            </div>

            {/* Quick Steps Toggle */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, background: "rgba(255,255,255,0.03)", padding: "8px 12px", borderRadius: 8 }}>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>Need the plugin zip file?</span>
              <a
                href="/api/wordpress/download"
                download
                style={{ fontSize: 12, color: "#38bdf8", fontWeight: 700, textDecoration: "underline" }}
              >
                📥 Download gabbarinfo-connect.zip
              </a>
            </div>

            {/* PAIRING FORM */}
            <div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1", display: "block", marginBottom: 6 }}>
                    Business / Website Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Divine Auto CNG, MyStore, Woman Massage Hub..."
                    value={newBizNameInput || customBusiness}
                    onChange={(e) => {
                      setNewBizNameInput(e.target.value);
                      setCustomBusiness(e.target.value);
                    }}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #1e293b", background: "#131b2e", color: "#fff", fontSize: 14, boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1", display: "block", marginBottom: 6 }}>
                    Target Website URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://www.yourdomain.com"
                    value={siteUrlInput}
                    onChange={(e) => setSiteUrlInput(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #1e293b", background: "#131b2e", color: "#fff", fontSize: 14, boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1", display: "block", marginBottom: 6 }}>
                    Plugin Secret Pairing Key
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. gb_sec_..."
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #1e293b", background: "#131b2e", color: "#fff", fontSize: 14, fontFamily: "monospace", boxSizing: "border-box" }}
                  />
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                    Found in your WordPress Admin under <code>Settings ➔ GabbarInfo AI</code>.
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div style={{ marginTop: 14, padding: 12, background: "rgba(239, 68, 68, 0.1)", border: "1px solid #ef4444", color: "#f87171", borderRadius: 8, fontSize: 13 }}>
                  ⚠️ {errorMsg}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-gabbar-dark"
                  style={{ padding: "10px 18px", fontSize: 13 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveConnection}
                  disabled={connecting}
                  className="btn-gabbar-primary"
                  style={{ padding: "11px 24px", fontSize: 13 }}
                >
                  {connecting ? "Verifying…" : "Verify & Pair Website ↗"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
