"use client";

import { useEffect, useState } from "react";

export default function FacebookBusinessConnect() {
  const [status, setStatus] = useState("idle"); // idle | connected | loading

  useEffect(() => {
    fetch("/api/me/connections")
      .then(res => res.json())
      .then(data => {
        if (data?.facebook_business === true) {
          setStatus("connected");
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

      <p style={{ fontSize: "14px", color: "#555", marginBottom: "12px" }}>
        Required to manage Facebook Pages, Instagram accounts, and ad campaigns.
      </p>

      {status === "connected" ? (
        <p style={{ color: "green", fontWeight: "500" }}>
          ✅ Facebook Business connected
        </p>
      ) : (
        <button
          onClick={handleConnect}
          disabled={status === "loading"}
          style={{
            padding: "10px 14px",
            backgroundColor: "#1877F2",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer"
          }}
        >
          {status === "loading"
            ? "Redirecting…"
            : "Connect Facebook Business"}
        </button>
      )}
    </div>
  );
}
