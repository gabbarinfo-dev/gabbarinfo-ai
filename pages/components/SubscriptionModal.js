// pages/components/SubscriptionModal.js
/**
 * Modern Modular Subscription Plan Selection & Management Modal
 * 
 * Displays the modular subscription categories:
 * 1. ⚡ All-in-One Growth Suites (suite_1, suite_2, suite_3)
 * 2. 📝 SEO Content Plans (seo_1, seo_2, seo_3)
 * 3. 📱 Social Media Autopilot (social_1, social_2, social_3)
 * 4. 🚀 Performance Ads Engine (ads_1, ads_2, ads_3)
 * 5. 🏢 Agency Scale (agency_scale)
 * 
 * Featuring clean per-asset isolated quotas (strictly 30 blogs/site, 30 posts/brand, 2 GAds + 2 Meta Ads per account).
 */

import { useState } from "react";
import { SUBSCRIPTION_PLANS } from "../../lib/billing/plans";

const CATEGORIES = [
  { key: "suite", label: "⚡ Growth Suites (All-in-One)" },
  { key: "trial", label: "🎁 ₹99 Trial Pack" },
  { key: "gmb", label: "📍 Local Maps (GMB)" },
  { key: "bundle", label: "🔗 Power Bundles" },
  { key: "seo", label: "📝 SEO Content" },
  { key: "social", label: "📱 Social Autopilot" },
  { key: "ads", label: "🚀 Performance Ads" },
  { key: "agency", label: "🏢 Agency Scale" },
];

const MODULAR_PLANS = [
  SUBSCRIPTION_PLANS.trial_99,
  SUBSCRIPTION_PLANS.suite_1,
  SUBSCRIPTION_PLANS.suite_2,
  SUBSCRIPTION_PLANS.suite_3,
  SUBSCRIPTION_PLANS.gmb_1,
  SUBSCRIPTION_PLANS.bundle_gads_gmb,
  SUBSCRIPTION_PLANS.bundle_seo_gmb,
  SUBSCRIPTION_PLANS.seo_1,
  SUBSCRIPTION_PLANS.seo_2,
  SUBSCRIPTION_PLANS.seo_3,
  SUBSCRIPTION_PLANS.social_1,
  SUBSCRIPTION_PLANS.social_2,
  SUBSCRIPTION_PLANS.social_3,
  SUBSCRIPTION_PLANS.ads_1,
  SUBSCRIPTION_PLANS.ads_2,
  SUBSCRIPTION_PLANS.ads_3,
  SUBSCRIPTION_PLANS.agency_scale,
].filter(Boolean);

