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
      if (data.connected === true) {
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
    <p style={{ color: "green", fontWeight: 500 }}>
      ✅ Facebook Business Connected
    </p>

    <ul style={{ fontSize: 14, paddingLeft: 18 }}>
      {meta?.fb_business_id && <li>Business Connected</li>}
      {meta?.fb_page_id && <li>Facebook Page Connected</li>}
      {meta?.ig_business_id && <li>Instagram Business Connected</li>}
      {meta?.fb_ad_account_id && <li>Ad Account Connected</li>}
    </ul>
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
