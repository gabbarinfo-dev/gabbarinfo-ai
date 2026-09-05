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
        // If connected but no accounts returned, the refresh token
        // likely lacks the adwords scope — user needs to re-authenticate
        if (data.connected && (!data.accounts || data.accounts.length === 0)) {
          setNeedsReauth(true);
        }
      } else {
        setConnected(Boolean(data.connected));
        // Scope/permission errors → prompt re-auth
        if (data.error === "failed_to_list_accounts" || data.needsReauth) {
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
            "No Google Ads customer accounts found for this Google login. Make sure your Google account has access to at least one active Google Ads account."
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
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
    </div>
  );
}
