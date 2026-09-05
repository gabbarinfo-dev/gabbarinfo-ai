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
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 18, flexWrap: "wrap" }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>Target Business Profile:</label>
        <select
          value={businessName}
          onChange={(e) => {
            setBusinessName(e.target.value);
            setCustomBusiness("");
          }}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid #1e293b",
            fontSize: 13,
            background: "#131b2e",
            color: "#60a5fa",
            fontWeight: 600,
            cursor: "pointer",
            outline: "none",
          }}
        >
          <option value="GABBARinfo" style={{ background: "#0f172a", color: "#fff" }}>GABBARinfo (Default)</option>
          <option value="Digital Marketing Agency" style={{ background: "#0f172a", color: "#fff" }}>Digital Marketing Agency</option>
          <option value="Addiction Rehabilitation Center" style={{ background: "#0f172a", color: "#fff" }}>Addiction Rehabilitation Center</option>
          <option value="custom" style={{ background: "#0f172a", color: "#fff" }}>+ Add / Type Custom Business</option>
        </select>

        {businessName === "custom" && (
          <input
            type="text"
            placeholder="Type business name..."
            value={customBusiness}
            onChange={(e) => setCustomBusiness(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #1e293b",
              fontSize: 13,
              background: "#131b2e",
              color: "#fff",
            }}
          />
        )}
      </div>

      {loading ? (
        <div style={{ color: "#64748b", fontSize: 13 }}>Checking connection status…</div>
      ) : connection?.siteUrl ? (
        /* 🟢 CONNECTED STATE (DARK LUXURY) */
        <div style={{ background: "rgba(19, 27, 46, 0.6)", border: "1px solid #1e293b", borderRadius: 12, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ height: 10, width: 10, borderRadius: "50%", background: "#10b981", display: "inline-block", boxShadow: "0 0 8px #10b981" }}></span>
                <span style={{ fontWeight: 700, fontSize: 15, color: "#f8fafc" }}>Connected: {connection.siteUrl}</span>
                {connection.isWooCommerce && (
                  <span style={{ fontSize: 11, background: "rgba(124, 58, 237, 0.2)", border: "1px solid #7c3aed", padding: "2px 8px", borderRadius: 4, color: "#c4b5fd", fontWeight: 600 }}>
                    WooCommerce Active
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>
                Site: {connection.siteName || "WordPress"} · Plugin v{connection.pluginVersion || "1.0.0"} · Target: <span style={{ color: "#60a5fa", fontWeight: 600 }}>{activeBusiness}</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a
                href="/seo"
                style={{
                  padding: "9px 16px",
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
                  color: "#fff",
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 4px 14px rgba(37, 99, 235, 0.3)",
                }}
              >
                <span>🚀</span> Open SEO Suite
              </a>
              <button
                onClick={handleTestConnection}
                disabled={testing}
                style={{
                  padding: "9px 14px",
                  borderRadius: 8,
                  border: "1px solid #1e293b",
                  background: "#131b2e",
                  color: "#e2e8f0",
                  fontSize: 13,
                  cursor: "pointer",
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
        /* ⚪ DISCONNECTED STATE (DARK LUXURY) */
        <div style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px dashed #334155", borderRadius: 12, padding: 22 }}>
          <p style={{ margin: "0 0 16px 0", color: "#94a3b8", fontSize: 14, lineHeight: 1.5 }}>
            Connect your WordPress / WooCommerce website to enable autonomous daily blogging at 6:00 AM IST, on-page SEO optimization, dual visual generation, and Google Search Console tracking.
          </p>
          <button
            onClick={handleStartConnect}
            style={{
              padding: "11px 20px",
              borderRadius: 8,
              border: "none",
              background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 4px 14px rgba(37, 99, 235, 0.3)",
            }}
          >
            <span>🌐</span> Connect WordPress Website
          </button>
        </div>
      )}

      {/* ── 3-STEP ONBOARDING MODAL (DARK LUXURY) ── */}
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
                Connect WordPress Site for <strong style={{ color: "#60a5fa" }}>{activeBusiness}</strong>
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ border: "none", background: "none", fontSize: 22, cursor: "pointer", color: "#94a3b8" }}
              >
                ✕
              </button>
            </div>

            {/* Stepper Progress */}
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: modalStep >= 1 ? "#3b82f6" : "#1e293b" }} />
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: modalStep >= 2 ? "#3b82f6" : "#1e293b" }} />
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: modalStep >= 3 ? "#3b82f6" : "#1e293b" }} />
            </div>

            {/* STEP 1 */}
            {modalStep === 1 && (
              <div>
                <h3 style={{ fontSize: 16, marginTop: 0, color: "#fff" }}>Step 1: Plugin Download</h3>
                <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.5 }}>
                  The <strong>gabbarinfo-connect.zip</strong> file was downloaded automatically. If your download did not start, click below:
                </p>
                <div style={{ margin: "18px 0", padding: 16, background: "#131b2e", border: "1px solid #1e293b", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1" }}>📦 gabbarinfo-connect.zip (v1.0.0)</span>
                  <a
                    href="/api/wordpress/download"
                    download
                    style={{ padding: "7px 14px", background: "#1e293b", border: "1px solid #334155", borderRadius: 6, fontSize: 12, fontWeight: 600, color: "#60a5fa", textDecoration: "none" }}
                  >
                    Download Again
                  </a>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 26 }}>
                  <button
                    onClick={() => setModalStep(2)}
                    style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#2563eb", color: "#fff", fontWeight: 600, cursor: "pointer" }}
                  >
                    Next: Installation Steps ➔
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2 */}
            {modalStep === 2 && (
              <div>
                <h3 style={{ fontSize: 16, marginTop: 0, color: "#fff" }}>Step 2: Install in WordPress</h3>
                <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.7, background: "#131b2e", padding: 18, borderRadius: 10, border: "1px solid #1e293b" }}>
                  <p style={{ margin: "0 0 8px 0" }}>1. Open your WordPress Admin (<code>yourdomain.com/wp-admin</code>).</p>
                  <p style={{ margin: "0 0 8px 0" }}>2. In the left menu, click <strong>Plugins ➔ Add New Plugin</strong>.</p>
                  <p style={{ margin: "0 0 8px 0" }}>3. Click <strong>Upload Plugin</strong> at the top, select <strong>gabbarinfo-connect.zip</strong>, and click <strong>Install Now</strong>.</p>
                  <p style={{ margin: "0 0 8px 0" }}>4. Click <strong>Activate Plugin</strong>.</p>
                  <p style={{ margin: 0 }}>5. In the left sidebar, click <strong>Settings ➔ GabbarInfo AI</strong> and copy your <strong>Pairing Key</strong>.</p>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 26 }}>
                  <button
                    onClick={() => setModalStep(1)}
                    style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #1e293b", background: "#131b2e", color: "#94a3b8", cursor: "pointer" }}
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setModalStep(3)}
                    style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#2563eb", color: "#fff", fontWeight: 600, cursor: "pointer" }}
                  >
                    Next: Enter Pairing Key ➔
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {modalStep === 3 && (
              <div>
                <h3 style={{ fontSize: 16, marginTop: 0, color: "#fff" }}>Step 3: Pair Your Site</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1", display: "block", marginBottom: 6 }}>Target Website URL</label>
                    <input
                      type="url"
                      placeholder="https://www.yourdomain.com"
                      value={siteUrlInput}
                      onChange={(e) => setSiteUrlInput(e.target.value)}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #1e293b", background: "#131b2e", color: "#fff", fontSize: 14 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1", display: "block", marginBottom: 6 }}>Plugin Secret Pairing Key</label>
                    <input
                      type="text"
                      placeholder="e.g. gb_sec_..."
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #1e293b", background: "#131b2e", color: "#fff", fontSize: 14, fontFamily: "monospace" }}
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

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 26 }}>
                  <button
                    onClick={() => setModalStep(2)}
                    style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #1e293b", background: "#131b2e", color: "#94a3b8", cursor: "pointer" }}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSaveConnection}
                    disabled={connecting}
                    style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: "#10b981", color: "#fff", fontWeight: 700, cursor: "pointer", boxShadow: "0 0 16px rgba(16, 185, 129, 0.4)" }}
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
