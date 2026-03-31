// components/BuyCreditsModal.js
// ─────────────────────────────────────────────────────────────────────────────
// Manual Credit Top-Up modal for GabbarInfo AI.
// No payment gateway. No data storage. Pure UI + WhatsApp redirect.
//
// USAGE:
//   import BuyCreditsModal from "./components/BuyCreditsModal";
//
//   <BuyCreditsModal
//     isOpen={showBuyCredits}
//     onClose={() => setShowBuyCredits(false)}
//     userEmail={session?.user?.email}  // ← inject email from session here
//   />
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";

// ─── Plans & Top-ups ───────────────────────────────────────────────────────
const PLANS = [
  { id: "p1", label: "Starter Plan",  credits: 75,  amount: 499, validity: "28 days",  tag: "plan" },
  { id: "p2", label: "Pro Plan",      credits: 160, amount: 999, validity: "28 days",  tag: "plan" },
];

const TOPUPS = [
  { id: "t1", label: "Quick Boost",   credits: 10,  amount: 99,  validity: "24 hours", tag: "topup" },
  { id: "t2", label: "Small Pack",    credits: 20,  amount: 199, validity: "24 hours", tag: "topup" },
  { id: "t3", label: "Value Pack",    credits: 45,  amount: 399, validity: "7 days",   tag: "topup" },
  { id: "t4", label: "Power Pack",    credits: 90,  amount: 699, validity: "7 days",   tag: "topup" },
];

const QR_URL = "https://gabbarinfo.com/wp-content/uploads/2026/04/sbi-qr-code.jpeg";
const WA_NUMBER = "919723927645";

// ─── Main Component ────────────────────────────────────────────────────────
export default function BuyCreditsModal({ isOpen, onClose, userEmail }) {
  const [selected, setSelected] = useState(null); // selected plan/topup
  const [step, setStep]         = useState("plans"); // "plans" | "payment"

  if (!isOpen) return null;

  // ─── Reset and close ───────────────────────────────────────────────────
  function handleClose() {
    setSelected(null);
    setStep("plans");
    onClose();
  }

  // ─── Plan selection ────────────────────────────────────────────────────
  function selectPlan(plan) {
    setSelected(plan);
    setStep("payment");
  }

  // ─── WhatsApp link ─────────────────────────────────────────────────────
  function openWhatsApp() {
    if (!selected) return;
    // User email is pulled from session (passed as prop).
    // If email is unavailable, a placeholder is shown.
    const email    = userEmail || "Not provided";
    const message  =
      `Hi, I have made a payment.\n\n` +
      `Email: ${email}\n` +
      `Credits: ${selected.credits}\n` +
      `Amount: ₹${selected.amount}\n` +
      `Validity: ${selected.validity}\n\n` +
      `Sharing screenshot and transaction ID below.`;
    const encoded  = encodeURIComponent(message);
    window.open(`https://wa.me/${WA_NUMBER}?text=${encoded}`, "_blank");
  }

  // ─── Styles ────────────────────────────────────────────────────────────
  const S = {
    overlay: {
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.45)",
      zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
      backdropFilter: "blur(2px)",
    },
    modal: {
      background: "#fff",
      borderRadius: 20,
      width: "100%",
      maxWidth: 540,
      maxHeight: "90vh",
      overflowY: "auto",
      boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
      fontFamily: "Inter, Arial, sans-serif",
      animation: "fadeSlideUp 0.22s ease",
    },
    header: {
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "20px 24px 16px",
      borderBottom: "1px solid #f0f0f0",
    },
    title: { margin: 0, fontSize: 20, fontWeight: 700, color: "#111" },
    closeBtn: {
      background: "none", border: "none", cursor: "pointer",
      fontSize: 22, color: "#888", lineHeight: 1, padding: 4,
    },
    body: { padding: "20px 24px 28px" },
    sectionLabel: {
      fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
      textTransform: "uppercase", color: "#888", marginBottom: 10,
    },
    cardGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 12,
      marginBottom: 24,
    },
    topupGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
    },
  };

  return (
    <>
      {/* Overlay */}
      <div style={S.overlay} onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
        <div style={S.modal}>
          {/* Header */}
          <div style={S.header}>
            {step === "payment" ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  onClick={() => setStep("plans")}
                  style={{ ...S.closeBtn, fontSize: 18 }}
                  title="Back"
                >
                  ←
                </button>
                <h2 style={S.title}>Complete Payment</h2>
              </div>
            ) : (
              <h2 style={S.title}>💳 Buy Credits</h2>
            )}
            <button onClick={handleClose} style={S.closeBtn} title="Close">✕</button>
          </div>

          <div style={S.body}>
            {/* ─── STEP: PLANS ─────────────────────────────────────────── */}
            {step === "plans" && (
              <>
                {/* Plans */}
                <div style={S.sectionLabel}>📦 Monthly Plans</div>
                <div style={S.cardGrid}>
                  {PLANS.map((p) => (
                    <PlanCard key={p.id} plan={p} onSelect={selectPlan} highlight />
                  ))}
                </div>

                {/* Divider */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 12, marginBottom: 18,
                }}>
                  <div style={{ flex: 1, height: 1, background: "#eee" }} />
                  <span style={{ fontSize: 12, color: "#aaa", whiteSpace: "nowrap" }}>Quick Top-Ups</span>
                  <div style={{ flex: 1, height: 1, background: "#eee" }} />
                </div>

                {/* Top-ups */}
                <div style={S.sectionLabel}>⚡ Top-Ups</div>
                <div style={S.topupGrid}>
                  {TOPUPS.map((p) => (
                    <PlanCard key={p.id} plan={p} onSelect={selectPlan} />
                  ))}
                </div>

                <p style={{ marginTop: 20, fontSize: 12, color: "#aaa", textAlign: "center" }}>
                  Credits are added manually within a few hours after payment confirmation.
                </p>
              </>
            )}

            {/* ─── STEP: PAYMENT ───────────────────────────────────────── */}
            {step === "payment" && selected && (
              <PaymentSection
                plan={selected}
                userEmail={userEmail}
                onWhatsApp={openWhatsApp}
              />
            )}
          </div>
        </div>
      </div>

      {/* Inline keyframe animation */}
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

