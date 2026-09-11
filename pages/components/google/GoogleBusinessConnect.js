// pages/components/google/GoogleBusinessConnect.js
"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

export default function GoogleBusinessConnect({ onConnectionChange }) {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [hasGmbScope, setHasGmbScope] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [linking, setLinking] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [quotaInfo, setQuotaInfo] = useState(null);

  // Form State for creating a new GMB Profile
  const [formData, setFormData] = useState({
    businessName: "",
    categoryName: "categories/gcid:digital_marketing_agency",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    regionCode: "IN",
    phone: "",
    website: "",
  });

  const fetchGmbStatus = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/gmb/accounts");
      const data = await res.json();

      setHasGmbScope(Boolean(data.hasGmbScope));
      setConnected(Boolean(data.connected));
      setNeedsReauth(Boolean(data.needsReauth));

      if (data.ok) {
        setQuotaInfo(null);
        setLocations(data.locations || []);
        setSelectedLocation(data.selectedLocation || null);
        if (onConnectionChange) onConnectionChange(Boolean(data.connected && data.hasGmbScope));
      } else {
        if (data.quotaRestricted) {
          setQuotaInfo(data);
        } else {
          setError(data.message || "Failed to load Google Business Profile.");
        }
      }
    } catch (err) {
      setError("Network error loading Google Business Profile: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGmbStatus();
  }, []);

  const handleSelectLocation = async (loc) => {
    try {
      const res = await fetch("/api/gmb/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: loc }),
      });
      const data = await res.json();
      if (data.ok) {
        setSelectedLocation(loc);
        setMessage(`Active business profile set to "${loc.title}"`);
        setTimeout(() => setMessage(""), 3500);
      }
    } catch (err) {
      setError("Error selecting location: " + err.message);
    }
  };

  const handleLinkToGoogleAds = async () => {
    if (!selectedLocation) return;
    setLinking(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/google-ads/link-gmb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationName: selectedLocation.name,
          businessName: selectedLocation.title,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage("✅ " + data.message);
        setTimeout(() => setMessage(""), 5000);
      } else {
        setError(data.message || "Failed to link Google Business Profile to Google Ads.");
      }
    } catch (err) {
      setError("Network error during linking: " + err.message);
    } finally {
      setLinking(false);
    }
  };

  const handleCreateLocation = async (e) => {
    e.preventDefault();
    setCreating(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/gmb/create-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage(`🎉 Profile "${formData.businessName}" created successfully!`);
        setShowCreateModal(false);
        fetchGmbStatus();
      } else {
        setError(data.message || "Failed to create Google Business Profile.");
      }
    } catch (err) {
      setError("Error creating profile: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "16px", color: "#94a3b8", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{ width: 16, height: 16, border: "2px solid rgba(16, 185, 129, 0.2)", borderTopColor: "#10b981", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        Checking Google Business Profile connection…
      </div>
    );
  }

  // State 1: Needs permission / Re-auth
  if (needsReauth || !hasGmbScope) {
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
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(16, 185, 129, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
            📍
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#f8fafc" }}>
              Google Business Profile (GMB)
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#94a3b8", lineHeight: 1.4 }}>
              Connect your Google Business listing to manage reviews, local search presence, and sync location extensions with Google Ads.
            </p>
          </div>
        </div>

        <div style={{ padding: "14px", borderRadius: "10px", background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", marginBottom: "14px", fontSize: "13px", color: "#6ee7b7" }}>
          ⚡ <strong>Permission Update Available:</strong> Click below to authorize Google Business Profile management.
        </div>

        <button
          onClick={() => signIn("google")}
          className="btn-gabbar-primary"
          style={{
            padding: "11px 22px",
            fontSize: "13px",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>Connect Google Business Profile ↗</span>
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
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(16, 185, 129, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
            📍
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#f8fafc" }}>
                Google Business Profile
              </h3>
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
                Connected
              </span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#94a3b8" }}>
              Manage local visibility, map presence, and local ad synchronization.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-gabbar-primary"
            style={{
              padding: "7px 14px",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            ➕ Create New Profile
          </button>
          <button
            onClick={fetchGmbStatus}
            className="btn-gabbar-secondary"
            style={{
              padding: "7px 14px",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#34d399", borderRadius: "10px", fontSize: "13px", marginBottom: "14px" }}>
          {message}
        </div>
      )}

      {quotaInfo && (
        <div style={{ padding: "16px", borderRadius: "12px", background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.3)", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#fbbf24", fontWeight: 700, fontSize: "14px", marginBottom: "6px" }}>
            <span>⚡</span> Google Business Profile API Notice
          </div>
          <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#fde68a", lineHeight: 1.5 }}>
            {quotaInfo.message}
          </p>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            <a
              href={quotaInfo.quotaUrl || "https://developers.google.com/my-business/content/prereqs#request-access"}
              target="_blank"
              rel="noreferrer"
              className="btn-gabbar-primary"
              style={{ padding: "8px 16px", fontSize: "12px", textDecoration: "none" }}
            >
              Request Google Business Profile Quota ↗
            </a>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-gabbar-secondary"
              style={{ padding: "8px 16px", fontSize: "12px", cursor: "pointer" }}
            >
              ➕ Create New Profile via AI
            </button>
          </div>
        </div>
      )}

      {error && !quotaInfo && (
        <div style={{ padding: "10px 14px", background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#fca5a5", borderRadius: "10px", fontSize: "13px", marginBottom: "14px" }}>
          ⚠️ {error}
        </div>
      )}

      {/* Locations Display */}
      {locations.length === 0 ? (
        <div style={{ padding: "20px", background: "rgba(8, 11, 17, 0.6)", borderRadius: "10px", border: "1px dashed rgba(255, 255, 255, 0.12)", textAlign: "center", fontSize: "13px", color: "#94a3b8" }}>
          <div style={{ fontSize: "24px", marginBottom: "8px" }}>🏪</div>
          <strong style={{ display: "block", marginBottom: "6px", fontSize: "14px", color: "#f8fafc" }}>
            No Google Business Profile Locations Found
          </strong>
          <p style={{ margin: "0 0 14px", lineHeight: 1.5 }}>
            You are connected to Google, but don't have any registered business locations yet.
            <br />
            You can create a brand new Google Business profile right here!
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-gabbar-primary"
            style={{ padding: "8px 18px", fontSize: "13px" }}
          >
            ➕ Create Business Profile via AI
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {locations.map((loc) => {
            const isSelected = selectedLocation?.name === loc.name;
            const address = loc.storefrontAddress?.addressLines?.join(", ") || loc.storefrontAddress?.locality || "Address on file";

            return (
              <div
                key={loc.name}
                style={{
                  padding: "14px 16px",
                  borderRadius: "12px",
                  background: isSelected ? "rgba(16, 185, 129, 0.08)" : "rgba(15, 23, 42, 0.5)",
                  border: isSelected ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(255, 255, 255, 0.06)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <strong style={{ color: "#f8fafc", fontSize: "14px" }}>{loc.title}</strong>
                    {isSelected && (
                      <span style={{ fontSize: "10px", padding: "1px 6px", background: "#10b981", color: "#fff", borderRadius: "999px", fontWeight: 700 }}>
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                    📍 {address} {loc.phoneNumbers?.primaryPhone ? `· 📞 ${loc.phoneNumbers.primaryPhone}` : ""}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  {!isSelected ? (
                    <button
                      onClick={() => handleSelectLocation(loc)}
                      className="btn-gabbar-secondary"
                      style={{ padding: "6px 14px", fontSize: "12px" }}
                    >
                      Set Active
                    </button>
                  ) : (
                    <button
                      onClick={handleLinkToGoogleAds}
                      disabled={linking}
                      className="btn-gabbar-primary"
                      style={{
                        padding: "6px 14px",
                        fontSize: "12px",
                        opacity: linking ? 0.7 : 1,
                        cursor: linking ? "wait" : "pointer",
                      }}
                    >
                      {linking ? "Linking…" : "🔗 Link to Google Ads"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE GMB PROFILE MODAL */}
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
              maxWidth: "500px",
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", color: "#f8fafc", fontWeight: 700 }}>
                📍 Create Google Business Profile
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: "none", border: "none", color: "#94a3b8", fontSize: "20px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLocation} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
                  Business Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Digital Marketing"
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
                  Category *
                </label>
                <select
                  value={formData.categoryName}
                  onChange={(e) => setFormData({ ...formData, categoryName: e.target.value })}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                >
                  <option value="categories/gcid:digital_marketing_agency">Digital Marketing Agency</option>
                  <option value="categories/gcid:marketing_agency">Marketing Agency</option>
                  <option value="categories/gcid:advertising_agency">Advertising Agency</option>
                  <option value="categories/gcid:software_company">Software Company</option>
                  <option value="categories/gcid:consultant">Consultant</option>
                  <option value="categories/gcid:restaurant">Restaurant</option>
                  <option value="categories/gcid:retail_store">Retail Store</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
                  Street Address *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 102 Business Hub, Main Street"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mumbai"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
                    Postal Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 400001"
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +91 9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
                    Website
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-gabbar-primary"
                  style={{ flex: 1, padding: "12px", fontSize: "13px" }}
                >
                  {creating ? "Submitting to Google…" : "🚀 Create Listing on Google"}
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
          </div>
        </div>
      )}
    </div>
  );
}
