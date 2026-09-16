// pages/video-plans.js
/**
 * GabbarInfo AI — Standalone Cinematic Long-Form Video Plans & Studio Subscription
 * 
 * Inspired by Runway / Higgsfield cinematic video creation.
 * Features:
 * 1. Looping full-width 1080p AI cinematic video hero.
 * 2. Interactive duration (1m, 2m, 3m, 5m+) & character cast (Solo, Duo, Ensemble) selector.
 * 3. Authoritative subscription tiers (Creator, Pro, Cinema) with instant Razorpay checkout.
 * 4. Standalone Pay-As-You-Go single video packs.
 */

import { useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { SUBSCRIPTION_PLANS } from "../lib/billing/plans";

// Main monthly subscription plans
const VIDEO_PLANS = [
  {
    ...SUBSCRIPTION_PLANS.video_creator,
    badge: "Solo & Duo",
    durationLabel: "Up to 2 Min Videos",
    characterLabel: "1 - 2 Characters",
    accentColor: "#38bdf8",
    bullets: [
      "25 Minutes AI Video / month",
      "Up to 2 Minutes duration per video",
      "Solo & Duo multi-character dialogue",
      "Distinct voice synthesis per character",
      "1080p Full HD Cinematic export",
      "Standard rendering queue",
    ],
  },
  {
    ...SUBSCRIPTION_PLANS.video_pro,
    badge: "Runway-Grade · Most Popular",
    durationLabel: "Up to 3 Min Videos",
    characterLabel: "1 - 3 Characters",
    accentColor: "#a855f7",
    popular: true,
    bullets: [
      "70 Minutes AI Video / month",
      "Up to 3 Minutes duration per video",
      "Up to 3 Cast characters with unique voices",
      "Zero forced narration — Pure movie dialogue & B-roll",
      "Dynamic camera physics & scene composition",
      "Priority GPU cloud rendering queue",
      "1080p Full HD 60fps export",
    ],
  },
  {
    ...SUBSCRIPTION_PLANS.video_cinema,
    badge: "Cinema & Agency Scale",
    durationLabel: "Up to 5 Min Videos",
    characterLabel: "Unlimited Cast (10+)",
    accentColor: "#f59e0b",
    bullets: [
      "200 Minutes AI Video / month",
      "Up to 5 Minutes duration per video",
      "Unlimited ensemble cast & dialogue acting",
      "Ultra-priority dedicated worker allocation",
      "Full commercial rights & zero watermark",
      "Custom brand voice cloning & styling",
      "24/7 VIP studio support",
    ],
  },
].filter(Boolean);

// Standalone Pay-As-You-Go single video packs
const VIDEO_PACKS = [
  {
    id: "video_pack_1min",
    name: "1-Minute Cinematic Pack",
    priceINR: 99,
    length: "1 Minute",
    scenes: "4 Cinematic Shots",
    cast: "Up to 2 Characters",
    desc: "Perfect for quick skits, Reels, and TikTok movie hooks.",
  },
  {
    id: "video_pack_2min",
    name: "2-Minute Cinematic Pack",
    priceINR: 189,
    length: "2 Minutes",
    scenes: "8 Cinematic Shots",
    cast: "Up to 2 Characters",
    desc: "Ideal for short cinematic stories and narrative scenes.",
  },
  {
    id: "video_pack_3min",
    name: "3-Minute Cinematic Pack",
    priceINR: 279,
    length: "3 Minutes",
    scenes: "12 Cinematic Shots",
    cast: "Up to 3 Characters",
    desc: "Full drama / comedy skit with 3 distinct character voices.",
  },
  {
    id: "video_pack_5min",
    name: "5-Minute Cinematic Pack",
    priceINR: 449,
    length: "5 Minutes",
    scenes: "20 Cinematic Shots",
    cast: "Up to 5 Characters",
    desc: "Complete YouTube cinematic episode with ensemble cast.",
  },
];

export default function VideoPlansPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const ADMIN_EMAIL = "ndantare@gmail.com";
  const isAdmin = session?.user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  // Interactive matrix state
  const [selectedDuration, setSelectedDuration] = useState("2m"); // "1m", "2m", "3m", "5m"
  const [selectedCharacters, setSelectedCharacters] = useState("2"); // "1", "2", "3", "ensemble"
  
  // Checkout states
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successPaymentId, setSuccessPaymentId] = useState(null);

  // Recommended plan based on user duration and character preference
  const getRecommendedPlanId = () => {
    if (selectedDuration === "5m" || selectedCharacters === "ensemble") return "video_cinema";
    if (selectedDuration === "3m" || selectedCharacters === "3") return "video_pro";
    return "video_creator";
  };

  const recommendedPlanId = getRecommendedPlanId();

  if (!isAdmin) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#070a13",
          color: "#f8fafc",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <Head>
          <title>Cinematic Video Plans — Coming Soon | GabbarInfo AI</title>
        </Head>
        <div
          style={{
            maxWidth: 580,
            width: "100%",
            textAlign: "center",
            padding: "48px 32px",
            borderRadius: 24,
            background: "rgba(15, 23, 42, 0.8)",
            border: "1px solid rgba(168, 85, 247, 0.3)",
            boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
          }}
        >
          <div style={{ fontSize: 52, marginBottom: 16 }}>🎬</div>
          <span
            style={{
              display: "inline-block",
              padding: "4px 12px",
              borderRadius: 99,
              background: "rgba(168, 85, 247, 0.15)",
              border: "1px solid rgba(168, 85, 247, 0.3)",
              color: "#c084fc",
              fontWeight: 800,
              fontSize: 12,
              marginBottom: 16,
            }}
          >
            🔒 Private Studio Calibration
          </span>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12, color: "#fff" }}>
            Cinematic Long-Form Video Plans — Coming Soon
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
            We are currently fine-tuning our neural cinematic rendering, multi-character dialogue engine, and lip-sync synchronization in private studio calibration. Standalone packages will be released publicly soon.
          </p>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 28px",
              borderRadius: 12,
              background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            ← Return to Command Center
          </Link>
        </div>
      </div>
    );
  }

  // ─── Razorpay Checkout Handler ──────────────────────────────────────────────
  async function handleCheckout(plan) {
    if (!session) {
      signIn("google");
      return;
    }

    setSelectedPlan(plan);
    setSubmitting(true);
    setErrorMsg(null);

    try {
      // 1. Ensure Razorpay SDK loaded
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
        body: JSON.stringify({ planId: plan.id }),
      });

      const orderData = await res.json();
      if (!res.ok) {
        throw new Error(orderData.error || "Failed to create Razorpay order.");
      }

      // 3. Open Razorpay Checkout modal
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "GabbarInfo AI Cinema Studio",
        description: plan.name,
        order_id: orderData.orderId,
        prefill: {
          name: orderData.customer?.name || "",
          email: orderData.customer?.email || "",
        },
        theme: { color: "#8b5cf6" },
        modal: { backdropclose: false, escape: false },

        handler: async function (paymentResponse) {
          // 4. Verify signature on backend
          try {
            const verifyRes = await fetch("/api/billing/razorpay/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: paymentResponse.razorpay_order_id,
                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                razorpay_signature: paymentResponse.razorpay_signature,
                planId: plan.id,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) {
              throw new Error(verifyData.error || "Payment verification failed.");
            }

            setSuccessPaymentId(paymentResponse.razorpay_payment_id);
            setSubmitting(false);
          } catch (vErr) {
            setErrorMsg(vErr.message || "Failed to verify payment with server.");
            setSubmitting(false);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (failRes) => {
        setErrorMsg(failRes.error?.description || "Payment was cancelled or failed.");
        setSubmitting(false);
      });
      rzp.open();

    } catch (err) {
      console.error("Checkout error:", err);
      setErrorMsg(err.message || "Something went wrong initiating payment.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Cinematic Long-Form AI Video Studio | GabbarInfo AI</title>
        <meta name="description" content="Generate high-end multi-character movie dialogues, dynamic camera moves, and hyper-realistic AI video scenes in 1 to 5 minute lengths." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet" />
      </Head>

      <div style={{
        minHeight: "100vh",
        background: "#08080c",
        color: "#f8fafc",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        overflowX: "hidden",
      }}>
        {/* ─── Top Runway-Style Nav Bar ─── */}
        <header style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(8, 8, 12, 0.85)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          padding: "16px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link href="/" style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              textDecoration: "none",
              color: "#fff",
              fontWeight: 800,
              fontSize: 18,
              letterSpacing: "-0.5px",
            }}>
              <span style={{
                background: "linear-gradient(135deg, #a855f7 0%, #38bdf8 100%)",
                borderRadius: 8,
                padding: "4px 8px",
                fontSize: 14,
                fontWeight: 900,
                color: "#fff",
              }}>AI</span>
              <span>gabbarinfo</span>
              <span style={{ color: "#a855f7", fontWeight: 600, fontSize: 13, textTransform: "uppercase", letterSpacing: "1px" }}>Cinema</span>
            </Link>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link href="/plans" style={{
              textDecoration: "none",
              color: "#94a3b8",
              fontSize: 13,
              fontWeight: 600,
              transition: "color 0.2s",
            }}>
              Marketing Plans
            </Link>
            <Link href="/" style={{
              textDecoration: "none",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#f1f5f9",
              padding: "7px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              transition: "all 0.2s",
            }}>
              ← Back to App
            </Link>
          </div>
        </header>

        {/* ─── Hero Slide with Looping 1080p AI Video ─── */}
        <section style={{
          position: "relative",
          width: "100%",
          minHeight: "520px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        }}>
          {/* Background Video */}
          <video
            autoPlay
            loop
            muted
            playsInline
            src="/videos/hero-cinema.mp4"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: "translate(-50%, -50%)",
              filter: "brightness(0.55) contrast(1.1)",
              zIndex: 1,
            }}
          />

          {/* Vignette & Gradient Overlays */}
          <div style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(circle at center, rgba(8,8,12,0.2) 0%, rgba(8,8,12,0.85) 85%), linear-gradient(180deg, rgba(8,8,12,0.6) 0%, transparent 40%, rgba(8,8,12,0.95) 95%)",
            zIndex: 2,
          }} />

          {/* Hero Content */}
          <div style={{
            position: "relative",
            zIndex: 3,
            maxWidth: 900,
            textAlign: "center",
            padding: "60px 24px 40px",
          }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 16px",
              borderRadius: 99,
              background: "rgba(168, 85, 247, 0.15)",
              border: "1px solid rgba(168, 85, 247, 0.35)",
              color: "#c084fc",
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginBottom: 20,
            }}>
              🎬 Runway & Higgsfield Grade Video Engine
            </div>

            <h1 style={{
              fontSize: "clamp(32px, 5.5vw, 56px)",
              fontWeight: 900,
              lineHeight: 1.1,
              letterSpacing: "-1.5px",
              marginBottom: 18,
              color: "#ffffff",
              textShadow: "0 2px 20px rgba(0,0,0,0.8)",
            }}>
              Cinematic Long-Form <br />
              <span style={{
                background: "linear-gradient(135deg, #a855f7 20%, #38bdf8 80%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
                AI Video Studio
              </span>
            </h1>

            <p style={{
              fontSize: "clamp(15px, 2vw, 18px)",
              color: "#cbd5e1",
              maxWidth: 680,
              margin: "0 auto 32px",
              lineHeight: 1.6,
              textShadow: "0 1px 10px rgba(0,0,0,0.8)",
            }}>
              Generate full multi-character movie scenes, authentic dialogues, dynamic cinematic camera moves, and hyper-realistic environments in 1 to 5 minute continuous narratives.
            </p>

            {/* Quick stats pills */}
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              justifyContent: "center",
              alignItems: "center",
            }}>
              <span style={{ background: "rgba(255,255,255,0.08)", padding: "8px 16px", borderRadius: 8, fontSize: 13, color: "#e2e8f0", border: "1px solid rgba(255,255,255,0.12)" }}>
                ⚡ <strong>1080p 60fps</strong> Cinema Master
              </span>
              <span style={{ background: "rgba(255,255,255,0.08)", padding: "8px 16px", borderRadius: 8, fontSize: 13, color: "#e2e8f0", border: "1px solid rgba(255,255,255,0.12)" }}>
                🎭 <strong>Multi-Character</strong> Skits & Dialogue
              </span>
              <span style={{ background: "rgba(255,255,255,0.08)", padding: "8px 16px", borderRadius: 8, fontSize: 13, color: "#e2e8f0", border: "1px solid rgba(255,255,255,0.12)" }}>
                🎙️ <strong>Zero Forced Narration</strong>
              </span>
            </div>
          </div>
        </section>

        {/* ─── Interactive Duration & Cast Calculator / Matrix ─── */}
        <section style={{
          maxWidth: 1100,
          margin: "-30px auto 40px",
          padding: "0 20px",
          position: "relative",
          zIndex: 10,
        }}>
          <div style={{
            background: "rgba(15, 15, 23, 0.95)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: 20,
            padding: "28px 32px",
            boxShadow: "0 20px 40px -15px rgba(0,0,0,0.7)",
            backdropFilter: "blur(20px)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 4px", color: "#f8fafc" }}>
                  Interactive Length & Cast Selector
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>
                  Select your target video duration and cast size to see recommended plans and shot complexity.
                </p>
              </div>

              <div style={{
                background: "rgba(168, 85, 247, 0.12)",
                border: "1px solid rgba(168, 85, 247, 0.3)",
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: 12,
                color: "#c084fc",
                fontWeight: 700,
              }}>
                Match: {recommendedPlanId === "video_creator" ? "Creator Studio" : recommendedPlanId === "video_pro" ? "Pro Production Studio" : "Cinema & Agency"}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
              {/* Duration Selector */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>
                  1. Video Duration
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {[
                    { id: "1m", label: "1 Min", sub: "4 shots" },
                    { id: "2m", label: "2 Mins", sub: "8 shots" },
                    { id: "3m", label: "3 Mins", sub: "12 shots" },
                    { id: "5m", label: "5 Mins+", sub: "20 shots" },
                  ].map((d) => {
                    const active = selectedDuration === d.id;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setSelectedDuration(d.id)}
                        style={{
                          background: active ? "linear-gradient(135deg, #a855f7 0%, #6366f1 100%)" : "rgba(255,255,255,0.05)",
                          border: active ? "1px solid #c084fc" : "1px solid rgba(255,255,255,0.08)",
                          color: active ? "#fff" : "#cbd5e1",
                          borderRadius: 10,
                          padding: "12px 6px",
                          cursor: "pointer",
                          textAlign: "center",
                          transition: "all 0.2s",
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: 14 }}>{d.label}</div>
                        <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2 }}>{d.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Character Cast Selector */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>
                  2. Character Cast Size
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {[
                    { id: "1", label: "Solo (1)", sub: "1 Voice" },
                    { id: "2", label: "Duo (2)", sub: "2 Voices" },
                    { id: "3", label: "Trio (3)", sub: "3 Voices" },
                    { id: "ensemble", label: "Ensemble", sub: "All Cast" },
                  ].map((c) => {
                    const active = selectedCharacters === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCharacters(c.id)}
                        style={{
                          background: active ? "linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)" : "rgba(255,255,255,0.05)",
                          border: active ? "1px solid #7dd3fc" : "1px solid rgba(255,255,255,0.08)",
                          color: active ? "#fff" : "#cbd5e1",
                          borderRadius: 10,
                          padding: "12px 6px",
                          cursor: "pointer",
                          textAlign: "center",
                          transition: "all 0.2s",
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: 14 }}>{c.label}</div>
                        <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2 }}>{c.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Error Notification Banner ─── */}
        {errorMsg && (
          <div style={{
            maxWidth: 1100,
            margin: "0 auto 24px",
            padding: "14px 20px",
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.35)",
            borderRadius: 12,
            color: "#fca5a5",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <span>⚠️ {errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              style={{ background: "transparent", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: 16 }}
            >
              ✕
            </button>
          </div>
        )}

        {/* ─── Main Monthly Subscription Tiers ─── */}
        <section style={{ maxWidth: 1180, margin: "0 auto 60px", padding: "0 20px" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <h2 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-1px", margin: "0 0 10px" }}>
              Choose Your Long-Form Studio Plan
            </h2>
            <p style={{ color: "#94a3b8", fontSize: 15, margin: 0 }}>
              All plans include 1080p full resolution, multi-character dialogue engine, and instant cloud rendering.
            </p>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 24,
            alignItems: "stretch",
          }}>
            {VIDEO_PLANS.map((plan) => {
              const isRecommended = recommendedPlanId === plan.id;
              const isPopular = plan.popular;

              return (
                <div
                  key={plan.id}
                  style={{
                    position: "relative",
                    background: isRecommended
                      ? "linear-gradient(180deg, rgba(26, 20, 38, 0.95) 0%, rgba(15, 15, 23, 0.95) 100%)"
                      : "rgba(15, 15, 23, 0.8)",
                    border: isRecommended
                      ? "2px solid #a855f7"
                      : "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 20,
                    padding: "36px 28px",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: isRecommended
                      ? "0 0 35px -5px rgba(168, 85, 247, 0.35)"
                      : "0 10px 30px -10px rgba(0,0,0,0.5)",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  {/* Top Badge */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <span style={{
                      display: "inline-block",
                      padding: "4px 12px",
                      borderRadius: 99,
                      fontSize: 11,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      background: isPopular ? "rgba(168, 85, 247, 0.2)" : "rgba(255,255,255,0.08)",
                      border: isPopular ? "1px solid #a855f7" : "1px solid rgba(255,255,255,0.15)",
                      color: isPopular ? "#d8b4fe" : "#cbd5e1",
                    }}>
                      {plan.badge}
                    </span>

                    {isRecommended && (
                      <span style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: "#38bdf8",
                        background: "rgba(56, 189, 248, 0.12)",
                        border: "1px solid rgba(56, 189, 248, 0.3)",
                        padding: "3px 10px",
                        borderRadius: 99,
                      }}>
                        ✓ Best Match
                      </span>
                    )}
                  </div>

                  {/* Plan Title & Price */}
                  <h3 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px", color: "#f8fafc" }}>
                    {plan.name}
                  </h3>
                  <p style={{ fontSize: 13, color: "#94a3b8", minHeight: 40, margin: "0 0 20px", lineHeight: 1.5 }}>
                    {plan.description}
                  </p>

                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 24, paddingBottom: 24, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#94a3b8" }}>₹</span>
                    <span style={{ fontSize: 44, fontWeight: 900, color: "#ffffff", letterSpacing: "-1px" }}>
                      {plan.priceINR.toLocaleString("en-IN")}
                    </span>
                    <span style={{ fontSize: 14, color: "#94a3b8" }}>/ month</span>
                  </div>

                  {/* Capabilities Highlight */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                    marginBottom: 24,
                    background: "rgba(255,255,255,0.03)",
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}>
                    <div>
                      <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase" }}>Max Length</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>{plan.durationLabel}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase" }}>Character Cast</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>{plan.characterLabel}</div>
                    </div>
                  </div>

                  {/* Bullets */}
                  <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", flexGrow: 1 }}>
                    {plan.bullets.map((b, idx) => (
                      <li key={idx} style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        fontSize: 13,
                        color: "#cbd5e1",
                        marginBottom: 12,
                        lineHeight: 1.4,
                      }}>
                        <span style={{ color: plan.accentColor, fontWeight: 800, fontSize: 15, lineHeight: 1 }}>✓</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <button
                    type="button"
                    onClick={() => handleCheckout(plan)}
                    disabled={submitting}
                    style={{
                      width: "100%",
                      padding: "14px 20px",
                      borderRadius: 12,
                      border: "none",
                      background: isRecommended
                        ? "linear-gradient(135deg, #a855f7 0%, #6366f1 100%)"
                        : "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                      color: "#ffffff",
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: submitting ? "not-allowed" : "pointer",
                      boxShadow: isRecommended
                        ? "0 4px 20px -2px rgba(168, 85, 247, 0.5)"
                        : "0 4px 15px -2px rgba(37, 99, 235, 0.4)",
                      transition: "all 0.2s",
                    }}
                  >
                    {submitting && selectedPlan?.id === plan.id ? "Processing with Razorpay..." : `Subscribe with Razorpay (₹${plan.priceINR.toLocaleString("en-IN")})`}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── Pay-As-You-Go Video Packs Section ─── */}
        <section style={{
          maxWidth: 1100,
          margin: "0 auto 80px",
          padding: "40px 20px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{
              display: "inline-block",
              padding: "4px 12px",
              borderRadius: 99,
              background: "rgba(56, 189, 248, 0.12)",
              border: "1px solid rgba(56, 189, 248, 0.25)",
              color: "#38bdf8",
              fontSize: 11,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: 12,
            }}>
              Need Just One Video?
            </div>
            <h3 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 8px" }}>
              Pay-As-You-Go Single Video Packs
            </h3>
            <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>
              No monthly recurring subscription required. Buy single video credits with instant live generation.
            </p>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
          }}>
            {VIDEO_PACKS.map((pack) => (
              <div
                key={pack.id}
                style={{
                  background: "rgba(15, 15, 23, 0.6)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 16,
                  padding: "24px 20px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9" }}>{pack.length}</span>
                    <span style={{ fontSize: 20, fontWeight: 900, color: "#38bdf8" }}>₹{pack.priceINR}</span>
                  </div>

                  <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 16px", minHeight: 36 }}>
                    {pack.desc}
                  </p>

                  <div style={{ fontSize: 11, color: "#cbd5e1", marginBottom: 6 }}>
                    🎬 <strong>{pack.scenes}</strong>
                  </div>
                  <div style={{ fontSize: 11, color: "#cbd5e1", marginBottom: 20 }}>
                    🎭 <strong>{pack.cast}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleCheckout({ id: pack.id, name: pack.name, priceINR: pack.priceINR })}
                  disabled={submitting}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#f8fafc",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: submitting ? "not-allowed" : "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = "rgba(56, 189, 248, 0.2)"; e.currentTarget.style.borderColor = "#38bdf8"; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)"; e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)"; }}
                >
                  Buy Pack (₹{pack.priceINR})
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Success Modal ─── */}
        {successPaymentId && (
          <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 20,
          }}>
            <div style={{
              background: "#13131c",
              border: "1px solid rgba(168, 85, 247, 0.4)",
              borderRadius: 20,
              padding: "40px 32px",
              maxWidth: 480,
              width: "100%",
              textAlign: "center",
              boxShadow: "0 25px 50px -12px rgba(168, 85, 247, 0.3)",
            }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: 99,
                background: "rgba(34, 197, 94, 0.15)",
                border: "1px solid rgba(34, 197, 94, 0.4)",
                color: "#22c55e",
                fontSize: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}>
                ✓
              </div>

              <h3 style={{ fontSize: 24, fontWeight: 900, color: "#fff", margin: "0 0 8px" }}>
                Payment Successful!
              </h3>
              <p style={{ color: "#94a3b8", fontSize: 14, margin: "0 0 20px", lineHeight: 1.5 }}>
                Your cinematic long-form AI video subscription is active. Your character studio quotas have been instantly credited.
              </p>

              <div style={{
                background: "rgba(255,255,255,0.04)",
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: 12,
                color: "#cbd5e1",
                marginBottom: 24,
                fontFamily: "monospace",
              }}>
                Razorpay Ref: {successPaymentId}
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <Link
                  href="/reels"
                  style={{
                    flex: 1,
                    padding: "12px 20px",
                    borderRadius: 10,
                    background: "linear-gradient(135deg, #a855f7 0%, #6366f1 100%)",
                    color: "#fff",
                    textDecoration: "none",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  Open Character Studio →
                </Link>
                <button
                  type="button"
                  onClick={() => setSuccessPaymentId(null)}
                  style={{
                    padding: "12px 20px",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.08)",
                    border: "none",
                    color: "#cbd5e1",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Footer ─── */}
        <footer style={{
          borderTop: "1px solid rgba(255,255,255,0.08)",
          padding: "30px 24px",
          textAlign: "center",
          color: "#64748b",
          fontSize: 13,
        }}>
          <p style={{ margin: "0 0 10px" }}>
            GabbarInfo AI Cinema Studio · Powered by Replicate Minimax & Remotion Engine
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 20 }}>
            <Link href="/privacy-policy" style={{ color: "#64748b", textDecoration: "none" }}>Privacy Policy</Link>
            <Link href="/terms" style={{ color: "#64748b", textDecoration: "none" }}>Terms of Service</Link>
            <Link href="/refund-policy" style={{ color: "#64748b", textDecoration: "none" }}>Refund Policy</Link>
          </div>
        </footer>
      </div>
    </>
  );
}
