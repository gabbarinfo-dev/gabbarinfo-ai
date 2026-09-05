"use client";

import { useEffect, useState } from "react";

export default function WordPressSiteConnect() {
  const [businessName, setBusinessName] = useState("GABBARinfo");
  const [customBusiness, setCustomBusiness] = useState("");
  const [connection, setConnection] = useState(null);
  const [allConnections, setAllConnections] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState(1); // 1: Download, 2: Install, 3: Connect
  const [siteUrlInput, setSiteUrlInput] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const activeBusiness = customBusiness.trim() || businessName;

  // Load existing connections
  useEffect(() => {
    fetchConnections();
  }, [activeBusiness]);

  const fetchConnections = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/wordpress/sync?action=get-connection&businessName=${encodeURIComponent(activeBusiness)}`);
      const data = await res.json();
      if (data.ok) {
        setConnection(data.connection);
        setAllConnections(data.allConnections || {});
      }
    } catch (e) {
      console.error("Failed to fetch wp connection:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleStartConnect = () => {
    setErrorMsg("");
    setModalStep(1);
    setShowModal(true);
    // Trigger automatic download
    const link = document.createElement("a");
    link.href = "/api/wordpress/download";
    link.download = "gabbarinfo-connect.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        setTestResult({ ok: true, message: `Connected! WordPress ${data.data?.site_name || ""} (v${data.data?.plugin_version}) is responding perfectly.` });
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
          businessName: activeBusiness,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setConnection(data.connection);
        setShowModal(false);
        setSiteUrlInput("");
        setApiKeyInput("");
        alert("🎉 WordPress site connected successfully!");
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
    } catch (e) {
      alert("Failed to disconnect: " + e.message);
    }
  };

  return (
    <div style={{ marginTop: 8 }}>
      {/* Business Selector Header */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Target Business Profile:</label>
        <select
          value={businessName}
          onChange={(e) => {
            setBusinessName(e.target.value);
            setCustomBusiness("");
          }}
          style={{
            padding: "7px 12px",
            borderRadius: 6,
            border: "1px solid #cbd5e1",
            fontSize: 13,
            background: "#fff",
            fontWeight: 500,
          }}
        >
          <option value="GABBARinfo">GABBARinfo (Default)</option>
          <option value="Digital Marketing Agency">Digital Marketing Agency</option>
          <option value="Addiction Rehabilitation Center">Addiction Rehabilitation Center</option>
          <option value="custom">+ Add / Type Custom Business</option>
        </select>

        {businessName === "custom" && (
          <input
            type="text"
            placeholder="Type business name..."
            value={customBusiness}
            onChange={(e) => setCustomBusiness(e.target.value)}
            style={{
              padding: "7px 12px",
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              fontSize: 13,
            }}
          />
        )}
      </div>

      {loading ? (
        <div style={{ color: "#64748b", fontSize: 13 }}>Checking connection status…</div>
      ) : connection?.siteUrl ? (
        /* 🟢 CONNECTED STATE */
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ height: 10, width: 10, borderRadius: "50%", background: "#10b981", display: "inline-block" }}></span>
                <span style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>Connected: {connection.siteUrl}</span>
                {connection.isWooCommerce && (
                  <span style={{ fontSize: 11, background: "#f1f5f9", padding: "2px 6px", borderRadius: 4, color: "#7c3aed", fontWeight: 600 }}>
                    WooCommerce Active
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                Site: {connection.siteName || "WordPress"} · Plugin v{connection.pluginVersion || "1.0.0"} · Active for <strong>{activeBusiness}</strong>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a
                href="/seo"
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  background: "#4f46e5",
                  color: "#fff",
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  display: "inline-block",
                }}
              >
                🚀 Open SEO & Website Suite
              </a>
              <button
                onClick={handleTestConnection}
                disabled={testing}
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {testing ? "Testing…" : "Test Ping"}
              </button>
              <button
                onClick={handleDisconnect}
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid #fecaca",
                  background: "#fff5f5",
                  color: "#dc2626",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Disconnect
              </button>
            </div>
          </div>

          {testResult && (
            <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 6, fontSize: 13, background: testResult.ok ? "#ecfdf5" : "#fef2f2", color: testResult.ok ? "#065f46" : "#991b1b" }}>
              {testResult.message}
            </div>
          )}
        </div>
      ) : (
        /* ⚪ DISCONNECTED STATE */
        <div style={{ background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: 8, padding: 18 }}>
          <p style={{ margin: "0 0 12px 0", color: "#64748b", fontSize: 14 }}>
            Connect your WordPress / WooCommerce website to enable autonomous daily blogging, on-page SEO optimization, dual visual generation, and Google Search Console tracking.
          </p>
          <button
            onClick={handleStartConnect}
            style={{
              padding: "10px 18px",
              borderRadius: 6,
              border: "none",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>🌐</span> Connect WordPress Website
          </button>
        </div>
      )}

      {/* ── 3-STEP ONBOARDING MODAL ── */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              maxWidth: 580,
              width: "100%",
              padding: 28,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>
                Connect WordPress Site for <strong>{activeBusiness}</strong>
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}
              >
                ✕
              </button>
            </div>

            {/* Stepper Progress */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: modalStep >= 1 ? "#2563eb" : "#e2e8f0" }} />
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: modalStep >= 2 ? "#2563eb" : "#e2e8f0" }} />
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: modalStep >= 3 ? "#2563eb" : "#e2e8f0" }} />
            </div>

            {/* STEP 1 */}
            {modalStep === 1 && (
              <div>
                <h3 style={{ fontSize: 16, marginTop: 0, color: "#1e293b" }}>Step 1: Plugin Download</h3>
                <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.5 }}>
                  The <strong>gabbarinfo-connect.zip</strong> file was downloaded automatically. If your download did not start, click below:
                </p>
                <div style={{ margin: "16px 0", padding: 14, background: "#f1f5f9", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>📦 gabbarinfo-connect.zip (v1.0.0)</span>
                  <a
                    href="/api/wordpress/download"
                    download
                    style={{ padding: "6px 12px", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12, fontWeight: 600, color: "#0f172a", textDecoration: "none" }}
                  >
                    Download Again
                  </a>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
                  <button
                    onClick={() => setModalStep(2)}
                    style={{ padding: "9px 18px", borderRadius: 6, border: "none", background: "#2563eb", color: "#fff", fontWeight: 600, cursor: "pointer" }}
                  >
                    Next: Installation Steps ➔
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2 */}
            {modalStep === 2 && (
              <div>
                <h3 style={{ fontSize: 16, marginTop: 0, color: "#1e293b" }}>Step 2: Install in WordPress</h3>
                <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, background: "#f8fafc", padding: 16, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                  <p style={{ margin: "0 0 8px 0" }}>1. Open your WordPress Admin (<code>yourdomain.com/wp-admin</code>).</p>
                  <p style={{ margin: "0 0 8px 0" }}>2. In the left menu, click <strong>Plugins ➔ Add New Plugin</strong>.</p>
                  <p style={{ margin: "0 0 8px 0" }}>3. Click <strong>Upload Plugin</strong> at the top, select <strong>gabbarinfo-connect.zip</strong>, and click <strong>Install Now</strong>.</p>
                  <p style={{ margin: "0 0 8px 0" }}>4. Click <strong>Activate Plugin</strong>.</p>
                  <p style={{ margin: 0 }}>5. In the left sidebar, click <strong>Settings ➔ GabbarInfo AI</strong> (or copy your Secret Pairing Key).</p>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
                  <button
                    onClick={() => setModalStep(1)}
                    style={{ padding: "9px 16px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", cursor: "pointer" }}
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setModalStep(3)}
                    style={{ padding: "9px 18px", borderRadius: 6, border: "none", background: "#2563eb", color: "#fff", fontWeight: 600, cursor: "pointer" }}
                  >
                    Next: Enter Pairing Key ➔
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {modalStep === 3 && (
              <div>
                <h3 style={{ fontSize: 16, marginTop: 0, color: "#1e293b" }}>Step 3: Pair Your Site</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Target Website URL</label>
                    <input
                      type="url"
                      placeholder="https://www.yourdomain.com"
                      value={siteUrlInput}
                      onChange={(e) => setSiteUrlInput(e.target.value)}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Plugin Secret Pairing Key</label>
                    <input
                      type="text"
                      placeholder="e.g. gb_sec_..."
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14, fontFamily: "monospace" }}
                    />
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                      Found in your WordPress Admin under <code>Settings ➔ GabbarInfo AI</code>.
                    </div>
                  </div>
                </div>

                {errorMsg && (
                  <div style={{ marginTop: 14, padding: 10, background: "#fef2f2", color: "#b91c1c", borderRadius: 6, fontSize: 13 }}>
                    ⚠️ {errorMsg}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
                  <button
                    onClick={() => setModalStep(2)}
                    style={{ padding: "9px 16px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", cursor: "pointer" }}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSaveConnection}
                    disabled={connecting}
                    style={{ padding: "9px 18px", borderRadius: 6, border: "none", background: "#10b981", color: "#fff", fontWeight: 600, cursor: "pointer" }}
                  >
                    {connecting ? "Verifying…" : "Verify & Connect Website"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