// ─── PlanCard ──────────────────────────────────────────────────────────────
function PlanCard({ plan, onSelect, highlight }) {
  const [hovered, setHovered] = useState(false);

  const isPlan = plan.tag === "plan";
  const accentColor = isPlan ? "#4f46e5" : "#0ea5e9";
  const accentLight = isPlan ? "#eef2ff" : "#e0f2fe";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: `1.5px solid ${hovered ? accentColor : "#e5e7eb"}`,
        borderRadius: 14,
        padding: "16px 14px",
        cursor: "pointer",
        transition: "all 0.18s ease",
        background: hovered ? accentLight : "#fafafa",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Validity badge */}
      <div style={{
        position: "absolute", top: 10, right: 10,
        background: accentLight,
        color: accentColor,
        fontSize: 10, fontWeight: 700,
        padding: "2px 7px", borderRadius: 99,
        border: `1px solid ${accentColor}22`,
      }}>
        {plan.validity}
      </div>

      <div style={{ fontSize: 22, fontWeight: 800, color: "#111", marginBottom: 2 }}>
        {plan.credits}
        <span style={{ fontSize: 12, fontWeight: 500, color: "#666", marginLeft: 4 }}>credits</span>
      </div>

      <div style={{ fontSize: 18, fontWeight: 700, color: accentColor, marginBottom: 12 }}>
        ₹{plan.amount}
      </div>

      <button
        onClick={() => onSelect(plan)}
        style={{
          width: "100%",
          padding: "8px 0",
          background: hovered ? accentColor : "#fff",
          color: hovered ? "#fff" : accentColor,
          border: `1.5px solid ${accentColor}`,
          borderRadius: 8,
          fontWeight: 600,
          fontSize: 13,
          cursor: "pointer",
          transition: "all 0.18s ease",
        }}
      >
        Get →
      </button>
    </div>
  );
}

// ─── PaymentSection ────────────────────────────────────────────────────────
function PaymentSection({ plan, userEmail, onWhatsApp }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
      {/* Selected plan summary */}
      <div style={{
        width: "100%",
        background: "#f8fafc",
        borderRadius: 14,
        border: "1px solid #e2e8f0",
        padding: "14px 18px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 8,
      }}>
        {[
          { label: "Amount",   value: `₹${plan.amount}` },
          { label: "Credits",  value: `${plan.credits}` },
          { label: "Validity", value: plan.validity },
        ].map(({ label, value }) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* QR Code */}
      <div style={{ textAlign: "center" }}>
        <div style={{
          background: "#fff",
          border: "1.5px solid #e2e8f0",
          borderRadius: 16,
          padding: 12,
          display: "inline-block",
          boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
        }}>
          <img
            src={QR_URL}
            alt="SBI UPI QR Code"
            style={{ width: 200, height: 200, display: "block", borderRadius: 8 }}
            onError={(e) => {
              // Graceful fallback if image fails to load
              e.target.style.display = "none";
              e.target.nextSibling.style.display = "flex";
            }}
          />
          {/* Fallback placeholder (hidden by default) */}
          <div style={{
            display: "none", width: 200, height: 200, borderRadius: 8,
            background: "#f1f5f9", alignItems: "center", justifyContent: "center",
            color: "#94a3b8", fontSize: 13, textAlign: "center", padding: 16,
          }}>
            QR code unavailable.<br />Pay to UPI ID on WhatsApp.
          </div>
        </div>

        <p style={{ margin: "10px 0 0", fontSize: 13, color: "#64748b", fontWeight: 500 }}>
          📱 Scan to pay using any UPI app
        </p>
      </div>

      {/* Instructions */}
      <div style={{
        width: "100%",
        background: "#fffbeb",
        border: "1px solid #fde68a",
        borderRadius: 10,
        padding: "12px 16px",
        fontSize: 13,
        color: "#78350f",
        lineHeight: 1.6,
      }}>
        <strong>After paying:</strong> Click the button below to send your payment proof on WhatsApp. 
        Credits will be added manually within a few hours.
      </div>

      {/* WhatsApp button */}
      <button
        onClick={onWhatsApp}
        style={{
          width: "100%",
          padding: "14px",
          background: "linear-gradient(135deg, #25d366, #128c7e)",
          color: "#fff",
          border: "none",
          borderRadius: 12,
          fontWeight: 700,
          fontSize: 15,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          boxShadow: "0 4px 14px rgba(37,211,102,0.35)",
          transition: "transform 0.15s ease",
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.02)"}
        onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        Send Proof on WhatsApp
      </button>

      {/* Email note */}
      <p style={{ margin: 0, fontSize: 11, color: "#94a3b8", textAlign: "center" }}>
        {/* This email comes from your session. See prop: userEmail */}
        Message will include your email: <strong>{userEmail || "not available"}</strong>
      </p>
    </div>
  );
}
