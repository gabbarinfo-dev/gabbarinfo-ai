"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

export default function BrandAssetPairingModal({ onClose, onSaved }) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [metaStatus, setMetaStatus] = useState(null);
  const [connectedWebsites, setConnectedWebsites] = useState([]);
  const [pairings, setPairings] = useState([]);

  useEffect(() => {
    setMounted(true);
    loadAssets();
  }, []);

  const loadAssets = async () => {
    setLoading(true);
    try {
      const [metaRes, wpRes, shopifyRes] = await Promise.all([
        fetch("/api/meta/status").then((r) => r.json()).catch(() => ({})),
        fetch("/api/wordpress/sync?action=get-connection").then((r) => r.json()).catch(() => ({})),
        fetch("/api/shopify/sync?action=get-connection").then((r) => r.json()).catch(() => ({})),
      ]);

      setMetaStatus(metaRes);

      // Collect available websites (WordPress and Shopify)
      const sites = [];
      if (wpRes.connection?.siteUrl) {
        sites.push({
          type: "wordpress",
          name: wpRes.connection.businessName || "WordPress Site",
          url: wpRes.connection.siteUrl,
        });
      }
      if (wpRes.allConnections) {
        Object.keys(wpRes.allConnections).forEach((k) => {
          const c = wpRes.allConnections[k];
          if (c.siteUrl && !sites.find((s) => s.url === c.siteUrl)) {
            sites.push({
              type: "wordpress",
              name: c.businessName || k,
              url: c.siteUrl,
            });
          }
        });
      }

      // Collect connected Shopify stores
      if (shopifyRes.allConnections && Array.isArray(shopifyRes.allConnections)) {
        shopifyRes.allConnections.forEach((s) => {
          const rawUrl = s.domain || s.myshopify_domain || s.shop || "";
          const fullUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
          if (!sites.find((item) => item.url === fullUrl)) {
            sites.push({
              type: "shopify",
              name: s.shopName || s.shop || "Shopify Store",
              url: fullUrl,
            });
          }
        });
      } else if (shopifyRes.connection) {
        const s = shopifyRes.connection;
        const rawUrl = s.domain || s.myshopify_domain || s.shop || "";
        const fullUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
        if (!sites.find((item) => item.url === fullUrl)) {
          sites.push({
            type: "shopify",
            name: s.shopName || s.name || "Shopify Store",
            url: fullUrl,
          });
        }
      }

      setConnectedWebsites(sites);

      // Helper to find closest site match by name
      const findBestSiteMatch = (name = "") => {
        const clean = String(name).toLowerCase().replace(/[^a-z0-9]/g, "");
        return sites.find((s) => {
          const sClean = String(s.name).toLowerCase().replace(/[^a-z0-9]/g, "");
          const uClean = String(s.url).toLowerCase().replace(/[^a-z0-9]/g, "");
          return clean && (sClean.includes(clean) || clean.includes(sClean) || uClean.includes(clean));
        });
      };

      // Build initial pairings from allMetaConnections or detected assets
      const existing = metaRes.allMetaConnections || {};
      const brandKeys = Object.keys(existing);

      if (brandKeys.length > 0) {
        setPairings(
          brandKeys.map((key) => {
            const b = existing[key];
            const nameToMatch = b.businessName || b.pageName || key;
            const autoSite = findBestSiteMatch(nameToMatch);
            const chosenUrl = b.websiteUrl || b.website || autoSite?.url || "";
            const chosenType = b.websiteType || autoSite?.type || "wordpress";
            return {
              brandKey: key,
              businessName: nameToMatch,
              pageId: b.pageId,
              pageName: b.pageName || b.businessName,
              pageToken: b.pageToken,
              igId: b.igId || null,
              igUsername: b.igUsername || null,
              adAccountId: b.adAccountId || null,
              adAccountName: b.adAccountName || null,
              websiteUrl: chosenUrl,
              websiteType: chosenType,
            };
          })
        );
      } else if (metaRes.meta) {
        const autoSite = findBestSiteMatch(metaRes.meta.business_name);
        setPairings([
          {
            brandKey: "default",
            businessName: metaRes.meta.business_name || "Primary Brand",
            pageId: metaRes.meta.fb_page_id,
            pageName: metaRes.meta.business_name || "Facebook Page",
            pageToken: metaRes.meta.fb_page_access_token,
            igId: metaRes.meta.ig_business_id,
            igUsername: null,
            adAccountId: metaRes.meta.fb_ad_account_id,
            adAccountName: null,
            websiteUrl: autoSite?.url || "",
            websiteType: autoSite?.type || "wordpress",
          },
        ]);
      }
    } catch (err) {
      console.error("Failed to load pairing assets:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePairing = (index, field, value) => {
    setPairings((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/meta/pair-brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairings }),
      });
      const data = await res.json();
      if (data.ok) {
        alert("✅ Brand asset bundles saved successfully! SEO Suite and Social Pilot are now synchronized.");
        if (onSaved) onSaved(data.savedProfiles);
        onClose();
      } else {
        alert("Failed to save: " + (data.message || "Unknown error"));
      }
    } catch (err) {
      alert("Error saving pairings: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const modalNode = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "rgba(3, 7, 18, 0.88)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 860,
          maxHeight: "92vh",
          background: "linear-gradient(180deg, rgba(16, 22, 34, 0.98) 0%, rgba(8, 11, 17, 0.99) 100%)",
          border: "1px solid rgba(255, 255, 255, 0.14)",
          borderRadius: 20,
          boxShadow: "0 30px 90px rgba(0,0,0,0.9), 0 0 60px rgba(56, 189, 248, 0.12)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          color: "#f8fafc",
          fontFamily: "Plus Jakarta Sans, sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "rgba(255, 255, 255, 0.02)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%)",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
              }}
            >
              🏢
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#fff" }}>
                Brand Profile & Asset Bundling Wizard
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94a3b8" }}>
                Bind Facebook Pages, Instagram Accounts, Ad Accounts, and Websites together without cross-contamination.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "1px solid rgba(255, 255, 255, 0.1)",
              background: "rgba(255, 255, 255, 0.04)",
              color: "#94a3b8",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "24px", overflowY: "auto", flex: "1 1 auto", minHeight: 0 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
              <div style={{ fontSize: 24, marginBottom: 10 }}>⚡</div>
              Analyzing connected Meta and Website assets...
            </div>
          ) : pairings.length === 0 ? (
            <div style={{ textAlign: "center", padding: "50px 20px", color: "#94a3b8" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
              <h4 style={{ margin: "0 0 8px", color: "#fff", fontSize: 16 }}>No Meta Assets Found</h4>
              <p style={{ margin: 0, fontSize: 13, maxWidth: 420, marginInline: "auto" }}>
                Please connect your Facebook Business account first. Once connected, your Pages, Instagram accounts, and Ad accounts will appear here for pairing.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {pairings.map((pairing, index) => (
                <div
                  key={index}
                  style={{
                    background: "rgba(13, 20, 35, 0.8)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: 16,
                    padding: "20px 22px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: "rgba(56, 189, 248, 0.15)",
                          color: "#38bdf8",
                          border: "1px solid rgba(56, 189, 248, 0.3)",
                        }}
                      >
                        BRAND #{index + 1}
                      </span>
                      <strong style={{ fontSize: 16, color: "#fff" }}>
                        {pairing.businessName || pairing.pageName}
                      </strong>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                    {/* Facebook Page */}
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 6 }}>
                        📘 Facebook Page (Verified):
                      </label>
                      <div
                        style={{
                          background: "#080c14",
                          border: "1px solid rgba(255, 255, 255, 0.12)",
                          borderRadius: 8,
                          padding: "8px 12px",
                          fontSize: 13,
                          color: "#38bdf8",
                          fontWeight: 700,
                        }}
                      >
                        {pairing.pageName} <span style={{ fontSize: 11, color: "#64748b" }}>({pairing.pageId})</span>
                      </div>
                    </div>

                    {/* Instagram Account */}
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 6 }}>
                        📸 Connected Instagram:
                      </label>
                      <div
                        style={{
                          background: "#080c14",
                          border: "1px solid rgba(255, 255, 255, 0.12)",
                          borderRadius: 8,
                          padding: "8px 12px",
                          fontSize: 13,
                          color: pairing.igUsername ? "#e879f9" : "#64748b",
                          fontWeight: 700,
                        }}
                      >
                        {pairing.igUsername ? `@${pairing.igUsername}` : pairing.igId ? `ID: ${pairing.igId}` : "Not Linked to Page"}
                      </div>
                    </div>

                    {/* Ad Account */}
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 6 }}>
                        📊 Target Ad Account:
                      </label>
                      <input
                        type="text"
                        value={pairing.adAccountId || ""}
                        onChange={(e) => handleUpdatePairing(index, "adAccountId", e.target.value)}
                        placeholder="e.g. act_2033629850829647"
                        style={{
                          width: "100%",
                          background: "#080c14",
                          border: "1px solid rgba(255, 255, 255, 0.12)",
                          borderRadius: 8,
                          padding: "8px 12px",
                          fontSize: 13,
                          color: "#fff",
                          outline: "none",
                        }}
                      />
                    </div>

                    {/* Website Binding */}
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 6 }}>
                        🌐 Bound Website (Blog & Cross-Post Target):
                      </label>
                      {connectedWebsites.length > 0 ? (
                        <select
                          value={pairing.websiteUrl || ""}
                          onChange={(e) => {
                            const chosenUrl = e.target.value;
                            const siteObj = connectedWebsites.find((s) => s.url === chosenUrl);
                            setPairings((prev) => {
                              const copy = [...prev];
                              copy[index] = {
                                ...copy[index],
                                websiteUrl: chosenUrl,
                                websiteType: siteObj?.type || "wordpress",
                              };
                              return copy;
                            });
                          }}
                          style={{
                            width: "100%",
                            background: "#080c14",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            borderRadius: 8,
                            padding: "8px 12px",
                            fontSize: 13,
                            color: "#34d399",
                            fontWeight: 700,
                            outline: "none",
                            cursor: "pointer",
                          }}
                        >
                          <option value="">-- Select Website --</option>
                          {connectedWebsites.map((site, sIdx) => (
                            <option key={sIdx} value={site.url}>
                              {site.type.toUpperCase()}: {site.name} ({site.url.replace(/^https?:\/\//, "")})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={pairing.websiteUrl || ""}
                          onChange={(e) => handleUpdatePairing(index, "websiteUrl", e.target.value)}
                          placeholder="e.g. https://divinecng.com"
                          style={{
                            width: "100%",
                            background: "#080c14",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            borderRadius: 8,
                            padding: "8px 12px",
                            fontSize: 13,
                            color: "#fff",
                            outline: "none",
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "rgba(255, 255, 255, 0.02)",
          }}
        >
          <span style={{ fontSize: 12, color: "#64748b" }}>
            🔒 Strict Brand Isolation: Client A's posts will never syndicate to Client B's channels.
          </span>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid rgba(255, 255, 255, 0.12)",
                background: "transparent",
                color: "#94a3b8",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || pairings.length === 0}
              style={{
                padding: "8px 20px",
                borderRadius: 8,
                border: "none",
                background: "linear-gradient(135deg, #38bdf8 0%, #10b981 100%)",
                color: "#080c14",
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 0 20px rgba(56, 189, 248, 0.3)",
              }}
            >
              {saving ? "Saving Bundles..." : "Confirm & Save Brand Profiles ✓"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (mounted && typeof document !== "undefined") {
    return createPortal(modalNode, document.body);
  }
  return modalNode;
}
