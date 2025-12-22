"use client";

import { useEffect, useState } from "react";

export default function FacebookBusinessConnect() {
  const [status, setStatus] = useState("idle"); // idle | connected | loading
const [meta, setMeta] = useState(null);
  useEffect(() => {
  fetch("/api/me/connections")
    .then(res => res.json())
    .then(data => {
      if (
        data?.meta &&
        (
          data.meta.fb_business_id ||
          data.meta.fb_ad_account_id ||
          data.meta.fb_page_id ||
          data.meta.ig_business_id
        )
      ) {
        setStatus("connected");
        setMeta(data.meta);
      }
    })
    .catch(() => {});
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
          {meta.fb_business_id && <li>Business ID: {meta.fb_business_id}</li>}
          {meta.fb_ad_account_id && <li>Ad Account ID: {meta.fb_ad_account_id}</li>}
          {meta.fb_page_id && <li>Facebook Page ID: {meta.fb_page_id}</li>}
          {meta.ig_business_id && <li>Instagram Business ID: {meta.ig_business_id}</li>}
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
          style={{
            padding: "10px 14px",
            backgroundColor: "#1877F2",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer"
          }}
        >
          Connect Facebook Business
        </button>
      </>
    )}
  </div>
);
}