export default function SubscriptionModal({
  isOpen,
  onClose,
  currentPlanId = "try",
  subscriptionStatus = null,
  onSubscriptionUpdated,
}) {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("suite");
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

  async function handleRazorpayCheckout() {
    if (!selectedPlan) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      // 1. Ensure Razorpay checkout script is loaded
      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = resolve;
          script.onerror = () => reject(new Error("Failed to load Razorpay checkout script."));
          document.body.appendChild(script);
        });
      }

      // 2. Call backend to generate authorized Razorpay Order
      const res = await fetch("/api/billing/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlan.id }),
      });

      const orderData = await res.json();
      if (!res.ok || !orderData.ok) {
        throw new Error(orderData.error || "Failed to initialize Razorpay payment order.");
      }

      // 3. Open Razorpay Checkout Modal
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "GabbarInfo AI",
        description: `${selectedPlan.name} (30-Day Subscription)`,
        image: "https://www.gabbarinfo.com/wp-content/uploads/logo.png",
        order_id: orderData.orderId,
        handler: async function (response) {
          try {
            setSubmitting(true);
            const verifyRes = await fetch("/api/billing/razorpay/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                planId: selectedPlan.id,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData.ok) {
              throw new Error(verifyData.error || "Payment verification failed.");
            }

            setOrderResult({ ...verifyData, isInstant: true });
            setStep("confirmation");
            if (onSubscriptionUpdated) onSubscriptionUpdated();
          } catch (vErr) {
            setErrorMsg(vErr.message);
          } finally {
            setSubmitting(false);
          }
        },
        prefill: {
          name: orderData.customer?.name || "",
          email: orderData.customer?.email || "",
        },
        theme: {
          color: "#2563eb",
        },
        modal: {
          ondismiss: function () {
            setSubmitting(false);
          },
        },
      };

      const rzpInstance = new window.Razorpay(options);
      rzpInstance.open();
    } catch (err) {
      setErrorMsg(err.message);
      setSubmitting(false);
    }
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

  const filteredPlans = MODULAR_PLANS.filter((p) => p.category === selectedCategory);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(3, 7, 18, 0.88)",
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
          maxWidth: step === "plans" ? 1080 : 540,
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
            padding: "24px 28px 18px",
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
                {step === "plans" ? "Select Your Subscription Plan" : "Subscription Checkout"}
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>
              {step === "plans"
                ? "Transparent per-asset isolated quotas. Zero pool contention. 30-day billing cycle."
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
        <div style={{ padding: "24px 28px 28px" }}>
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

          {/* STEP 1: CATEGORY TABS + PLANS GRID */}
          {step === "plans" && (
            <>
              {/* ₹99 Power Sampler Trial Banner */}
              <div
                style={{
                  background: "linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(234, 88, 12, 0.1) 100%)",
                  border: "1px solid rgba(245, 158, 11, 0.35)",
                  borderRadius: 16,
                  padding: "16px 20px",
                  marginBottom: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 22,
                      boxShadow: "0 4px 12px rgba(245, 158, 11, 0.4)",
                      flexShrink: 0,
                    }}
                  >
                    🎁
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#fbbf24" }}>
                        Power Sampler Trial Pack — Just ₹99
                      </h4>
                      <span
                        style={{
                          background: "rgba(245, 158, 11, 0.25)",
                          color: "#fef08a",
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                        }}
                      >
                        Zero Risk
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: "#cbd5e1", lineHeight: 1.4 }}>
                      Test AI autopilot for 1 business: <strong>2 SEO blogs</strong> (with auto-social syndication), <strong>2 social posts (FB+IG)</strong>, <strong>2 GMB AI review replies</strong>, <strong>2 AI visuals</strong> & <strong>10 marketing queries</strong>.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleSelectPlan(SUBSCRIPTION_PLANS.trial_99)}
                  style={{
                    background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                    color: "#0f172a",
                    border: "none",
                    padding: "10px 20px",
                    borderRadius: 12,
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(245, 158, 11, 0.35)",
                    transition: "all 0.15s ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  ⚡ Try for ₹99 Now
                </button>
              </div>

              {/* Category Tab Switcher */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 24,
                  overflowX: "auto",
                  paddingBottom: 4,
                  borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                }}
              >
                {CATEGORIES.map((cat) => {
                  const isActive = selectedCategory === cat.key;
                  return (
                    <button
                      key={cat.key}
                      onClick={() => setSelectedCategory(cat.key)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 12,
                        border: "none",
                        background: isActive
                          ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
                          : "rgba(255, 255, 255, 0.04)",
                        color: isActive ? "#ffffff" : "#94a3b8",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        boxShadow: isActive ? "0 4px 14px rgba(37, 99, 235, 0.35)" : "none",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>

              {/* Plans Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    filteredPlans.length === 1
                      ? "1fr"
                      : "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: 20,
                  maxWidth: filteredPlans.length === 1 ? 480 : "100%",
                  margin: filteredPlans.length === 1 ? "0 auto" : "0",
                }}
              >
                {filteredPlans.map((p) => {
                  const normalizedCurrent = (currentPlanId || "").toLowerCase().trim();
                  const isCurrent =
                    normalizedCurrent &&
                    normalizedCurrent !== "none" &&
                    normalizedCurrent !== "try" &&
                    normalizedCurrent === p.id;
                  const isPopular =
                    p.id === "suite_1" ||
                    p.id === "gmb_1" ||
                    p.id === "bundle_gads_gmb" ||
                    p.id === "bundle_seo_gmb" ||
                    p.id === "seo_1" ||
                    p.id === "social_1" ||
                    p.id === "ads_1";

                  return (
                    <div
                      key={p.id}
                      style={{
                        background: isPopular
                          ? "linear-gradient(180deg, rgba(37, 99, 235, 0.12) 0%, rgba(15, 23, 42, 0.85) 100%)"
                          : "rgba(255, 255, 255, 0.03)",
                        border: isPopular
                          ? "1.5px solid #3b82f6"
                          : isCurrent
                          ? "1.5px solid rgba(16, 185, 129, 0.6)"
                          : "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: 20,
                        padding: "24px 20px",
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
                            padding: "3px 12px",
                            borderRadius: 999,
                            letterSpacing: "0.5px",
                            textTransform: "uppercase",
                          }}
                        >
                          Recommended
                        </div>
                      )}

                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#f8fafc" }}>
                            {p.name}
                          </h3>
                          {isCurrent && (
                            <span style={{ fontSize: 10, color: "#34d399", fontWeight: 700, textTransform: "uppercase" }}>
                              Current
                            </span>
                          )}
                        </div>

                        <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 16px", minHeight: 34, lineHeight: 1.4 }}>
                          {p.description}
                        </p>

                        <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
                          <span style={{ fontSize: 28, fontWeight: 800, color: "#ffffff" }}>
                            ₹{p.priceINR.toLocaleString("en-IN")}
                          </span>
                          <span style={{ fontSize: 12, color: "#94a3b8" }}>
                            {p.billingCycle === "trial_7d" ? " / 7-day trial" : " / month"}
                          </span>
                        </div>

                        {/* Feature Bullet Allowances */}
                        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px 0", fontSize: 12.5, lineHeight: "2" }}>
                          {/* WordPress Sites & Isolated Blogs */}
                          {p.limits.maxWordPressSites > 0 ? (
                            <li style={{ color: "#cbd5e1" }}>
                              🌐 <strong>{p.limits.maxWordPressSites}</strong> {p.limits.maxWordPressSites === 1 ? "Website Slot" : "Website Slots"}{" "}
                              <span style={{ color: "#38bdf8", fontWeight: 600 }}>({p.perAssetQuotas?.blogsPerSite || 30} blogs/site)</span>
                            </li>
                          ) : (
                            <li style={{ color: "#64748b" }}>🌐 No WordPress Sites</li>
                          )}

                          {/* Social Brands & Isolated Posts */}
                          {p.limits.maxSocialBrands > 0 ? (
                            <li style={{ color: "#cbd5e1" }}>
                              📱 <strong>{p.limits.maxSocialBrands}</strong> {p.limits.maxSocialBrands === 1 ? "Social Brand" : "Social Brands"}{" "}
                              <span style={{ color: "#a855f7", fontWeight: 600 }}>({p.perAssetQuotas?.postsPerBrand || 30} posts/brand)</span>
                            </li>
                          ) : (
                            <li style={{ color: "#64748b" }}>📱 No Social Media Brands</li>
                          )}

                          {/* Ads Units & Isolated Campaigns */}
                          {p.limits.maxAdAccounts > 0 ? (
                            <li style={{ color: "#cbd5e1" }}>
                              🎯 <strong>{p.limits.maxAdAccounts}</strong> {p.limits.maxAdAccounts === 1 ? "Ad Unit" : "Ad Units"}{" "}
                              <span style={{ color: "#facc15", fontWeight: 600 }}>
                                ({p.perAssetQuotas?.googleAdsPerAccount || 2} Google + {p.perAssetQuotas?.metaAdsPerAccount || 2} Meta)
                              </span>
                            </li>
                          ) : (
                            <li style={{ color: "#64748b" }}>🎯 No Ad Engine Access</li>
                          )}

                          {/* Google Business Profile (GMB) Locations */}
                          {p.limits.maxGmbLocations > 0 ? (
                            <li style={{ color: "#cbd5e1" }}>
                              📍 <strong>{p.limits.maxGmbLocations}</strong> {p.limits.maxGmbLocations === 1 ? "GMB Local Maps Profile" : "GMB Local Maps Profiles"}{" "}
                              <span style={{ color: "#10b981", fontWeight: 600 }}>(AI Review Responder & Insights)</span>
                            </li>
                          ) : (
                            <li style={{ color: "#64748b" }}>📍 No GMB Local Maps</li>
                          )}

                          {/* Businesses */}
                          <li style={{ color: "#cbd5e1" }}>
                            🏢 <strong>{p.limits.maxBusinesses}</strong> {p.limits.maxBusinesses === 1 ? "Isolated Workspace" : "Workspaces"}
                          </li>

                          {/* Image Generation */}
                          <li style={{ color: "#cbd5e1" }}>
                            🎨 <strong>{p.quotas.IMAGE_GENERATION}</strong> AI Images/mo (gpt-image-2)
                          </li>

                          {/* Autopilot Toggles */}
                          <li style={{ color: p.features.SEO_AUTOPILOT ? "#34d399" : "#64748b" }}>
                            {p.features.SEO_AUTOPILOT ? "✓ Autonomous SEO Autopilot" : "✕ SEO Autopilot Not Included"}
                          </li>
                          <li style={{ color: p.features.SOCIAL_AUTOPILOT ? "#34d399" : "#64748b" }}>
                            {p.features.SOCIAL_AUTOPILOT ? "✓ Autonomous Social Autopilot" : "✕ Social Autopilot Not Included"}
                          </li>
                          {p.features.GMB_AUTOPILOT && (
                            <li style={{ color: "#34d399" }}>
                              ✓ 5-Min AI Review Responder & Maps Sync
                            </li>
                          )}
                          <li style={{ color: "#34d399", fontSize: 11.5 }}>
                            ✓ 1 Free Test Post Included (Zero Slot Lock)
                          </li>
                        </ul>
                      </div>

                      <button
                        onClick={() => handleSelectPlan(p)}
                        disabled={isCurrent}
                        style={{
                          width: "100%",
                          padding: "12px",
                          borderRadius: 14,
                          border: "none",
                          background: isCurrent
                            ? "rgba(255, 255, 255, 0.08)"
                            : isPopular
                            ? "#2563eb"
                            : "rgba(255, 255, 255, 0.12)",
                          color: isCurrent ? "#94a3b8" : "#ffffff",
                          fontWeight: 700,
                          fontSize: 13,
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
            </>
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
                  <span style={{ fontWeight: 600, color: "#cbd5e1", fontSize: 13 }}>
                    {selectedPlan.billingCycle === "trial_7d" ? "7-Day Trial (One-Time)" : "Monthly (30 Days)"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>
                  <span style={{ color: "#ffffff", fontWeight: 700, fontSize: 14 }}>
                    {selectedPlan.billingCycle === "trial_7d" ? "Total Trial Price:" : "Total Monthly Price:"}
                  </span>
                  <span style={{ fontWeight: 800, color: "#34d399", fontSize: 18 }}>
                    ₹{selectedPlan.priceINR.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              {/* Razorpay Primary Instant Payment */}
              <button
                onClick={handleRazorpayCheckout}
                disabled={submitting}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: 14,
                  border: "none",
                  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                  color: "#ffffff",
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: submitting ? "not-allowed" : "pointer",
                  boxShadow: "0 0 25px rgba(37, 99, 235, 0.45)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  marginBottom: 16,
                  transition: "all 0.15s ease",
                }}
              >
                <span>⚡</span>
                <span>
                  {submitting
                    ? "Connecting to Razorpay…"
                    : `Pay ₹${selectedPlan.priceINR.toLocaleString("en-IN")} via Razorpay (UPI / Cards)`}
                </span>
              </button>

              <div style={{ textAlign: "center", margin: "16px 0", color: "#64748b", fontSize: 11, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                <span>OR MANUAL BANK / UPI REFERENCE</span>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                  Offline Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR / UPI Ref if paid externally"
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
                  disabled={submitting || !paymentRef.trim()}
                  style={{
                    flex: 1.5,
                    padding: "12px",
                    borderRadius: 12,
                    border: "none",
                    background: paymentRef.trim() ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.04)",
                    color: paymentRef.trim() ? "#ffffff" : "#64748b",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: paymentRef.trim() && !submitting ? "pointer" : "not-allowed",
                  }}
                >
                  Submit Manual Request
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: CONFIRMATION */}
          {step === "confirmation" && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
              <h3 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px", color: orderResult?.isInstant ? "#34d399" : "#ffffff" }}>
                {orderResult?.isInstant ? "Subscription Activated Instantly!" : "Subscription Request Placed!"}
              </h3>
              <p style={{ color: "#94a3b8", fontSize: 13, maxWidth: 420, margin: "0 auto 24px", lineHeight: 1.6 }}>
                {orderResult?.isInstant ? (
                  <>
                    Payment verified successfully via Razorpay! Your <strong>{selectedPlan?.name}</strong> plan is now active with all 30-day asset slots and monthly quotas unlocked.
                  </>
                ) : (
                  <>
                    Your request for the <strong>{selectedPlan?.name}</strong> plan (₹{selectedPlan?.priceINR}/month) has been recorded.
                    Our team will verify payment and activate your monthly allowances immediately.
                  </>
                )}
              </p>
              <button
                onClick={handleClose}
                style={{
                  padding: "12px 28px",
                  borderRadius: 12,
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  boxShadow: "0 0 20px rgba(37, 99, 235, 0.4)",
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
