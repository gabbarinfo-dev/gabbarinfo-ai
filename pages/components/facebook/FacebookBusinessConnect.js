"use client";

import { useEffect, useState } from "react";
import BoostModal from "./meta/BoostModal";
import BrandAssetPairingModal from "../brands/BrandAssetPairingModal";

export default function FacebookBusinessConnect({ onOpenSocialPlanner }) {
  const [status, setStatus] = useState("idle"); // idle | connected | loading
  const [meta, setMeta] = useState(null);
  const [allMetaConnections, setAllMetaConnections] = useState({});
  const [selectedBrand, setSelectedBrand] = useState("");
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [showConnectWarningModal, setShowConnectWarningModal] = useState(false);
  const [showPairingModal, setShowPairingModal] = useState(false);
  const isLocked = status === "connected";

  useEffect(() => {
    const interval = setInterval(() => {
      fetch("/api/meta/status")
        .then(res => res.json())
        .then(data => {
          if (data.connected) {
            setStatus("connected");
            setMeta(data.meta);
            setAllMetaConnections(data.allMetaConnections || {});
            if (data.connectedBrands?.length > 0 && !selectedBrand) {
              setSelectedBrand(data.connectedBrands[0]);
            }
            clearInterval(interval);
          }
        });
    }, 1000);

    return () => clearInterval(interval);
  }, [selectedBrand]);

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
      fb_catalog_id: data.fb_catalog_id,
      fb_pixel_id: data.fb_pixel_id,
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
    const activeProfile = allMetaConnections[selectedBrand] || meta;
    try {
      const res = await fetch("/api/meta/page-engagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: activeProfile?.businessName || activeProfile?.pageName,
          pageId: activeProfile?.pageId,
        }),
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
    const activeProfile = allMetaConnections[selectedBrand] || meta;
    try {
      const res = await fetch("/api/meta/instagram-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: activeProfile?.businessName || activeProfile?.pageName,
          igBusinessId: activeProfile?.igId,
        }),
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
  const [adError, setAdError] = useState(null);
  const [accessibleAds, setAccessibleAds] = useState([]);
  const [selectedAdAccount, setSelectedAdAccount] = useState("");
  const [showAdConsentModal, setShowAdConsentModal] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);

  const handleAdInsightsClick = () => {
    setShowAdConsentModal(true);
  };

  const executeFetchAdInsights = async (customAdId = null) => {
    setAdLoading(true);
    setAdError(null);
    const activeProfile = allMetaConnections[selectedBrand] || meta;
    const adToUse = customAdId || selectedAdAccount || activeProfile?.adAccountId;

    try {
      const res = await fetch("/api/meta/ad-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: activeProfile?.businessName || activeProfile?.pageName,
          adAccountId: adToUse,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setAdData(data.data);
        setAdError(null);
        if (data.accessibleAdAccounts?.length) setAccessibleAds(data.accessibleAdAccounts);
      } else {
        setAdData(null);
        setAdError(data.message || "Permissions pending or restricted on ad account");
        if (data.accessibleAdAccounts?.length) {
          setAccessibleAds(data.accessibleAdAccounts);
          if (!selectedAdAccount && data.accessibleAdAccounts.length > 0) {
            setSelectedAdAccount(data.accessibleAdAccounts[0].id);
          }
        }
      }
    } catch (e) {
      setAdError(e.message || "Network error fetching ad insights");
    } finally {
      setAdLoading(false);
    }
  };

  const handleAdConsentYes = async () => {
    setShowAdConsentModal(false);
    setShowAdInsightsModal(true);
    await executeFetchAdInsights();
  };

  const handleSyncAllMetaAssets = async () => {
    setSyncingAll(true);
    try {
      const res = await fetch("/api/meta/sync-business-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.ok) {
        if (data.allMetaConnections) {
          setAllMetaConnections(data.allMetaConnections);
        }
        if (data.connectedBrands?.length > 0) {
          if (!selectedBrand || !data.connectedBrands.includes(selectedBrand)) {
            setSelectedBrand(data.connectedBrands[0]);
          }
        }
        // Refresh status
        fetch("/api/meta/status")
          .then(r => r.json())
          .then(st => {
            if (st.connected) {
              setMeta(st.meta);
              setAllMetaConnections(st.allMetaConnections || {});
            }
          });
      } else {
        alert("Sync warning: " + (data.error || data.message));
      }
    } catch (e) {
      console.warn("Failed to sync Meta assets:", e);
    } finally {
      setSyncingAll(false);
    }
  };

  const handleBoostClick = () => {
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

          {/* Dynamic Brand Profile Switcher */}
          <div style={{ marginBottom: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px", flexWrap: "wrap", gap: 6 }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8" }}>
                Active Brand Profile:
              </label>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={handleSyncAllMetaAssets}
                  disabled={syncingAll}
                  style={{
                    background: "rgba(56, 189, 248, 0.12)",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                    borderRadius: 6,
                    color: "#38bdf8",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: syncingAll ? "not-allowed" : "pointer",
                    padding: "3px 8px",
                  }}
                >
                  {syncingAll ? "🔄 Syncing..." : "🔄 Sync All Pages"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPairingModal(true)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#a78bfa",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: 0,
                    textDecoration: "underline",
                  }}
                >
                  ⚙️ Pair Assets ↗
                </button>
              </div>
            </div>
            {Object.keys(allMetaConnections).length > 0 ? (
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  background: "#0d111c",
                  border: "1px solid rgba(255, 255, 255, 0.16)",
                  color: "#38bdf8",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                {Object.keys(allMetaConnections).map((bKey) => {
                  const b = allMetaConnections[bKey];
                  return (
                    <option key={bKey} value={bKey}>
                      ✓ {b.businessName || b.pageName} ({b.igUsername ? `@${b.igUsername}` : `Page ID: ${b.pageId}`})
                    </option>
                  );
                })}
              </select>
            ) : (
              <div style={{ fontSize: 12, color: "#94a3b8", background: "rgba(255,255,255,0.04)", padding: "8px 12px", borderRadius: 6 }}>
                Primary: <strong style={{ color: "#38bdf8" }}>{meta?.business_name || "Connected Page"}</strong>
              </div>
            )}
          </div>

          {(() => {
            const activeProfile = allMetaConnections[selectedBrand] || meta;
            const bId = activeProfile?.businessId || meta?.fb_business_id;
            const pId = activeProfile?.pageId || meta?.fb_page_id;
            const pName = activeProfile?.pageName || activeProfile?.businessName;
            const igUser = activeProfile?.igUsername;
            const adAcc = activeProfile?.adAccountId || meta?.fb_ad_account_id;

            return (
              <ul style={{ fontSize: 13, paddingLeft: 0, listStyleType: "none", margin: "10px 0 14px", color: "#94a3b8" }}>
                {pName && (
                  <li style={{ marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: "#cbd5e1" }}>Page Name:</span>{" "}
                    <strong style={{ color: "#38bdf8" }}>{pName}</strong>
                  </li>
                )}
                {bId && (
                  <li style={{ marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: "#cbd5e1" }}>Business ID:</span>{" "}
                    <code style={{ background: "rgba(255, 255, 255, 0.06)", padding: "3px 6px", borderRadius: 6, color: "#60a5fa" }}>{bId}</code>
                  </li>
                )}
                {pId && (
                  <li style={{ marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: "#cbd5e1" }}>Page ID:</span>{" "}
                    <code style={{ background: "rgba(255, 255, 255, 0.06)", padding: "3px 6px", borderRadius: 6, color: "#60a5fa" }}>{pId}</code>
                  </li>
                )}
                {igUser && (
                  <li style={{ marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: "#cbd5e1" }}>Instagram:</span>{" "}
                    <code style={{ background: "rgba(255, 255, 255, 0.06)", padding: "3px 6px", borderRadius: 6, color: "#e879f9" }}>@{igUser}</code>
                  </li>
                )}
                {adAcc && (
                  <li style={{ marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: "#cbd5e1" }}>Ad Account ID:</span>{" "}
                    <code style={{ background: "rgba(255, 255, 255, 0.06)", padding: "3px 6px", borderRadius: 6, color: "#60a5fa" }}>{adAcc}</code>
                  </li>
                )}
                {meta?.fb_catalog_id && (
                  <li style={{ marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: "#cbd5e1" }}>Catalog ID:</span>{" "}
                    <code style={{ background: "rgba(255, 255, 255, 0.06)", padding: "3px 6px", borderRadius: 6, color: "#38bdf8" }}>{meta.fb_catalog_id}</code>
                  </li>
                )}
                {meta?.fb_pixel_id && (
                  <li style={{ marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: "#cbd5e1" }}>Pixel ID:</span>{" "}
                    <code style={{ background: "rgba(255, 255, 255, 0.06)", padding: "3px 6px", borderRadius: 6, color: "#34d399" }}>{meta.fb_pixel_id}</code>
                  </li>
                )}
              </ul>
            );
          })()}
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
              onClick={onOpenSocialPlanner}
              className="btn-gabbar-primary"
              style={{
                padding: "8px 16px",
                fontSize: "12px",
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#042416",
                fontWeight: 800,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 0 20px rgba(16, 185, 129, 0.3)",
              }}
            >
              📱 Social Planner ↗
            </button>

            <button
              onClick={() => setShowBoostModal(true)}
              className="btn-gabbar-secondary"
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
              <div style={{ ...modalContentStyle, maxWidth: 520, background: "#0f172a", border: "1px solid rgba(255, 255, 255, 0.12)", color: "#f8fafc" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>
                    📊 Ad Account Performance
                  </h3>
                  <button
                    onClick={() => setShowAdInsightsModal(false)}
                    style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 20, cursor: "pointer" }}
                  >
                    ✕
                  </button>
                </div>

                {/* Account Switcher if multiple accessible accounts */}
                {accessibleAds.length > 1 && (
                  <div style={{ marginBottom: 14, background: "rgba(255, 255, 255, 0.04)", padding: 10, borderRadius: 8 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 4 }}>
                      Select Ad Account:
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <select
                        value={selectedAdAccount}
                        onChange={(e) => {
                          setSelectedAdAccount(e.target.value);
                          executeFetchAdInsights(e.target.value);
                        }}
                        style={{
                          flex: 1,
                          padding: "6px 10px",
                          borderRadius: 6,
                          background: "#0d111c",
                          border: "1px solid rgba(255,255,255,0.2)",
                          color: "#38bdf8",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {accessibleAds.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name || a.id} ({a.currency || "INR"})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => executeFetchAdInsights(selectedAdAccount)}
                        disabled={adLoading}
                        style={{
                          background: "#2563eb",
                          border: "none",
                          borderRadius: 6,
                          color: "#fff",
                          padding: "6px 12px",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {adLoading ? "..." : "Load"}
                      </button>
                    </div>
                  </div>
                )}

                {adLoading ? (
                  <div style={{ padding: "24px 0", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                    <div style={{ width: 22, height: 22, border: "2px solid rgba(56, 189, 248, 0.2)", borderTopColor: "#38bdf8", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 10px" }} />
                    Fetching ad performance from Meta Ads API...
                  </div>
                ) : adError ? (
                  <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 10, padding: 14, color: "#fca5a5", fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, color: "#f87171", marginBottom: 4 }}>
                      ⚠️ Ad Account Notice
                    </div>
                    {adError.includes("#200") ? (
                      <div>
                        The connected Facebook user token does not have <code>ads_read</code> permission on this specific Ad Account.
                        {accessibleAds.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            You have access to <strong>{accessibleAds.length}</strong> other Ad Account(s). Choose one above to view its live metrics.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>{adError}</div>
                    )}
                  </div>
                ) : adData ? (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ background: "rgba(255, 255, 255, 0.05)", padding: "10px 14px", borderRadius: 8, marginBottom: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8" }}>{adData.account_name || "Ad Account"}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>ID: {adData.account_id} · Currency: {adData.currency || "INR"}</div>
                    </div>

                    {adData.campaign_name ? (
                      <>
                        <div style={{ marginBottom: 12, padding: "10px 14px", background: "rgba(56, 189, 248, 0.08)", border: "1px solid rgba(56, 189, 248, 0.2)", borderRadius: 8 }}>
                          <span style={{ fontSize: 11, color: "#94a3b8", display: "block", textTransform: "uppercase", fontWeight: 700 }}>Latest Campaign</span>
                          <span style={{ fontWeight: 700, color: "#f8fafc", fontSize: 14 }}>{adData.campaign_name}</span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div style={{ background: "rgba(255, 255, 255, 0.04)", padding: 12, borderRadius: 8 }}>
                            <div style={{ fontSize: 11, color: "#94a3b8" }}>Impressions</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "#38bdf8", marginTop: 4 }}>{(adData.impressions || 0).toLocaleString()}</div>
                          </div>
                          <div style={{ background: "rgba(255, 255, 255, 0.04)", padding: 12, borderRadius: 8 }}>
                            <div style={{ fontSize: 11, color: "#94a3b8" }}>Lifetime Reach</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "#34d399", marginTop: 4 }}>{(adData.reach || 0).toLocaleString()}</div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p style={{ color: "#94a3b8", fontSize: 13 }}>No campaigns currently active in this ad account.</p>
                    )}
                  </div>
                ) : null}

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
                  <button onClick={() => setShowAdInsightsModal(false)} className="btn-gabbar-dark" style={{ padding: "8px 18px", fontSize: 13 }}>Close</button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <button
            onClick={() => setShowConnectWarningModal(true)}
            className="btn-gabbar-gold"
            style={{
              padding: "11px 22px",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Connect Facebook Business ↗
          </button>

          {/* PRE-CONNECTION ASSET SLOT WARNING MODAL */}
          {showConnectWarningModal && (
            <div style={modalOverlayStyle}>
              <div style={{ ...modalContentStyle, maxWidth: "460px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 22 }}>⚠️</span>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#f8fafc" }}>
                    Confirm Primary Brand Connection
                  </h3>
                </div>
                <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.5, marginBottom: 14 }}>
                  You are about to link your Facebook Page & Instagram account with GabbarInfo AI.
                </p>
                <div
                  style={{
                    background: "rgba(245, 158, 11, 0.1)",
                    border: "1px solid rgba(245, 158, 11, 0.25)",
                    borderRadius: 12,
                    padding: "14px",
                    marginBottom: 18,
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: "#fef08a",
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 4, color: "#fbbf24" }}>
                    Important Brand Slot Policy:
                  </div>
                  • Connecting registers your Facebook Page & Instagram account as your <strong>official 1st Brand Pair</strong>.<br />
                  • All social autopilot posts, social planner schedules, and Meta Ads will be deployed to this verified pair.<br />
                  • Single-brand plans lock this asset slot to prevent cycling between multiple client businesses.
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button
                    onClick={() => setShowConnectWarningModal(false)}
                    style={cancelBtnStyle}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowConnectWarningModal(false);
                      handleConnect();
                    }}
                    style={confirmBtnStyle}
                  >
                    ✓ Proceed to Meta Login ➔
                  </button>
                </div>
              </div>
            </div>
          )}

        </>
      )}

      {showPairingModal && (
        <BrandAssetPairingModal
          onClose={() => setShowPairingModal(false)}
          onSaved={() => {
            fetch("/api/meta/status")
              .then(r => r.json())
              .then(d => {
                if (d.connected) {
                  setMeta(d.meta);
                  setAllMetaConnections(d.allMetaConnections || {});
                }
              });
          }}
        />
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
