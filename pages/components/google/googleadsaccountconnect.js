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

  const fetchAccounts = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/google-ads/accounts");
      const data = await res.json();

      if (data.ok) {
        setConnected(Boolean(data.connected));
        setAccounts(data.accounts || []);
        setSelectedCustomerId(data.selectedCustomerId || null);
      } else {
        setConnected(Boolean(data.connected));
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

  const handleSelectAccount = async (customerId) => {
    setUpdatingId(customerId);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/google-ads/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
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
      <div style={{ padding: "16px", color: "#666", fontSize: "14px" }}>
        Checking Google Ads account connection…
      </div>
    );
  }

  if (!connected) {
    return (
      <div
        style={{
          padding: "20px",
          borderRadius: "12px",
          background: "#fff",
          border: "1px solid #e2e8f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <span style={{ fontSize: "20px" }}>🎯</span>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px", color: "#1e293b" }}>Google Ads Account</h3>
            <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#64748b" }}>
              Connect your Google Ads account to create and manage search campaigns directly with AI.
            </p>
          </div>
        </div>

        <button
          onClick={() => signIn("google")}
          style={{
            marginTop: "10px",
            padding: "10px 18px",
            background: "#4285F4",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>Connect Google Ads Account</span>
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "20px",
        borderRadius: "12px",
        background: "#fff",
        border: "1px solid #e2e8f0",
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
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "22px" }}>🎯</span>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", color: "#1e293b" }}>Google Ads Connected</h3>
              <span
                style={{
                  fontSize: "11px",
                  padding: "2px 8px",
                  background: "#dcfce7",
                  color: "#166534",
                  borderRadius: "999px",
                  fontWeight: 600,
                }}
              >
                OAuth Active
              </span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
              Select which Google Ads account you want GabbarInfo AI to manage.
            </p>
          </div>
        </div>

        <button
          onClick={fetchAccounts}
          style={{
            padding: "6px 12px",
            fontSize: "12px",
            borderRadius: "6px",
            border: "1px solid #cbd5e1",
            background: "#f8fafc",
            cursor: "pointer",
            color: "#475569",
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {message && (
        <div
          style={{
            padding: "10px 14px",
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            color: "#065f46",
            borderRadius: "8px",
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
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            borderRadius: "8px",
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
            padding: "16px",
            background: "#f8fafc",
            borderRadius: "8px",
            border: "1px dashed #cbd5e1",
            fontSize: "13px",
            color: "#64748b",
            textAlign: "center",
          }}
        >
          No Google Ads customer accounts found for this Google login. Make sure your Google account has access to at least one active Google Ads account.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {accounts.map((acc) => {
            const isSelected = selectedCustomerId === acc.customerId;
            const isPending = updatingId === acc.customerId;

            return (
              <div
                key={acc.customerId}
                onClick={() => !isPending && handleSelectAccount(acc.customerId)}
                style={{
                  padding: "12px 16px",
                  borderRadius: "10px",
                  border: isSelected ? "2px solid #3b82f6" : "1px solid #e2e8f0",
                  background: isSelected ? "#eff6ff" : "#fff",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <strong style={{ fontSize: "14px", color: isSelected ? "#1d4ed8" : "#1e293b" }}>
                      {acc.descriptiveName || "Google Ads Account"}
                    </strong>
                    {acc.isManager && (
                      <span
                        style={{
                          fontSize: "10px",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "#f1f5f9",
                          color: "#475569",
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        Manager (MCC)
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "3px" }}>
                    ID: <code>{formatCustomerId(acc.customerId)}</code> • Currency: {acc.currencyCode || "INR"}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {isSelected ? (
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#2563eb",
                        background: "#dbeafe",
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
                        handleSelectAccount(acc.customerId);
                      }}
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        background: "#fff",
                        color: "#334155",
                        cursor: isPending ? "wait" : "pointer",
                      }}
                    >
                      {isPending ? "Setting…" : "Select"}
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
