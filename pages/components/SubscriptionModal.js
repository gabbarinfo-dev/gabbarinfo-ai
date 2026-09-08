// pages/components/SubscriptionModal.js
/**
 * Modern Subscription Plan Selection & Management Modal
 * 
 * Replaces the obsolete "Buy Credits / Credit Packs / Top-Ups" modal.
 * Displays the 5 official plans: TRY, STARTER, GROWTH, BUSINESS, AGENCY
 * with real monthly service allowances and transparent pricing.
 */

import { useState } from "react";
import { SUBSCRIPTION_PLANS } from "../../lib/billing/plans";

const PLAN_LIST = Object.values(SUBSCRIPTION_PLANS);

export default function SubscriptionModal({
  isOpen,
  onClose,
  currentPlanId = "try",
  subscriptionStatus = null,
  onSubscriptionUpdated,
}) {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [step, setStep] = useState("plans"); // "plans" | "checkout" | "confirmation"
  const [paymentRef, setPaymentRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  if (!isOpen) return null;

  function handleClose() {
    setSelectedPlan(null);
    setStep("plans");
    setErrorMsg(null);
    setOrderResult(null);
    onClose();
  }

  function handleSelectPlan(plan) {
    setSelectedPlan(plan);
    setStep("checkout");
    setErrorMsg(null);
  }

  async function handleConfirmOrder() {
    if (!selectedPlan) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/subscriptions/purchase-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedPlan.id,
          paymentReference: paymentRef.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to initiate subscription order.");
      }

      setOrderResult(data);
      setStep("confirmation");
      if (onSubscriptionUpdated) onSubscriptionUpdated();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(3, 7, 18, 0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        style={{
          background: "linear-gradient(180deg, #0d1527 0%, #080d1a 100%)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: 24,
          maxWidth: step === "plans" ? 1040 : 540,
          width: "100%",
          maxHeight: "92vh",
          overflowY: "auto",
          boxShadow: "0 25px 70px rgba(0, 0, 0, 0.85), 0 0 40px rgba(59, 130, 246, 0.15)",
          color: "#f8fafc",
          fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "24px 28px 20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 18 }}>⚡</span>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>
                {step === "plans" ? "Select Your Marketing Subscription" : "Subscription Checkout"}
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>
              {step === "plans"
                ? "Monthly plans with guaranteed service allowances, isolated business workspaces, and autopilot."
                : `Complete activation for ${selectedPlan?.name || "selected plan"}.`}
            </p>
          </div>

          <button
            onClick={handleClose}
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "none",
              cursor: "pointer",
              fontSize: 16,
              color: "#94a3b8",
              width: 34,
              height: 34,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s",
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "28px" }}>
          {errorMsg && (
            <div
              style={{
                marginBottom: 20,
                padding: "12px 16px",
                borderRadius: 12,
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#f87171",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              ⚠️ {errorMsg}
            </div>
          )}

          {/* STEP 1: PLANS GRID */}
          {step === "plans" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 16,
              }}
            >
              {PLAN_LIST.map((p) => {
                const isCurrent = currentPlanId?.toLowerCase() === p.id;
                const isPopular = p.id === "growth";

                return (
                  <div
                    key={p.id}
                    style={{
                      background: isPopular
                        ? "linear-gradient(180deg, rgba(37, 99, 235, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%)"
                        : "rgba(255, 255, 255, 0.03)",
                      border: isPopular
                        ? "1.5px solid #3b82f6"
                        : isCurrent
                        ? "1.5px solid rgba(16, 185, 129, 0.6)"
                        : "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: 18,
                      padding: "20px 16px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      position: "relative",
                      transition: "transform 0.15s ease",
                    }}
                  >
                    {isPopular && (
                      <div
                        style={{
                          position: "absolute",
                          top: -10,
                          left: "50%",
                          transform: "translateX(-50%)",
                          background: "#2563eb",
                          color: "#fff",
                          fontSize: 10,
                          fontWeight: 800,
                          padding: "2px 10px",
                          borderRadius: 999,
                          letterSpacing: "0.5px",
                          textTransform: "uppercase",
                        }}
                      >
                        Most Popular
                      </div>
                    )}

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: "#f8fafc" }}>
                          {p.name}
                        </h3>
                        {isCurrent && (
                          <span style={{ fontSize: 10, color: "#34d399", fontWeight: 700, textTransform: "uppercase" }}>
                            Current
                          </span>
                        )}
                      </div>

                      <div style={{ marginBottom: 16 }}>
                        <span style={{ fontSize: 24, fontWeight: 800, color: "#ffffff" }}>
                          ₹{p.priceINR.toLocaleString("en-IN")}
                        </span>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}> / month</span>
                      </div>

                      {/* Feature Bullet Allowances */}
                      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px 0", fontSize: 12, lineHeight: "1.8" }}>
                        <li style={{ color: "#cbd5e1" }}>
                          🏢 <strong>{p.limits.maxBusinesses}</strong> {p.limits.maxBusinesses === 1 ? "Business" : "Businesses"}
                        </li>
                        <li style={{ color: "#cbd5e1" }}>
                          📝 <strong>{p.quotas.SEO_ARTICLE}</strong> SEO {p.quotas.SEO_ARTICLE === 1 ? "Article" : "Articles"}/mo
                        </li>
                        <li style={{ color: "#cbd5e1" }}>
                          📱 <strong>{p.quotas.SOCIAL_POST}</strong> Social Posts/mo
                        </li>
                        <li style={{ color: "#cbd5e1" }}>
                          🎨 <strong>{p.quotas.IMAGE_GENERATION}</strong> AI Images/mo
                        </li>
                        <li style={{ color: "#cbd5e1" }}>
                          💬 <strong>{p.quotas.AI_QUERY}</strong> AI Queries/mo
                        </li>
                        <li style={{ color: "#cbd5e1" }}>
                          🌐 <strong>{p.limits.maxWordPressSites}</strong> WordPress Site(s)
                        </li>
                        <li style={{ color: p.features.SEO_AUTOPILOT ? "#34d399" : "#64748b" }}>
                          {p.features.SEO_AUTOPILOT ? "✓ SEO Autopilot" : "✕ No SEO Autopilot"}
                        </li>
                        <li style={{ color: p.features.SOCIAL_AUTOPILOT ? "#34d399" : "#64748b" }}>
                          {p.features.SOCIAL_AUTOPILOT ? "✓ Social Autopilot" : "✕ No Social Autopilot"}
                        </li>
                        <li style={{ color: p.features.META_ADS ? "#38bdf8" : "#64748b" }}>
                          {p.features.META_ADS ? `🎯 ${p.quotas.META_CAMPAIGN} Meta Ads/mo` : "✕ No Meta Ads"}
                        </li>
                        <li style={{ color: p.features.GOOGLE_ADS ? "#facc15" : "#64748b" }}>
                          {p.features.GOOGLE_ADS ? `📈 ${p.quotas.GOOGLE_CAMPAIGN} Google Ads/mo` : "✕ No Google Ads"}
                        </li>
                      </ul>
                    </div>

                    <button
                      onClick={() => handleSelectPlan(p)}
                      disabled={isCurrent}
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: 12,
                        border: "none",
                        background: isCurrent
                          ? "rgba(255, 255, 255, 0.08)"
                          : isPopular
                          ? "#2563eb"
                          : "rgba(255, 255, 255, 0.12)",
                        color: isCurrent ? "#94a3b8" : "#ffffff",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: isCurrent ? "default" : "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {isCurrent ? "Active Plan" : `Select ${p.name}`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* STEP 2: CHECKOUT */}
          {step === "checkout" && selectedPlan && (
            <div style={{ maxWidth: 460, margin: "0 auto" }}>
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: 16,
                  padding: "20px",
                  marginBottom: 20,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ color: "#94a3b8", fontSize: 13 }}>Selected Plan:</span>
                  <span style={{ fontWeight: 800, color: "#60a5fa", fontSize: 15 }}>{selectedPlan.name}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ color: "#94a3b8", fontSize: 13 }}>Billing Cycle:</span>
                  <span style={{ fontWeight: 600, color: "#cbd5e1", fontSize: 13 }}>Monthly (30 Days)</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>
                  <span style={{ color: "#ffffff", fontWeight: 700, fontSize: 14 }}>Total Monthly Price:</span>
                  <span style={{ fontWeight: 800, color: "#34d399", fontSize: 18 }}>
                    ₹{selectedPlan.priceINR.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                  Payment / Transaction Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. UPI Ref / Bank Reference"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid rgba(255, 255, 255, 0.14)",
                    background: "#0f172a",
                    color: "#fff",
                    fontSize: 13,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setStep("plans")}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: 12,
                    border: "1px solid rgba(255, 255, 255, 0.14)",
                    background: "transparent",
                    color: "#94a3b8",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  ← Back to Plans
                </button>
                <button
                  onClick={handleConfirmOrder}
                  disabled={submitting}
                  style={{
                    flex: 2,
                    padding: "12px",
                    borderRadius: 12,
                    border: "none",
                    background: "#2563eb",
                    color: "#ffffff",
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: submitting ? "not-allowed" : "pointer",
                    boxShadow: "0 0 20px rgba(37, 99, 235, 0.4)",
                  }}
                >
                  {submitting ? "Processing Request…" : `Confirm ${selectedPlan.name} Plan`}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: CONFIRMATION */}
          {step === "confirmation" && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>🎉</div>
              <h3 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>Subscription Request Placed!</h3>
              <p style={{ color: "#94a3b8", fontSize: 13, maxWidth: 400, margin: "0 auto 24px", lineHeight: 1.6 }}>
                Your request for the <strong>{selectedPlan?.name}</strong> plan (₹{selectedPlan?.priceINR}/month) has been recorded.
                Our team will verify payment and activate your monthly allowances immediately.
              </p>
              <button
                onClick={handleClose}
                style={{
                  padding: "10px 24px",
                  borderRadius: 12,
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Return to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
