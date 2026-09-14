// pages/plans.js
/**
 * GabbarInfo AI — Subscription Plans Page
 * 
 * Standalone full-page plan selection with Razorpay checkout.
 * Accessible at: ai.gabbarinfo.com/plans
 * Features a close (X) button to return to the dashboard.
 */

import { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/router";
import Head from "next/head";
import { SUBSCRIPTION_PLANS } from "../lib/billing/plans";

// ─── Plan categories for tab navigation ───────────────────────────────────────
const CATEGORIES = [
  { key: "suite",  emoji: "⚡", label: "All-in-One Suites" },
  { key: "seo",    emoji: "📝", label: "SEO Content" },
  { key: "social", emoji: "📱", label: "Social Autopilot" },
  { key: "ads",    emoji: "🚀", label: "Performance Ads" },
  { key: "gmb",    emoji: "📍", label: "Local Maps" },
  { key: "bundle", emoji: "🔗", label: "Power Bundles" },
  { key: "trial",  emoji: "🎁", label: "Trial Pack" },
  { key: "agency", emoji: "🏢", label: "Agency Scale" },
];

// ─── Ordered plan list ─────────────────────────────────────────────────────────
const ALL_PLANS = [
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

// ─── Helper: pretty category labels ───────────────────────────────────────────
function categoryMeta(key) {
  return CATEGORIES.find((c) => c.key === key) || { emoji: "📦", label: key };
}

// ─── Feature badge chip ────────────────────────────────────────────────────────
function Chip({ label }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 9px", borderRadius: 99,
      background: "rgba(59,130,246,0.13)", border: "1px solid rgba(59,130,246,0.25)",
      color: "#93c5fd", fontSize: 11, fontFamily: "'Plus Jakarta Sans', sans-serif",
      whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

export default function PlansPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeCategory, setActiveCategory] = useState("suite");
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [step, setStep] = useState("browse"); // "browse" | "checkout" | "success"
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [paymentRef, setPaymentRef] = useState("");

  const filteredPlans = ALL_PLANS.filter((p) => p.category === activeCategory);

  // ─── Close → back to dashboard ──────────────────────────────────────────────
  function handleClose() {
    router.push("/");
  }

  // ─── Select plan → move to checkout step ────────────────────────────────────
  function handleSelectPlan(plan) {
    if (!session) { signIn("google"); return; }
    setSelectedPlan(plan);
    setStep("checkout");
    setErrorMsg(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ─── Razorpay Checkout ───────────────────────────────────────────────────────
  async function handleRazorpayCheckout() {
    if (!selectedPlan) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      // 1. Load Razorpay SDK
      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = resolve;
          script.onerror = () => reject(new Error("Failed to load Razorpay checkout script."));
          document.body.appendChild(script);
        });
      }

      // 2. Create order on server
      const res = await fetch("/api/billing/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlan.id }),
      });
      const orderData = await res.json();
      if (!res.ok) throw new Error(orderData.error || "Failed to create order.");

      // 3. Open Razorpay modal
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "GabbarInfo AI",
        description: selectedPlan.name,
        order_id: orderData.orderId,
        prefill: {
          name: orderData.customer?.name || "",
          email: orderData.customer?.email || "",
        },
        theme: { color: "#3b82f6" },
        modal: { backdropclose: false, escape: false },

        handler: async function (response) {
          // 4. Verify payment on server
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
          if (!verifyRes.ok) throw new Error(verifyData.error || "Payment verification failed.");

          setPaymentRef(response.razorpay_payment_id);
          setStep("success");
          setSubmitting(false);
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (response) => {
        setErrorMsg(response.error?.description || "Payment failed. Please try again.");
        setSubmitting(false);
      });
      rzp.open();

    } catch (err) {
      setErrorMsg(err.message || "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  // ─── Feature chip list for a plan ───────────────────────────────────────────
  function planFeatureChips(plan) {
    const chips = [];
    if (plan.features?.SEO_AUTOPILOT) chips.push("SEO Autopilot");
    if (plan.features?.SOCIAL_AUTOPILOT) chips.push("Social Autopilot");
    if (plan.features?.META_ADS) chips.push("Meta Ads");
    if (plan.features?.GOOGLE_ADS) chips.push("Google Ads");
    if (plan.features?.GMB_AUTOPILOT) chips.push("Google Maps");
    if (plan.features?.IMAGE_GENERATION) chips.push("AI Images");
    if (plan.features?.AI_CHAT) chips.push("AI Chat");
    return chips;
  }

  // ─── Quota summary line ──────────────────────────────────────────────────────
  function quotaSummary(plan) {
    const q = plan.quotas || {};
    const parts = [];
    if (q.SEO_ARTICLE > 0) parts.push(`${q.SEO_ARTICLE} Blogs/mo`);
    if (q.SOCIAL_POST > 0) parts.push(`${q.SOCIAL_POST} Social Posts/mo`);
    if (q.GOOGLE_CAMPAIGN > 0) parts.push(`${q.GOOGLE_CAMPAIGN} Google Ads`);
    if (q.META_CAMPAIGN > 0) parts.push(`${q.META_CAMPAIGN} Meta Ads`);
    if (q.IMAGE_GENERATION > 0) parts.push(`${q.IMAGE_GENERATION} AI Images`);
    return parts.join(" · ");
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────────
  return (
    <>
      <Head>
        <title>GabbarInfo AI — Subscription Plans</title>
        <meta name="description" content="Choose a GabbarInfo AI subscription plan. Autonomous SEO, Social Media, Google Ads, Meta Ads, and Local Maps AI for Indian businesses." />
        <meta name="robots" content="noindex" />
      </Head>

      <div style={{
        minHeight: "100vh", background: "#080b11",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        color: "#f8fafc", position: "relative",
      }}>

        {/* ── Ambient Background ─────────────────────────────────────────── */}
        <div style={{
          position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(59,130,246,0.12) 0%, transparent 70%)",
        }} />

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header style={{
          position: "sticky", top: 0, zIndex: 100,
          background: "rgba(8,11,17,0.92)", backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 24px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{
              fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 20,
              background: "linear-gradient(135deg,#fff 0%,#93c5fd 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              GabbarInfo AI
            </span>
            <span style={{
              fontSize: 11, color: "rgba(255,255,255,0.38)", fontWeight: 500,
              letterSpacing: "0.06em", textTransform: "uppercase",
            }}>
              · Subscription Plans
            </span>
          </div>

          {/* Close button */}
          <button
            onClick={handleClose}
            id="plans-close-btn"
            title="Back to Dashboard"
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8, padding: "7px 14px", color: "rgba(255,255,255,0.7)",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            Close
          </button>
        </header>

        {/* ── Main Content ────────────────────────────────────────────────── */}
        <main style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 20px 80px", position: "relative", zIndex: 1 }}>

          {/* ── BROWSE STEP ────────────────────────────────────────────── */}
          {step === "browse" && (
            <>
              {/* Hero */}
              <div style={{ textAlign: "center", marginBottom: 48 }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)",
                  borderRadius: 99, padding: "5px 16px", marginBottom: 20,
                  fontSize: 12, color: "#93c5fd", fontWeight: 600, letterSpacing: "0.05em",
                }}>
                  🤖 AUTONOMOUS AI MARKETING PLATFORM
                </div>
                <h1 style={{
                  fontFamily: "'Outfit', sans-serif", fontSize: "clamp(28px, 5vw, 48px)",
                  fontWeight: 800, margin: "0 0 16px",
                  background: "linear-gradient(135deg,#fff 0%,#93c5fd 50%,#c084fc 100%)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  lineHeight: 1.15,
                }}>
                  Choose Your Growth Plan
                </h1>
                <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 16, maxWidth: 560, margin: "0 auto 12px" }}>
                  All plans include a 30-day billing cycle. Credits deducted at AI generation start.
                  Unused quota does not carry forward.
                </p>
                {!session && (
                  <button
                    onClick={() => signIn("google")}
                    style={{
                      marginTop: 16,
                      background: "#fff", color: "#080b11",
                      border: "none", borderRadius: 10,
                      padding: "10px 24px", fontWeight: 700, fontSize: 14,
                      cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
                    }}
                  >
                    Sign in with Google to Subscribe
                  </button>
                )}
              </div>

              {/* Category Tabs */}
              <div style={{
                display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 36,
              }}>
                {CATEGORIES.map((cat) => {
                  const isActive = activeCategory === cat.key;
                  const hasPlans = ALL_PLANS.some((p) => p.category === cat.key);
                  if (!hasPlans) return null;
                  return (
                    <button
                      key={cat.key}
                      onClick={() => setActiveCategory(cat.key)}
                      id={`plans-tab-${cat.key}`}
                      style={{
                        padding: "8px 18px", borderRadius: 99,
                        background: isActive ? "#3b82f6" : "rgba(255,255,255,0.06)",
                        border: isActive ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.1)",
                        color: isActive ? "#fff" : "rgba(255,255,255,0.6)",
                        fontSize: 13, fontWeight: 600, cursor: "pointer",
                        transition: "all 0.2s ease",
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                      }}
                    >
                      {cat.emoji} {cat.label}
                    </button>
                  );
                })}
              </div>

              {/* Plan Cards Grid */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: 20,
              }}>
                {filteredPlans.map((plan) => {
                  const chips = planFeatureChips(plan);
                  const isTrial = plan.category === "trial";
                  return (
                    <div
                      key={plan.id}
                      id={`plan-card-${plan.id}`}
                      style={{
                        background: isTrial
                          ? "linear-gradient(135deg,rgba(16,185,129,0.08) 0%,rgba(8,11,17,0.95) 100%)"
                          : "rgba(255,255,255,0.03)",
                        border: isTrial
                          ? "1px solid rgba(16,185,129,0.3)"
                          : "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 16, padding: "24px",
                        display: "flex", flexDirection: "column", gap: 16,
                        transition: "transform 0.2s ease, box-shadow 0.2s ease",
                        cursor: "default",
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = "translateY(-3px)";
                        e.currentTarget.style.boxShadow = "0 8px 32px rgba(59,130,246,0.15)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      {/* Plan name & price */}
                      <div>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                          <h2 style={{
                            fontFamily: "'Outfit', sans-serif", fontWeight: 700,
                            fontSize: 17, margin: 0, color: "#f8fafc", lineHeight: 1.3,
                          }}>
                            {plan.name}
                          </h2>
                          {isTrial && (
                            <span style={{
                              fontSize: 10, background: "rgba(16,185,129,0.2)", color: "#6ee7b7",
                              border: "1px solid rgba(16,185,129,0.3)", borderRadius: 99,
                              padding: "2px 8px", fontWeight: 700, whiteSpace: "nowrap",
                              letterSpacing: "0.05em",
                            }}>
                              TRIAL
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", margin: "6px 0 0", lineHeight: 1.5 }}>
                          {plan.description}
                        </p>
                      </div>

                      {/* Price */}
                      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                        <span style={{
                          fontFamily: "'Outfit', sans-serif", fontWeight: 800,
                          fontSize: 32, color: "#fff",
                        }}>
                          ₹{plan.priceINR.toLocaleString("en-IN")}
                        </span>
                        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                          /{plan.billingCycle === "trial_7d" ? "7 days" : "month"}
                        </span>
                      </div>

                      {/* Quota summary */}
                      {quotaSummary(plan) && (
                        <p style={{
                          fontSize: 12, color: "rgba(255,255,255,0.5)",
                          background: "rgba(255,255,255,0.04)", borderRadius: 8,
                          padding: "8px 12px", margin: 0, lineHeight: 1.6,
                        }}>
                          {quotaSummary(plan)}
                        </p>
                      )}

                      {/* Feature chips */}
                      {chips.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {chips.map((c) => <Chip key={c} label={c} />)}
                        </div>
                      )}

                      {/* CTA */}
                      <button
                        onClick={() => handleSelectPlan(plan)}
                        id={`plan-select-${plan.id}`}
                        className="btn-gabbar-primary"
                        style={{
                          marginTop: "auto", padding: "12px 20px",
                          fontSize: 14, borderRadius: 10, border: "none",
                          cursor: "pointer", fontWeight: 700,
                        }}
                      >
                        {session ? `Get ${plan.name.split("(")[0].trim()}` : "Sign in to Subscribe"}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Disclaimer */}
              <p style={{
                textAlign: "center", marginTop: 40, fontSize: 12,
                color: "rgba(255,255,255,0.3)", maxWidth: 640, margin: "40px auto 0",
                lineHeight: 1.7,
              }}>
                Credits are deducted at the time AI generation starts, not at publishing.
                Unused monthly quotas and bonus credits expire at cycle end and do not carry forward.
                All payments are processed securely by Razorpay (PCI-DSS Level 1 certified).
                By subscribing, you agree to our{" "}
                <a href="https://www.gabbarinfo.com/terms-and-conditions/" target="_blank" rel="noopener noreferrer"
                  style={{ color: "#93c5fd", textDecoration: "none" }}>Terms & Conditions</a>{" "}and{" "}
                <a href="https://www.gabbarinfo.com/cancellation-refund-policy/" target="_blank" rel="noopener noreferrer"
                  style={{ color: "#93c5fd", textDecoration: "none" }}>Refund Policy</a>.
              </p>
            </>
          )}

          {/* ── CHECKOUT STEP ──────────────────────────────────────────── */}
          {step === "checkout" && selectedPlan && (
            <div style={{ maxWidth: 520, margin: "0 auto" }}>
              {/* Back */}
              <button
                onClick={() => { setStep("browse"); setErrorMsg(null); }}
                style={{
                  display: "flex", alignItems: "center", gap: 6, marginBottom: 28,
                  background: "none", border: "none", color: "rgba(255,255,255,0.5)",
                  fontSize: 13, cursor: "pointer", padding: 0, fontWeight: 600,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Back to Plans
              </button>

              {/* Order summary card */}
              <div style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 20, padding: 28, marginBottom: 20,
              }}>
                <h2 style={{
                  fontFamily: "'Outfit', sans-serif", fontWeight: 800,
                  fontSize: 22, margin: "0 0 6px",
                }}>
                  Order Summary
                </h2>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, margin: "0 0 24px" }}>
                  Review your plan before payment
                </p>

                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.07)",
                }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{selectedPlan.name}</p>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                      {selectedPlan.billingCycle === "trial_7d" ? "7-day trial pack" : "Monthly subscription · 30 days"}
                    </p>
                  </div>
                  <div style={{
                    fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 26,
                  }}>
                    ₹{selectedPlan.priceINR.toLocaleString("en-IN")}
                  </div>
                </div>

                <div style={{ paddingTop: 16 }}>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "0 0 4px" }}>
                    📌 Credits deducted at AI generation start — not at publishing.
                  </p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: 0 }}>
                    📌 Unused quota expires at cycle end. Non-refundable per our{" "}
                    <a href="https://www.gabbarinfo.com/cancellation-refund-policy/" target="_blank" rel="noopener noreferrer"
                      style={{ color: "#93c5fd" }}>Refund Policy</a>.
                  </p>
                </div>
              </div>

              {/* Error */}
              {errorMsg && (
                <div style={{
                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: 10, padding: "12px 16px", marginBottom: 16,
                  color: "#fca5a5", fontSize: 13,
                }}>
                  ⚠️ {errorMsg}
                </div>
              )}

              {/* Pay button */}
              <button
                id="checkout-pay-btn"
                onClick={handleRazorpayCheckout}
                disabled={submitting}
                className="btn-gabbar-primary"
                style={{
                  width: "100%", padding: "15px 24px",
                  fontSize: 15, borderRadius: 12, border: "none",
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.7 : 1, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {submitting ? (
                  <>
                    <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
                    Connecting to Razorpay…
                  </>
                ) : (
                  <>
                    🔒 Pay ₹{selectedPlan.priceINR.toLocaleString("en-IN")} via Razorpay (UPI / Cards / Net Banking)
                  </>
                )}
              </button>

              <p style={{
                textAlign: "center", marginTop: 14, fontSize: 11,
                color: "rgba(255,255,255,0.28)",
              }}>
                Secured by Razorpay · PCI-DSS Level 1 · 256-bit SSL
              </p>
            </div>
          )}

          {/* ── SUCCESS STEP ───────────────────────────────────────────── */}
          {step === "success" && selectedPlan && (
            <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%",
                background: "rgba(16,185,129,0.15)", border: "2px solid rgba(16,185,129,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 32, margin: "0 auto 24px",
              }}>
                🎉
              </div>

              <h1 style={{
                fontFamily: "'Outfit', sans-serif", fontWeight: 800,
                fontSize: 28, margin: "0 0 12px",
                background: "linear-gradient(135deg,#6ee7b7,#3b82f6)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                Payment Verified!
              </h1>

              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 15, margin: "0 0 8px" }}>
                <strong style={{ color: "#fff" }}>{selectedPlan.name}</strong> is now active for 30 days.
                All your quotas and features are unlocked.
              </p>

              {paymentRef && (
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: "0 0 32px" }}>
                  Payment ID: {paymentRef}
                </p>
              )}

              <button
                id="success-go-dashboard"
                onClick={() => router.push("/")}
                className="btn-gabbar-primary"
                style={{
                  padding: "13px 32px", fontSize: 15, borderRadius: 12,
                  border: "none", cursor: "pointer", fontWeight: 700,
                  display: "inline-flex", alignItems: "center", gap: 8,
                }}
              >
                Go to Dashboard →
              </button>
            </div>
          )}
        </main>
      </div>

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
