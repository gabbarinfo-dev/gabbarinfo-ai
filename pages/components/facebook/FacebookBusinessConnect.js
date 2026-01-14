"use client";

import { useEffect, useState } from "react";

export default function FacebookBusinessConnect() {
  const [status, setStatus] = useState("idle"); // idle | connected | loading
  const [meta, setMeta] = useState(null);
  const isLocked = status === "connected";
  useEffect(() => {
    const interval = setInterval(() => {
      fetch("/api/meta/status")
        .then(res => res.json())
        .then(data => {
          if (data.connected) {
            setStatus("connected");
            setMeta(data.meta);
            clearInterval(interval);
          }
        });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleConnect = () => {
    setStatus("loading");
    window.location.href = "/api/facebook/connect";
  };
  // 👇 ADD THIS FUNCTION EXACTLY HERE
  const handleDisconnect = async () => {
    const confirmDisconnect = confirm(
      "Disconnect Facebook Business assets? You can reconnect anytime."
    );

    if (!confirmDisconnect) return;

    await fetch("/api/meta/disconnect", {
      method: "POST",
    });

    setMeta(null);
    setStatus("idle");
  };
  const handleSyncBusinessInfo = async () => {
    const confirmSync = confirm(
      "This will sync your Facebook Page & Instagram business details once. Continue?"
    );

    if (!confirmSync) return;

    const res = await fetch("/api/meta/sync-business-info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // backend will fetch token internally later
        // for now we just trigger sync
      }),
    });

    const data = await res.json();

    if (!data.ok) {
      alert("Sync failed: " + (data.error || data.message));
      return;
    }

    alert("Business info synced successfully.");
  };

  // --- PAGE ENGAGEMENT FEATURE ---
  const [showEngagementModal, setShowEngagementModal] = useState(false);
  const [engagementData, setEngagementData] = useState(null);
  const [engagementLoading, setEngagementLoading] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);

  const handleEngagementClick = () => {
    if (meta?.business_info_synced !== true) {
      alert("Please sync business info first");
      return;
    }
    setShowConsentModal(true);
  };

  const handleConsentYes = async () => {
    setShowConsentModal(false);
    setShowEngagementModal(true);
    setEngagementLoading(true);
    try {
      const res = await fetch("/api/meta/page-engagement", {
        method: "POST",
      });
      const data = await res.json();
      if (data.ok) {
        setEngagementData(data.data);
      } else {
        alert("Failed to fetch engagement: " + (data.message || "Unknown error"));
        setShowEngagementModal(false);
      }
    } catch (e) {
      alert("Error: " + e.message);
      setShowEngagementModal(false);
    } finally {
      setEngagementLoading(false);
    }
  };

  // 👆 ADD THIS LOGIC ABOVE THE RETURN
  return (
    <div
      style={{
        marginTop: "20px",
        padding: "16px",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        maxWidth: "520px",
        position: "relative" // for absolute modal positioning if needed
      }}
    >
      <h3 style={{ marginBottom: "6px" }}>Facebook Business</h3>

      {status === "connected" ? (
        <>
          <p style={{ color: "green", fontWeight: 500 }}>
            ✅ Facebook Business Connected
          </p>

          <ul style={{ fontSize: 14, paddingLeft: 18 }}>
            {meta?.fb_business_id && <li>Business Connected</li>}
            {meta?.fb_page_id && <li>Facebook Page Connected</li>}
            {meta?.ig_business_id && <li>Instagram Business Connected</li>}
            {meta?.fb_ad_account_id && <li>Ad Account Connected</li>}
          </ul>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "10px" }}>
            <button
              onClick={handleSyncBusinessInfo}
              style={{
                padding: "8px 12px",
                background: "#1877F2",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Sync Business Info
            </button>

            <button
              onClick={handleEngagementClick}
              style={{
                padding: "8px 12px",
                background: status === "connected" ? "#fff" : "#f3f4f6",
                color: status === "connected" ? "#1877F2" : "#9ca3af",
                border: `1px solid ${status === "connected" ? "#1877F2" : "#d1d5db"}`,
                borderRadius: "6px",
                cursor: status === "connected" ? "pointer" : "not-allowed",
              }}
            >
              View Page Engagement
            </button>

            <button
              onClick={handleDisconnect}
              style={{
                padding: "8px 12px",
                background: "#fff",
                color: "#d00",
                border: "1px solid #d00",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Disconnect Assets
            </button>
          </div>

          <p style={{ fontSize: 12, color: "#555", marginTop: 10 }}>
            You can reconnect anytime and add new Facebook Pages or grant access to other assets.
          </p>

          {/* CONSENT MODAL */}
          {showConsentModal && (
            <div style={modalOverlayStyle}>
              <div style={modalContentStyle}>
                <h3>Facebook Page Engagement</h3>
                <p>Do you want to view engagement insights for your Facebook Page?</p>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
                  <button onClick={() => setShowConsentModal(false)} style={cancelBtnStyle}>No</button>
                  <button onClick={handleConsentYes} style={confirmBtnStyle}>Yes</button>
                </div>
              </div>
            </div>
          )}

          {/* ENGAGEMENT RESULTS MODAL */}
          {showEngagementModal && (
            <div style={modalOverlayStyle}>
              <div style={modalContentStyle}>
                <h3>Page Performance Insights</h3>
                {engagementLoading ? (
                  <p>Fetching latest metrics...</p>
                ) : engagementData ? (
                  <div style={{ marginTop: 15 }}>
                    <div style={metricRowStyle}>
                      <strong>Page Likes (Fans)</strong>
                      <span>{engagementData.fan_count.toLocaleString()}</span>
                    </div>
                    <div style={metricRowStyle}>
                      <strong>Followers</strong>
                      <span>{engagementData.followers_count.toLocaleString()}</span>
                    </div>
                    <div style={metricRowStyle}>
                      <strong>Daily Unique Reach</strong>
                      <span>{engagementData.reach.toLocaleString()} members</span>
                    </div>
                    <p style={{ fontSize: 12, color: "#666", marginTop: 20 }}>
                      * Reach represents the number of unique people who saw any of your posts in the last 24 hours.
                    </p>
                  </div>
                ) : (
                  <p>No data available.</p>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
                  <button onClick={() => setShowEngagementModal(false)} style={confirmBtnStyle}>Close</button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <button
          onClick={handleConnect}
          style={{
            padding: "10px 14px",
            backgroundColor: "#1877F2",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Connect Facebook Business
        </button>
      )}
    </div>
  );
}

// STYLES
const modalOverlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalContentStyle = {
  background: "#fff",
  padding: "24px",
  borderRadius: "12px",
  width: "90%",
  maxWidth: "400px",
  boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
};

const metricRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  padding: "10px 0",
  borderBottom: "1px solid #f0f0f0",
};

const confirmBtnStyle = {
  padding: "8px 16px",
  background: "#1877F2",
  color: "#fff",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
};

const cancelBtnStyle = {
  padding: "8px 16px",
  background: "#fff",
  border: "1px solid #ddd",
  borderRadius: "6px",
  cursor: "pointer",
};
