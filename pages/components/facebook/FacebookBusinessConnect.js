"use client";

import { useEffect, useState } from "react";
import BoostModal from "./meta/BoostModal";

export default function FacebookBusinessConnect() {
  const [status, setStatus] = useState("idle"); // idle | connected | loading
  const [meta, setMeta] = useState(null);
  const [showBoostModal, setShowBoostModal] = useState(false);
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

    // Refresh meta info to show new IDs
    setMeta(prev => ({
      ...prev,
      fb_business_id: data.fb_business_id,
      fb_page_id: data.fb_page_id,
      fb_ad_account_id: data.fb_ad_account_id,
      business_info_synced: true,
    }));

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

  // --- INSTAGRAM INSIGHTS FEATURE (instagram_basic) ---
  const [showIgInsightsModal, setShowIgInsightsModal] = useState(false);
  const [igData, setIgData] = useState(null);
  const [igLoading, setIgLoading] = useState(false);
  const [showIgConsentModal, setShowIgConsentModal] = useState(false);

  const handleIgInsightsClick = () => {
    if (meta?.business_info_synced !== true) {
      alert("Please sync business info first");
      return;
    }
    setShowIgConsentModal(true);
  };

  const handleIgConsentYes = async () => {
    setShowIgConsentModal(false);
    setShowIgInsightsModal(true);
    setIgLoading(true);
    try {
      const res = await fetch("/api/meta/instagram-insights", {
        method: "POST",
      });
      const data = await res.json();
      if (data.ok) {
        setIgData(data.data);
      } else {
        alert("Failed to fetch Instagram insights: " + (data.message || "Unknown error"));
        setShowIgInsightsModal(false);
      }
    } catch (e) {
      alert("Error: " + e.message);
      setShowIgInsightsModal(false);
    } finally {
      setIgLoading(false);
    }
  };

  // --- AD INSIGHTS FEATURE (ads_read) ---
  const [showAdInsightsModal, setShowAdInsightsModal] = useState(false);
  const [adData, setAdData] = useState(null);
  const [adLoading, setAdLoading] = useState(false);
  const [showAdConsentModal, setShowAdConsentModal] = useState(false);

  const handleAdInsightsClick = () => {
    if (meta?.business_info_synced !== true) {
      alert("Please sync business info first");
      return;
    }
    setShowAdConsentModal(true);
  };

  const handleAdConsentYes = async () => {
    setShowAdConsentModal(false);
    setShowAdInsightsModal(true);
    setAdLoading(true);
    try {
      const res = await fetch("/api/meta/ad-insights", {
        method: "POST",
      });
      const data = await res.json();
      if (data.ok) {
        setAdData(data.data);
      } else {
        alert("Failed to fetch Ad insights: " + (data.message || "Unknown error"));
        setShowAdInsightsModal(false);
      }
    } catch (e) {
      alert("Error: " + e.message);
      setShowAdInsightsModal(false);
    } finally {
      setAdLoading(false);
    }
  };

  const handleBoostClick = () => {
    if (meta?.business_info_synced !== true) {
      alert("Please sync business info first");
      return;
    }
    setShowBoostModal(true);
  };

  // 👆 ADDED AD LOGIC HERE
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

          {meta?.business_info_synced === true && (
            <ul style={{ fontSize: 13, paddingLeft: 18, listStyleType: "none" }}>
              {meta?.fb_business_id && (
                <li style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>Business ID:</span>{" "}
                  <code style={{ background: "#f3f4f6", padding: "2px 4px", borderRadius: 4 }}>{meta.fb_business_id}</code>
                </li>
              )}
              {meta?.fb_page_id && (
                <li style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>Page ID:</span>{" "}
                  <code style={{ background: "#f3f4f6", padding: "2px 4px", borderRadius: 4 }}>{meta.fb_page_id}</code>
                </li>
              )}
              {meta?.fb_ad_account_id && (
                <li>
                  <span style={{ fontWeight: 600 }}>Ad Account ID:</span>{" "}
                  <code style={{ background: "#f3f4f6", padding: "2px 4px", borderRadius: 4 }}>{meta.fb_ad_account_id}</code>
                </li>
              )}
            </ul>
          )}
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
              onClick={handleIgInsightsClick}
              style={{
                padding: "8px 12px",
                background: status === "connected" ? "#fff" : "#f3f4f6",
                color: status === "connected" ? "#1877F2" : "#9ca3af",
                border: `1px solid ${status === "connected" ? "#1877F2" : "#d1d5db"}`,
                borderRadius: "6px",
                cursor: status === "connected" ? "pointer" : "not-allowed",
              }}
            >
              View Instagram Insights
            </button>

            <button
              onClick={handleAdInsightsClick}
              style={{
                padding: "8px 12px",
                background: status === "connected" ? "#fff" : "#f3f4f6",
                color: status === "connected" ? "#1877F2" : "#9ca3af",
                border: `1px solid ${status === "connected" ? "#1877F2" : "#d1d5db"}`,
                borderRadius: "6px",
                cursor: status === "connected" ? "pointer" : "not-allowed",
              }}
            >
              View Ad Insights
            </button>

            <button
              onClick={handleBoostClick}
              style={{
                padding: "8px 12px",
                background: "#1877F2",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Boost a Page Post
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

          {/* BOOST MODAL */}
          {showBoostModal && (
            <BoostModal onClose={() => setShowBoostModal(false)} />
          )}

          {/* PAGE CONSENT MODAL */}
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

          {/* PAGE ENGAGEMENT RESULTS MODAL */}
          {showEngagementModal && (
            <div style={modalOverlayStyle}>
              <div style={modalContentStyle}>
                <h3 style={{ marginBottom: meta?.fb_page_id ? "4px" : "16px" }}>
                  {meta?.business_name ? `${meta.business_name} ` : ""}Page Performance Insights
                </h3>
                {meta?.fb_page_id && (
                  <p style={{ fontSize: 13, color: "#666", marginBottom: "16px" }}>
                    Page ID: {meta.fb_page_id}
                  </p>
                )}
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

          {/* IG CONSENT MODAL */}
          {showIgConsentModal && (
            <div style={modalOverlayStyle}>
              <div style={modalContentStyle}>
                <h3>Instagram Business Insights</h3>
                <p>Do you want to view insights for your Instagram business account?</p>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
                  <button onClick={() => setShowIgConsentModal(false)} style={cancelBtnStyle}>No</button>
                  <button onClick={handleIgConsentYes} style={confirmBtnStyle}>Yes</button>
                </div>
              </div>
            </div>
          )}

          {/* IG INSIGHTS RESULTS MODAL */}
          {showIgInsightsModal && (
            <div style={modalOverlayStyle}>
              <div style={modalContentStyle}>
                <h3>Instagram Business Insights</h3>
                {igLoading ? (
                  <p>Fetching Instagram metrics...</p>
                ) : igData ? (
                  <div style={{ marginTop: 15 }}>
                    <div style={metricRowStyle}>
                      <strong>Followers</strong>
                      <span>{igData.followers_count.toLocaleString()}</span>
                    </div>
                    <div style={metricRowStyle}>
                      <strong>Media Count</strong>
                      <span>{igData.media_count.toLocaleString()} posts</span>
                    </div>
                    <p style={{ fontSize: 12, color: "#666", marginTop: 20 }}>
                      * These metrics show your current Instagram business profile scale.
                    </p>
                  </div>
                ) : (
                  <p>No data available.</p>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
                  <button onClick={() => setShowIgInsightsModal(false)} style={confirmBtnStyle}>Close</button>
                </div>
              </div>
            </div>
          )}

          {/* AD CONSENT MODAL */}
          {showAdConsentModal && (
            <div style={modalOverlayStyle}>
              <div style={modalContentStyle}>
                <h3>Ad Account Insights</h3>
                <p>Do you want to view insights for your Ad Account?</p>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
                  <button onClick={() => setShowAdConsentModal(false)} style={cancelBtnStyle}>No</button>
                  <button onClick={handleAdConsentYes} style={confirmBtnStyle}>Yes</button>
                </div>
              </div>
            </div>
          )}

          {/* AD INSIGHTS RESULTS MODAL */}
          {showAdInsightsModal && (
            <div style={modalOverlayStyle}>
              <div style={modalContentStyle}>
                <h3>Ad Account Insights</h3>
                {adLoading ? (
                  <p>Fetching ad performance...</p>
                ) : adData ? (
                  <div style={{ marginTop: 15 }}>
                    {adData.campaign_name ? (
                      <>
                        <div style={{ marginBottom: 15, padding: "8px", background: "#f9fafb", borderRadius: "4px" }}>
                          <strong style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>LATEST CAMPAIGN</strong>
                          <span style={{ fontWeight: 500 }}>{adData.campaign_name}</span>
                        </div>
                        <div style={metricRowStyle}>
                          <strong>Impressions</strong>
                          <span>{adData.impressions.toLocaleString()}</span>
                        </div>
                        <div style={metricRowStyle}>
                          <strong>Lifetime Reach</strong>
                          <span>{adData.reach.toLocaleString()} people</span>
                        </div>
                      </>
                    ) : (
                      <p>No active campaigns found in this account.</p>
                    )}
                    <p style={{ fontSize: 12, color: "#666", marginTop: 20 }}>
                      * Insights are shown for the most recent campaign in this ad account.
                    </p>
                  </div>
                ) : (
                  <p>No data available.</p>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
                  <button onClick={() => setShowAdInsightsModal(false)} style={confirmBtnStyle}>Close</button>
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
