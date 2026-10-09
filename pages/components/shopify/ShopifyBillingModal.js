// pages/components/shopify/ShopifyBillingModal.js
import React, { useState } from "react";

export default function ShopifyBillingModal({
  isOpen,
  onClose,
  shop,
  currentPlanState,
}) {
  const [subscribingPlan, setSubscribingPlan] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const plans = [
    {
      id: "free-trial",
      name: "Free Trial",
      price: "$0",
      cadence: "One-Time Trial",
      blogs: "2 Autonomous SEO Blogs",
      productOpts: "2 AI Product Optimizations",
      socialSync: "Automatic 3-Platform Social Post",
      quotaDetail: "1 Blog/Day over 2 Days Cadence",
      isFree: true,
      popular: false,
    },
    {
      id: "starter-plan",
      name: "Starter Plan",
      price: "$5.99",
      cadence: "per month",
      blogs: "9 SEO Blogs / month",
      productOpts: "30 AI Product Optimizations",
      socialSync: "Automatic 3-Platform Social Post",
      quotaDetail: "1 Blog every 3 days • Manual & Autopilot Shared Pool",
      isFree: false,
      popular: false,
    },
    {
      id: "growth-plan",
      name: "Growth Plan",
      price: "$8.99",
      cadence: "per month",
      blogs: "15 SEO Blogs / month",
      productOpts: "50 AI Product Optimizations",
      socialSync: "Automatic 3-Platform Social Post",
      quotaDetail: "1 Blog every 2 days • Manual & Autopilot Shared Pool",
      isFree: false,
      popular: true,
    },
    {
      id: "pro-autopilot",
      name: "Pro Autopilot",
      price: "$10.99",
      cadence: "per month",
      blogs: "30 SEO Blogs / month",
      productOpts: "70 AI Product Optimizations",
      socialSync: "Automatic 3-Platform Social Post",
      quotaDetail: "Daily 1 Blog/Day • Full Autopilot & Manual Flexibility",
      isFree: false,
      popular: false,
    },
  ];

  async function handleSubscribe(planId) {
    if (!shop) {
      setErrorMsg("Please select an active Shopify store first.");
      return;
    }
    setErrorMsg("");
    setSubscribingPlan(planId);

    try {
      const res = await fetch("/api/shopify/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop, planId }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to initiate Shopify subscription.");
      }

      if (data.confirmationUrl) {
        // Official Shopify Billing approval redirect
        if (window.top) {
          window.top.location.href = data.confirmationUrl;
        } else {
          window.location.href = data.confirmationUrl;
        }
      } else {
        throw new Error("No approval URL received from Shopify.");
      }
    } catch (err) {
      console.error("[ShopifyBillingModal] Subscribe error:", err);
      setErrorMsg(err.message || "Failed to connect with Shopify Billing.");
      setSubscribingPlan(null);
    }
  }

  const activePlanId = currentPlanState?.planId || "free-trial";
  const trialExhausted = Boolean(currentPlanState?.trialExhausted);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "rgba(2, 6, 23, 0.88)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1020px",
          background: "linear-gradient(180deg, #0f172a 0%, #090d16 100%)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "20px",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(59, 130, 246, 0.15)",
          padding: "32px",
          position: "relative",
          color: "#fff",
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            background: "rgba(255, 255, 255, 0.06)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            color: "#94a3b8",
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            cursor: "pointer",
            fontSize: "18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ✕
        </button>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              padding: "4px 14px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: 700,
              color: "#34d399",
              marginBottom: "12px",
            }}
          >
            🛍️ Official Shopify App Store Billing
          </div>
          <h2 style={{ fontSize: "26px", fontWeight: 900, margin: "0 0 8px 0", color: "#f8fafc" }}>
            Choose Your eCommerce AI Plan for <span style={{ color: "#60a5fa" }}>{shop || "Your Store"}</span>
          </h2>
          <p style={{ fontSize: "14px", color: "#94a3b8", margin: 0, maxWidth: "620px", margin: "0 auto" }}>
            Autonomous blog publishing with in-stock product internal linking, 2 original AI images, social sync, and conversion product optimizations billed directly on your monthly Shopify invoice.
          </p>
        </div>

        {errorMsg && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.35)",
              color: "#fca5a5",
              padding: "12px 16px",
              borderRadius: "10px",
              fontSize: "13px",
              marginBottom: "20px",
              textAlign: "center",
            }}
          >
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Pricing Cards Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          {plans.map((p) => {
            const isCurrent = activePlanId === p.id;
            const isFreeTrialLocked = p.id === "free-trial" && trialExhausted;

            return (
              <div
                key={p.id}
                style={{
                  background: p.popular
                    ? "linear-gradient(180deg, rgba(30, 58, 138, 0.4) 0%, rgba(15, 23, 42, 0.9) 100%)"
                    : "rgba(15, 23, 42, 0.7)",
                  border: p.popular
                    ? "2px solid #3b82f6"
                    : isCurrent
                    ? "2px solid #10b981"
                    : "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "16px",
                  padding: "22px 18px",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                  boxShadow: p.popular ? "0 10px 30px rgba(59, 130, 246, 0.2)" : "none",
                }}
              >
                {p.popular && (
                  <div
                    style={{
                      position: "absolute",
                      top: "-11px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                      color: "#fff",
                      fontSize: "10px",
                      fontWeight: 800,
                      padding: "2px 12px",
                      borderRadius: "12px",
                      letterSpacing: "0.5px",
                    }}
                  >
                    MOST POPULAR
                  </div>
                )}

                {isCurrent && (
                  <div
                    style={{
                      position: "absolute",
                      top: "-11px",
                      right: "12px",
                      background: "#10b981",
                      color: "#fff",
                      fontSize: "10px",
                      fontWeight: 800,
                      padding: "2px 8px",
                      borderRadius: "10px",
                    }}
                  >
                    ACTIVE PLAN
                  </div>
                )}

                <div style={{ fontSize: "16px", fontWeight: 800, color: "#f8fafc", marginBottom: "4px" }}>
                  {p.name}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "14px" }}>
                  <span style={{ fontSize: "28px", fontWeight: 900, color: "#fff" }}>{p.price}</span>
                  <span style={{ fontSize: "12px", color: "#94a3b8" }}>{p.cadence}</span>
                </div>

                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px", fontSize: "12.5px", color: "#cbd5e1", marginBottom: "20px" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                    <span style={{ color: "#10b981" }}>✓</span>
                    <span><strong>{p.blogs}</strong></span>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                    <span style={{ color: "#10b981" }}>✓</span>
                    <span><strong>{p.productOpts}</strong></span>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                    <span style={{ color: "#10b981" }}>✓</span>
                    <span>{p.socialSync}</span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "8px", marginTop: "auto" }}>
                    {p.quotaDetail}
                  </div>
                </div>

                {p.isFree ? (
                  <button
                    type="button"
                    disabled={true}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      background: isFreeTrialLocked ? "rgba(239, 68, 68, 0.15)" : "rgba(255, 255, 255, 0.06)",
                      border: isFreeTrialLocked ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid rgba(255, 255, 255, 0.12)",
                      color: isFreeTrialLocked ? "#fca5a5" : "#94a3b8",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "default",
                    }}
                  >
                    {isFreeTrialLocked ? "🔒 Trial Exhausted" : "Current Trial"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSubscribe(p.id)}
                    disabled={subscribingPlan === p.id || isCurrent}
                    style={{
                      width: "100%",
                      padding: "11px 14px",
                      borderRadius: "10px",
                      background: isCurrent
                        ? "rgba(16, 185, 129, 0.2)"
                        : p.popular
                        ? "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)"
                        : "linear-gradient(135deg, #475569 0%, #334155 100%)",
                      border: isCurrent ? "1px solid #10b981" : "none",
                      color: "#fff",
                      fontSize: "12.5px",
                      fontWeight: 800,
                      cursor: (subscribingPlan === p.id || isCurrent) ? "default" : "pointer",
                      boxShadow: p.popular ? "0 4px 15px rgba(59, 130, 246, 0.4)" : "none",
                    }}
                  >
                    {subscribingPlan === p.id
                      ? "Connecting Shopify..."
                      : isCurrent
                      ? "Active"
                      : `Subscribe for ${p.price}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: "center", fontSize: "11.5px", color: "#64748b" }}>
          🔒 Safe & compliant: Monthly charges are processed natively via Shopify Billing. You can upgrade or cancel directly in your Shopify Store Admin at any time.
        </div>
      </div>
    </div>
  );
}
