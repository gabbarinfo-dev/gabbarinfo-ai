// pages/components/google/GoogleAdsAccountConnect.js
"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

export default function GoogleAdsAccountConnect() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [needsReauth, setNeedsReauth] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createCurrency, setCreateCurrency] = useState("INR");
  const [createTimeZone, setCreateTimeZone] = useState("Asia/Kolkata");
  const [creating, setCreating] = useState(false);
  const [policyInfo, setPolicyInfo] = useState(null);

  const handleCreateAdAccount = async (e) => {
    e.preventDefault();
    setCreating(true);
    setMessage("");
    setError("");
    setPolicyInfo(null);
    try {
      const res = await fetch("/api/google-ads/create-ad-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountName: createName,
          currencyCode: createCurrency,
          timeZone: createTimeZone,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage("🎉 " + data.message);
        setShowCreateModal(false);
        fetchAccounts();
      } else if (data.policyRestricted) {
        setPolicyInfo(data);
      } else {
        setError(data.message || "Failed to create Google Ads account.");
      }
    } catch (err) {
      setError("Network error creating account: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  const fetchAccounts = async () => {
    setLoading(true);
    setError("");
    setNeedsReauth(false);
    try {
      const res = await fetch("/api/google-ads/accounts");
      const data = await res.json();

      if (data.ok) {
        setConnected(Boolean(data.connected));
        setAccounts(data.accounts || []);
        setSelectedCustomerId(data.selectedCustomerId || null);
        // Only require re-authentication if the Google Ads scope is explicitly missing
        if (data.connected && data.hasAdsScope === false) {
          setNeedsReauth(true);
        }
      } else {
        setConnected(Boolean(data.connected));
        if (data.hasAdsScope === false || data.needsReauth) {
          setNeedsReauth(true);
        }
        setError(data.message || "Failed to load Google Ads accounts.");
      }
    } catch (err) {
      setError("Network error loading Google Ads accounts: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleSelectAccount = async (customerId, managerId) => {
    setUpdatingId(customerId);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/google-ads/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, managerId: managerId || null }),
      });

      const data = await res.json();
      if (data.ok) {
        setSelectedCustomerId(customerId);
        setMessage(`Active account updated to ${formatCustomerId(customerId)}`);
        setTimeout(() => setMessage(""), 3500);
      } else {
        setError(data.message || "Failed to set active account.");
      }
    } catch (err) {
      setError("Error selecting account: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const formatCustomerId = (id) => {
    if (!id) return "";
    const clean = String(id).replace(/[^0-9]/g, "");
    if (clean.length === 10) {
      return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
    }
    return clean;
  };

  if (loading) {
    return (
      <div style={{ padding: "16px", color: "#94a3b8", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{ width: 16, height: 16, border: "2px solid rgba(59, 130, 246, 0.2)", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        Checking Google Ads account connection…
      </div>
    );
  }

  if (!connected) {
    return (
      <div
        style={{
          padding: "20px",
          borderRadius: "14px",
          background: "rgba(15, 23, 42, 0.65)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(66, 133, 244, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
            🎯
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#f8fafc" }}>Google Ads Account</h3>
            <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#94a3b8", lineHeight: 1.4 }}>
              Connect your Google Ads account to create and manage search campaigns directly with AI.
            </p>
          </div>
        </div>

        <button
          onClick={() => signIn("google")}
          className="btn-gabbar-primary"
          style={{
            marginTop: "8px",
            padding: "11px 22px",
            fontSize: "13px",
          }}
        >
          <span>Connect Google Ads Account ↗</span>
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "20px",
        borderRadius: "14px",
        background: "rgba(15, 23, 42, 0.65)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(66, 133, 244, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
            🎯
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#f8fafc" }}>Google Ads Connected</h3>
              <span
                style={{
                  fontSize: "11px",
                  padding: "2px 8px",
                  background: "rgba(16, 185, 129, 0.15)",
                  color: "#34d399",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  borderRadius: "999px",
                  fontWeight: 600,
                }}
              >
                OAuth Active
              </span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#94a3b8" }}>
              Select which Google Ads account you want GabbarInfo AI to manage.
            </p>
          </div>
        </div>

        <button
          onClick={fetchAccounts}
          className="btn-gabbar-secondary"
          style={{
            padding: "7px 14px",
            fontSize: "12px",
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {message && (
        <div
          style={{
            padding: "10px 14px",
            background: "rgba(16, 185, 129, 0.12)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            color: "#34d399",
            borderRadius: "10px",
            fontSize: "13px",
            marginBottom: "14px",
          }}
        >
          ✅ {message}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "10px 14px",
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#fca5a5",
            borderRadius: "10px",
            fontSize: "13px",
            marginBottom: "14px",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {accounts.length === 0 ? (
        <div
          style={{
            padding: "20px",
            background: needsReauth ? "rgba(245, 158, 11, 0.1)" : "rgba(8, 11, 17, 0.6)",
            borderRadius: "10px",
            border: needsReauth ? "1px solid rgba(245, 158, 11, 0.3)" : "1px dashed rgba(255, 255, 255, 0.12)",
            fontSize: "13px",
            color: needsReauth ? "#fde68a" : "#94a3b8",
            textAlign: "center",
          }}
        >
          {needsReauth ? (
            <>
              <div style={{ fontSize: "20px", marginBottom: "8px" }}>🔑</div>
              <strong style={{ display: "block", marginBottom: "6px", fontSize: "14px", color: "#f8fafc" }}>
                Google Ads Permission Required
              </strong>
              <p style={{ margin: "0 0 14px", lineHeight: 1.6 }}>
                Your current login doesn't have the <strong>Google Ads scope</strong> authorized.
                This happens when you signed in before Google Ads access was enabled.
                <br /><br />
                Please <strong>sign out and sign back in</strong> — the consent screen will
                appear and you must click <em>"Allow"</em> to grant Google Ads access.
              </p>
              <button
                onClick={() => signIn("google")}
                style={{
                  padding: "10px 20px",
                  background: "linear-gradient(135deg, #4285F4, #2563eb)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                🔄 Re-authenticate with Google
              </button>
            </>
          ) : (
            <div>
              <div style={{ fontSize: "22px", marginBottom: "8px" }}>📊</div>
              <strong style={{ display: "block", marginBottom: "6px", fontSize: "14px", color: "#f8fafc" }}>
                Google Ads Connected · No Ad Accounts Found
              </strong>
              <p style={{ margin: "0 0 16px", lineHeight: 1.6, color: "#cbd5e1", maxWidth: 520, marginInline: "auto" }}>
                Your Google login is authorized, but Google reported no active Google Ads accounts under 
                this email address. You can create a new account directly with AI, or register on Google Ads.
              </p>
              <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-gabbar-primary"
                  style={{
                    padding: "8px 18px",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  ➕ Create Google Ads Account via AI
                </button>
                <a
                  href="https://ads.google.com/home/"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-gabbar-secondary"
                  style={{
                    padding: "8px 18px",
                    fontSize: "13px",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  🌐 ads.google.com ↗
                </a>
                <button
                  onClick={fetchAccounts}
                  className="btn-gabbar-secondary"
                  style={{
                    padding: "8px 18px",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  🔄 Refresh
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "4px" }}>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                background: "rgba(59, 130, 246, 0.15)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                color: "#93c5fd",
                padding: "4px 10px",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ➕ Create Another Account
            </button>
          </div>

          {accounts.map((acc) => {
            const isSelected = selectedCustomerId === acc.customerId;
            const isPending = updatingId === acc.customerId;

            return (
              <div
                key={acc.customerId}
                onClick={() => !isPending && handleSelectAccount(acc.customerId, acc.managerId)}
                style={{
                  padding: "12px 16px",
                  borderRadius: "10px",
                  border: isSelected ? "2px solid #3b82f6" : "1px solid rgba(255, 255, 255, 0.08)",
                  background: isSelected ? "rgba(59, 130, 246, 0.12)" : "rgba(8, 11, 17, 0.6)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: isSelected ? "0 4px 14px rgba(59, 130, 246, 0.2)" : "none",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <strong style={{ fontSize: "14px", color: isSelected ? "#93c5fd" : "#f8fafc" }}>
                      {acc.descriptiveName || "Google Ads Account"}
                    </strong>
                    {acc.isManager && (
                      <span
                        style={{
                          fontSize: "10px",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "rgba(255, 255, 255, 0.06)",
                          color: "#94a3b8",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                        }}
                      >
                        Manager (MCC)
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                    ID: <code style={{ color: "#60a5fa" }}>{formatCustomerId(acc.customerId)}</code> • Currency: {acc.currencyCode || "INR"}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {isSelected ? (
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#60a5fa",
                        background: "rgba(59, 130, 246, 0.2)",
                        border: "1px solid rgba(59, 130, 246, 0.4)",
                        padding: "4px 10px",
                        borderRadius: "999px",
                      }}
                    >
                      ✓ Active Target
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectAccount(acc.customerId, acc.managerId);
                      }}
                      className="btn-gabbar-gold"
                      style={{
                        padding: "6px 16px",
                        fontSize: "12px",
                      }}
                    >
                      {isPending ? "Setting…" : "Select ↗"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE GOOGLE ADS ACCOUNT MODAL */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#0f172a",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "480px",
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", color: "#f8fafc", fontWeight: 700 }}>
                🎯 Create Google Ads Account
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setPolicyInfo(null);
                }}
                style={{ background: "none", border: "none", color: "#94a3b8", fontSize: "20px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {policyInfo ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ padding: "14px", borderRadius: "10px", background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", color: "#fde68a", fontSize: "13px", lineHeight: 1.6 }}>
                  ⚠️ <strong>Google Ads Advertiser Verification Policy:</strong>
                  <br />
                  {policyInfo.message}
                </div>
                <div style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: 1.6, whiteSpace: "pre-line" }}>
                  {policyInfo.instructions}
                </div>
                <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                  <a
                    href={policyInfo.actionUrl || "https://ads.google.com/home/"}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-gabbar-primary"
                    style={{ flex: 1, padding: "12px", fontSize: "13px", textAlign: "center", textDecoration: "none" }}
                  >
                    🚀 Open ads.google.com ↗
                  </a>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setPolicyInfo(null);
                      fetchAccounts();
                    }}
                    className="btn-gabbar-secondary"
                    style={{ padding: "12px 18px", fontSize: "13px" }}
                  >
                    Done & Refresh
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateAdAccount} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <p style={{ margin: "0 0 6px", fontSize: "13px", color: "#94a3b8", lineHeight: 1.5 }}>
                  Provision a new Google Ads account under your managed agency cluster with automated AI campaign capabilities.
                </p>

                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
                    Account / Business Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Marketing Ads"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
                      Billing Currency *
                    </label>
                    <select
                      value={createCurrency}
                      onChange={(e) => setCreateCurrency(e.target.value)}
                      style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="CAD">CAD ($)</option>
                      <option value="AUD">AUD ($)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
                      Timezone *
                    </label>
                    <select
                      value={createTimeZone}
                      onChange={(e) => setCreateTimeZone(e.target.value)}
                      style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                    >
                      <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                      <option value="America/New_York">America/New York (EST)</option>
                      <option value="America/Los_Angeles">America/Los Angeles (PST)</option>
                      <option value="Europe/London">Europe/London (GMT)</option>
                      <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
                  <button
                    type="submit"
                    disabled={creating}
                    className="btn-gabbar-primary"
                    style={{ flex: 1, padding: "12px", fontSize: "13px" }}
                  >
                    {creating ? "Provisioning Account…" : "🚀 Create Account via AI"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="btn-gabbar-secondary"
                    style={{ padding: "12px 18px", fontSize: "13px" }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

