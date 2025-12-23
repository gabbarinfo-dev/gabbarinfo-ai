"use client";

import { useEffect, useState } from "react";

export default function FacebookBusinessConnect() {
  const [status, setStatus] = useState("idle"); // idle | connected | loading
const [meta, setMeta] = useState(null);
  const isLocked = status === "connected";
  useEffect(() => {
  fetch("/api/meta/status")
    .then(res => res.json())
    .then(data => {
      if (data?.meta?.updated_at) {
        setStatus("connected");
        setMeta(data.meta);
      } else {
        setStatus("idle");
      }
    })
    .catch(() => setStatus("idle"));
}, []);
  
  const handleConnect = () => {
    setStatus("loading");
    window.location.href = "/api/facebook/connect";
  };

  return (
  <div
    style={{
      marginTop: "20px",
      padding: "16px",
      border: "1px solid #e5e7eb",
      borderRadius: "8px",
      maxWidth: "520px"
    }}
  >
    <h3 style={{ marginBottom: "6px" }}>Facebook Business</h3>

    {status === "connected" ? (
      <>
        <p style={{ color: "green", fontWeight: 500, marginBottom: 8 }}>
          ✅ Facebook Business Connected
        </p>

        <ul style={{ fontSize: 14, color: "#333", paddingLeft: 18 }}>
  <li>Ad Account ID: {meta.fb_ad_account_id}</li>
</ul>
            <a
  href="https://www.facebook.com/settings/business_integrations"
  target="_blank"
  rel="noopener noreferrer"
  style={{
    display: "inline-block",
    marginTop: "10px",
    fontSize: "14px",
    color: "#1877F2",
    textDecoration: "none",
    fontWeight: 500
  }}
>
  Manage Access →
</a>
      </>
    ) : (
      <>
        <p style={{ fontSize: 14, color: "#555", marginBottom: 12 }}>
          Required to manage Facebook Pages, Instagram accounts, and ad campaigns.
        </p>

       <button
  onClick={handleConnect}
  disabled={status === "connected" || status === "loading"}
  style={{
    padding: "10px 14px",
    backgroundColor: status === "connected" ? "#9ca3af" : "#1877F2",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: status === "connected" ? "not-allowed" : "pointer",
    opacity: status === "connected" ? 0.7 : 1
  }}
>
  {status === "connected"
    ? "Facebook Business Linked"
    : status === "loading"
    ? "Redirecting…"
    : "Connect Facebook Business"}
</button>
{status === "connected" && (
  <p style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
    This Facebook Business is already linked to your account.
  </p>
)}
      </>
    )}
  </div>
);
}
