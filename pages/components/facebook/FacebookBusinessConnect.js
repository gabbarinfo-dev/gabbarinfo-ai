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
        padding: "20px",
        background: "rgba(15, 23, 42, 0.65)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        backdropFilter: "blur(12px)",
        borderRadius: "14px",
        maxWidth: "540px",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(24, 119, 242, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
          🌐
        </div>
        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#f8fafc" }}>Facebook Business</h3>
      </div>

      {status === "connected" ? (
        <>
          <p style={{ color: "#34d399", fontWeight: 600, fontSize: "13px", display: "flex", alignItems: "center", gap: "6px", margin: "0 0 10px" }}>
            <span>✅</span> <span>Facebook Business Connected</span>
          </p>

          {meta?.business_info_synced === true && (
            <ul style={{ fontSize: 13, paddingLeft: 0, listStyleType: "none", margin: "10px 0 14px", color: "#94a3b8" }}>
              {meta?.fb_business_id && (
                <li style={{ marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, color: "#cbd5e1" }}>Business ID:</span>{" "}
                  <code style={{ background: "rgba(255, 255, 255, 0.06)", padding: "3px 6px", borderRadius: 6, color: "#60a5fa" }}>{meta.fb_business_id}</code>
                </li>
              )}
              {meta?.fb_page_id && (
                <li style={{ marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, color: "#cbd5e1" }}>Page ID:</span>{" "}
                  <code style={{ background: "rgba(255, 255, 255, 0.06)", padding: "3px 6px", borderRadius: 6, color: "#60a5fa" }}>{meta.fb_page_id}</code>
                </li>
              )}
              {meta?.fb_ad_account_id && (
                <li>
                  <span style={{ fontWeight: 600, color: "#cbd5e1" }}>Ad Account ID:</span>{" "}
                  <code style={{ background: "rgba(255, 255, 255, 0.06)", padding: "3px 6px", borderRadius: 6, color: "#60a5fa" }}>{meta.fb_ad_account_id}</code>
                </li>
              )}
            </ul>
          )}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" }}>
            <button
              onClick={handleSyncBusinessInfo}
              className="btn-gabbar-gold"
              style={{
                padding: "8px 16px",
                fontSize: "12px",
              }}
            >
              Sync Business Info ↗
            </button>

            <button
              onClick={handleEngagementClick}
              className="btn-gabbar-dark"
              style={{
                padding: "8px 14px",
                fontSize: "12px",
                cursor: status === "connected" ? "pointer" : "not-allowed",
              }}
            >
              Page Engagement
            </button>

            <button
              onClick={handleIgInsightsClick}
              className="btn-gabbar-dark"
              style={{
                padding: "8px 14px",
                fontSize: "12px",
                cursor: status === "connected" ? "pointer" : "not-allowed",
              }}
            >
              IG Insights
            </button>

            <button
              onClick={handleAdInsightsClick}
              className="btn-gabbar-dark"
              style={{
                padding: "8px 14px",
                fontSize: "12px",
                cursor: status === "connected" ? "pointer" : "not-allowed",
              }}
            >
              Ad Insights
            </button>

            <button
              onClick={handleBoostClick}
              className="btn-gabbar-gold"
              style={{
                padding: "8px 16px",
                fontSize: "12px",
              }}
            >
              Boost a Post ↗
            </button>

            <button
              onClick={handleDisconnect}
              style={{
                padding: "8px 12px",
                background: "rgba(239, 68, 68, 0.1)",
                color: "#fca5a5",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Disconnect
            </button>
          </div>

          <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 12, lineHeight: 1.4 }}>
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
                <h3 style={{ marginBottom: igData?.username || igData?.id ? "4px" : "16px" }}>
                  {igData?.name ? `${igData.name} ` : ""}Instagram Business Insights
                </h3>
                {igData?.username && (
                  <p style={{ fontSize: 13, color: "#1877F2", fontWeight: 600, marginBottom: "4px" }}>
                    @{igData.username}
                  </p>
                )}
                {igData?.id && (
                  <p style={{ fontSize: 13, color: "#666", marginBottom: "16px" }}>
                    Instagram Business ID: {igData.id}
                  </p>
                )}
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
                <h3 style={{ marginBottom: adData?.account_id ? "4px" : "16px" }}>
                  {adData?.account_name ? `${adData.account_name} ` : ""}Ad Account Insights
                </h3>
                {adData?.account_id && (
                  <p style={{ fontSize: 13, color: "#666", marginBottom: "4px" }}>
                    Ad Account ID: {adData.account_id}
                  </p>
                )}
                {adData?.currency && (
                  <p style={{ fontSize: 13, color: "#666", marginBottom: "16px" }}>
                    Currency: {adData.currency}
                  </p>
                )}
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
                    <p style={{ fontSize: 11, color: "#aaa", marginTop: 4, borderTop: "1px solid #eee", paddingTop: "8px" }}>
                      Data fetched using Facebook Ads API.
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
          className="btn-gabbar-gold"
          style={{
            padding: "11px 22px",
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          Connect Facebook Business ↗
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
  backgroundColor: "rgba(0,0,0,0.75)",
  backdropFilter: "blur(8px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalContentStyle = {
  background: "#0f172a",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  padding: "24px",
  borderRadius: "16px",
  width: "90%",
  maxWidth: "420px",
  boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
  color: "#f8fafc",
  fontFamily: "'Plus Jakarta Sans', sans-serif",
};

const metricRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  padding: "12px 0",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  fontSize: "13px",
  color: "#cbd5e1",
};

const confirmBtnStyle = {
  padding: "8px 18px",
  background: "linear-gradient(135deg, #1877F2, #2563eb)",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  fontWeight: 600,
  fontSize: "13px",
  cursor: "pointer",
  boxShadow: "0 4px 14px rgba(24, 119, 242, 0.35)",
};

const cancelBtnStyle = {
  padding: "8px 16px",
  background: "rgba(255, 255, 255, 0.05)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  color: "#94a3b8",
  borderRadius: "8px",
  fontWeight: 500,
  fontSize: "13px",
  cursor: "pointer",
};
