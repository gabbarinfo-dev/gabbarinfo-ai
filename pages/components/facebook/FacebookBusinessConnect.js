"use client";

import { useEffect, useState } from "react";

export default function FacebookBusinessConnect() {
  const [status, setStatus] = useState("idle"); // idle | connected | loading

  useEffect(() => {
  const check = () =>
    fetch("/api/me/connections")
      .then(res => res.json())
      .then(data => {
        if (data?.meta) {
          setStatus("connected");
        }
      });

  check();
  const t = setTimeout(check, 1500); // re-check once after redirect
  return () => clearTimeout(t);
}, []);
  
  const handleConnect = () => {
    setStatus("loading");
    window.location.href = "/api/facebook/connect";
  };

  return (
  <div
    style={{
      marginTop: 16,
      padding: 16,
      borderRadius: 10,
      border: "1px solid #e5e7eb",
      maxWidth: 480,
      background: "#fff",
    }}
  >
    <h3 style={{ marginBottom: 6 }}>Facebook Business</h3>

    {status === "connected" ? (
      <>
        <p style={{ color: "green", marginBottom: 8 }}>
          Status: Connected ✅
        </p>

        <div style={{ fontSize: 14, marginBottom: 10 }}>
          <strong>Connected assets:</strong>
          <ul style={{ marginTop: 6 }}>
            <li>Business</li>
            <li>Ad Account</li>
            <li>Facebook Page</li>
            <li>Instagram Account</li>
          </ul>
        </div>

        <button
          disabled
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #ddd",
            background: "#f5f5f5",
            cursor: "not-allowed",
          }}
        >
          Manage Access (coming soon)
        </button>
      </>
    ) : (
      <>
        <p style={{ fontSize: 14, marginBottom: 10 }}>
          Required to manage Facebook Pages, Instagram accounts, and ad campaigns.
        </p>

        <button
          onClick={handleConnect}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "none",
            background: "#1877f2",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Connect Facebook Business
        </button>
      </>
    )}
  </div>
);
}
