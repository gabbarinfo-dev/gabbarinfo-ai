"use client";

import { useState, useRef } from "react";
import { createPortal } from "react-dom";

export default function BrandLogoModal({
  isOpen,
  onClose,
  brandName,
  currentLogoUrl,
  onLogoUpdated,
}) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleProcessFile = async (file) => {
    if (!file) return;
    setErrorMsg("");

    const validTypes = ["image/png", "image/webp", "image/jpeg", "image/svg+xml"];
    if (!validTypes.includes(file.type)) {
      setErrorMsg("Please upload a PNG (recommended transparent), WebP, or JPEG image.");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setErrorMsg("File size exceeds 8MB. Please use an image under 8MB.");
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const res = await fetch("/api/social/autopilot-config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "upload-logo",
              businessName: brandName,
              logoBase64: e.target.result,
            }),
          });
          const data = await res.json();
          if (data.ok && data.logo_url) {
            if (onLogoUpdated) onLogoUpdated(data.logo_url);
          } else {
            setErrorMsg(data.error || "Failed to upload logo. Please try again.");
          }
        } catch (err) {
          setErrorMsg("Upload error: " + err.message);
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setUploading(false);
      setErrorMsg("Could not read file: " + err.message);
    }
  };

  const handleRemove = async () => {
    if (!confirm(`Are you sure you want to remove the logo for ${brandName}? AI will design native brand typography for future posts.`)) {
      return;
    }
    setUploading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/social/autopilot-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove-logo",
          businessName: brandName,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        if (onLogoUpdated) onLogoUpdated(null);
      } else {
        setErrorMsg(data.error || "Failed to remove logo.");
      }
    } catch (err) {
      setErrorMsg("Error removing logo: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const modalContent = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999999,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#0c101d",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "18px",
          width: "100%",
          maxWidth: "520px",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.7)",
          color: "#f8fafc",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          padding: "24px",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "20px" }}>🖼️</span>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#f8fafc" }}>
                Brand Logo (Optional)
              </h3>
            </div>
            <div style={{ marginTop: "4px", fontSize: "12px", color: "#94a3b8" }}>
              Configuring logo exclusively for:{" "}
              <strong style={{ color: "#38bdf8" }}>{brandName || "Active Brand"}</strong>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "8px",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "6px 10px",
              fontSize: "14px",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Brand Isolation Badge */}
        <div
          style={{
            background: "rgba(56, 189, 248, 0.08)",
            border: "1px solid rgba(56, 189, 248, 0.25)",
            borderRadius: "10px",
            padding: "10px 12px",
            marginBottom: "16px",
            fontSize: "12px",
            lineHeight: "1.5",
            color: "#bae6fd",
            display: "flex",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "14px" }}>🔒</span>
          <div>
            <strong>Brand-Isolated:</strong> This logo is assigned only to <strong>{brandName || "this brand"}</strong>. If you switch to another brand (like Bella &amp; Diva or Rekha Gyan), it will use that brand's specific logo or AI styling.
          </div>
        </div>

        {errorMsg && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#fca5a5",
              borderRadius: "8px",
              padding: "10px 12px",
              marginBottom: "14px",
              fontSize: "12px",
            }}
          >
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Current Logo Preview or Dropzone */}
        {currentLogoUrl ? (
          <div
            style={{
              background: "rgba(15, 23, 42, 0.6)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: "12px",
              padding: "16px",
              marginBottom: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#34d399", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>✅</span> Active Logo Loaded
              </div>
              <span style={{ fontSize: "11px", color: "#64748b" }}>Overlay: Top-Left Header</span>
            </div>

            {/* Checkerboard Preview */}
            <div
              style={{
                width: "100%",
                height: "120px",
                borderRadius: "10px",
                background: "radial-gradient(#1e293b 2px, transparent 2px) 0 0/16px 16px, #0f172a",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "14px",
                position: "relative",
              }}
            >
              <img
                src={currentLogoUrl}
                alt="Active Logo"
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                  filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.5))",
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  background: "rgba(56, 189, 248, 0.15)",
                  border: "1px solid rgba(56, 189, 248, 0.35)",
                  color: "#38bdf8",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: uploading ? "not-allowed" : "pointer",
                }}
              >
                {uploading ? "Updating..." : "🔄 Change Logo (PNG)"}
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={uploading}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                  color: "#fca5a5",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: uploading ? "not-allowed" : "pointer",
                }}
              >
                🗑️ Remove Logo
              </button>
            </div>
          </div>
        ) : (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: dragActive
                ? "2px dashed #38bdf8"
                : "2px dashed rgba(255, 255, 255, 0.2)",
              background: dragActive
                ? "rgba(56, 189, 248, 0.08)"
                : "rgba(255, 255, 255, 0.02)",
              borderRadius: "14px",
              padding: "28px 18px",
              textAlign: "center",
              cursor: uploading ? "not-allowed" : "pointer",
              marginBottom: "16px",
              transition: "all 0.2s ease",
            }}
          >
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>
              {uploading ? "⏳" : "📁"}
            </div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#f8fafc", marginBottom: "4px" }}>
              {uploading ? "Uploading & Scaling Logo..." : "Upload Brand Logo (PNG)"}
            </div>
            <div style={{ fontSize: "12px", color: "#94a3b8" }}>
              Drag &amp; drop transparent PNG here, or <span style={{ color: "#38bdf8", textDecoration: "underline" }}>browse file</span>
            </div>
            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "8px" }}>
              Recommended: Transparent PNG (horizontal or square), up to 8MB
            </div>
          </div>
        )}

        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => handleProcessFile(e.target.files?.[0])}
          accept="image/png,image/webp,image/jpeg,image/svg+xml"
          style={{ display: "none" }}
        />

        {/* Explain Optional Behavior */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "10px",
            padding: "12px 14px",
            fontSize: "12px",
            color: "#94a3b8",
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 700, color: "#e2e8f0", marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
            <span>💡</span> Logo is completely optional
          </div>
          <div>
            • <strong>No Logo:</strong> AI designs gorgeous 3D infographics with stylized brand typography and graphics with zero empty spaces.
          </div>
          <div>
            • <strong>With Logo:</strong> Antigravity overlays your exact authentic PNG at the top-left corner with subtle soft shadows.
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: "18px", display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            className="btn-gabbar-dark"
            style={{
              padding: "8px 18px",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}
