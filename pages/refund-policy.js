// pages/refund-policy.js
// GabbarInfo AI — Cancellation & Refund Policy
// Hosted at: ai.gabbarinfo.com/refund-policy

import Head from "next/head";
import Link from "next/link";

const LAST_UPDATED = "15 September 2026";

export default function RefundPolicy() {
  return (
    <>
      <Head>
        <title>Refund &amp; Cancellation Policy — GabbarInfo AI</title>
        <meta name="description" content="Cancellation and Refund Policy for GabbarInfo AI — subscription software platform. 7-day first-time refund policy, non-refundable credits, Razorpay processing." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://ai.gabbarinfo.com/refund-policy" />
      </Head>

      <div style={styles.page}>
        <nav style={styles.nav}>
          <Link href="/" style={styles.logo}><span>⚡</span> GabbarInfo AI</Link>
          <div style={styles.navLinks}>
            <Link href="/privacy-policy" style={styles.navLink}>Privacy Policy</Link>
            <Link href="/terms" style={styles.navLink}>Terms</Link>
            <Link href="/plans" style={styles.navLinkBtn}>View Plans →</Link>
          </div>
        </nav>

        <main style={styles.main}>
          <div style={styles.container}>

            <div style={styles.header}>
              <div style={styles.badge}>Cancellation &amp; Refund Policy</div>
              <h1 style={styles.h1}>Refund &amp; Cancellation Policy</h1>
              <p style={styles.meta}>Effective Date: {LAST_UPDATED} &nbsp;·&nbsp; Last Updated: {LAST_UPDATED}</p>
              <p style={styles.metaSub}>
                This policy applies exclusively to <strong style={{ color: "#38bdf8" }}>ai.gabbarinfo.com</strong> — the GabbarInfo AI SaaS platform.
              </p>
            </div>

            {/* PRODUCT CLASSIFICATION */}
            <div style={styles.alertCard}>
              <div style={styles.alertTitle}>🛡️ Product Classification — SaaS Subscription Software</div>
              <p style={styles.alertText}>
                <strong>GabbarInfo AI is a self-serve, subscription-based Software-as-a-Service (SaaS) platform.</strong> All payments made on this platform are exclusively for <strong>software subscription plans and AI credit packs</strong>. This refund policy governs purchases of subscription plans and AI credit packs only.
              </p>
            </div>

            <div style={styles.content}>

              {/* 1. SUBSCRIPTION REFUND POLICY */}
              <section style={styles.section}>
                <h2 style={styles.h2}>1. Subscription Plans — Refund Policy</h2>
                <p style={styles.p}>
                  GabbarInfo AI offers the following monthly subscription plans: Solo Starter, Duo Growth, Trio Business, GMB Local, Agency Scale, and various bundle and category-specific plans. Current pricing is available at <Link href="/plans" style={styles.link}>ai.gabbarinfo.com/plans</Link>.
                </p>

                <div style={styles.greenCard}>
                  <div style={{ fontWeight: 800, color: "#34d399", marginBottom: 10, fontSize: 15 }}>✅ 7-Day First-Time Refund Guarantee</div>
                  <p style={{ ...styles.p, color: "#cbd5e1", marginBottom: 0 }}>
                    If you are unsatisfied with your <strong>first-time subscription purchase</strong>, you may request a full refund within <strong>7 calendar days</strong> of the initial purchase date, provided that less than <strong>20% of your plan&apos;s monthly service quotas</strong> (blogs generated, social posts created, ad campaigns drafted, etc.) have been consumed.
                    <br /><br />
                    To request a first-time refund, email <a href="mailto:contactus@gabbarinfo.com" style={styles.link}>contactus@gabbarinfo.com</a> with the subject <em>&ldquo;Refund Request&rdquo;</em>, your registered email address, and your Razorpay transaction ID.
                  </p>
                </div>

                <h3 style={styles.h3}>Additional Subscription Terms</h3>
                <ul style={styles.ul}>
                  {[
                    ["Renewal Charges Non-Refundable", "Subscription renewal charges for subsequent billing cycles are non-refundable once processed. Please ensure you cancel at least 24 hours before the next renewal date to avoid being charged."],
                    ["Subscription Exhaustion", "Your subscription ends on whichever occurs first — the 30-day billing cycle, exhaustion of all included service quotas, or exhaustion of all bonus credits. No refund or extension is provided for early exhaustion due to your usage activity."],
                    ["Unused Quota", "Unused service quotas (e.g., unused blog or social post slots) and unused bonus credits from a subscription period are forfeited at the end of that billing cycle and do not entitle you to a refund."],
                    ["Cancellation of Auto-Renewal", "You may cancel auto-renewal at any time via your account dashboard or by emailing contactus@gabbarinfo.com. Upon cancellation, your subscription remains active until the end of the current paid period."],
                  ].map(([label, desc], i) => (
                    <li key={i} style={styles.li}><span style={{ color: "#38bdf8" }}>✦</span> <span><strong style={styles.white}>{label}:</strong> {desc}</span></li>
                  ))}
                </ul>
              </section>

              {/* 2. AI CREDITS */}
              <section style={styles.section}>
                <h2 style={styles.h2}>2. AI Credit Top-Up Packs — Non-Refundable</h2>
                <div style={styles.redCard}>
                  <div style={{ fontWeight: 800, color: "#f87171", marginBottom: 10, fontSize: 15 }}>⚠️ Credit Packs Are Strictly Non-Refundable</div>
                  <p style={{ ...styles.p, color: "#fca5a5", marginBottom: 0 }}>
                    All AI credit top-up pack purchases are <strong>final and non-refundable</strong> once the credits have been added to your account, regardless of whether they have been used or remain unused.
                  </p>
                </div>
                <ul style={styles.ul}>
                  {[
                    ["Credits Deducted at Generation", "Credits are consumed at the moment GabbarInfo AI begins processing your request (AI generation start). This applies to all services including blog generation, social post creation, ad campaign generation, image creation, and reel generation. Credits are not refunded if you close the app, navigate away, or do not publish after generation has commenced."],
                    ["No Refund on Consumed Credits", "Once credits have been deducted, they cannot be reversed, refunded, or returned, regardless of whether the output was used, published, or considered satisfactory."],
                    ["Credit Pack Expiry", "Purchased credit packs are valid for 12 months from the date of purchase. Expired credits are forfeited without refund."],
                    ["Minimum Purchase", "Minimum credit pack purchase is ₹99 (110 Credits). Pack values are as published on the platform at the time of purchase."],
                  ].map(([label, desc], i) => (
                    <li key={i} style={styles.li}><span style={{ color: "#f87171" }}>⚠</span> <span><strong style={styles.white}>{label}:</strong> {desc}</span></li>
                  ))}
                </ul>
              </section>

              {/* 3. REFUND PROCESSING */}
              <section style={styles.section}>
                <h2 style={styles.h2}>3. Refund Processing Timelines</h2>
                <p style={styles.p}>
                  All refund payments are processed by <strong style={styles.white}>Razorpay Software Pvt. Ltd.</strong> Approved refund requests will be credited back to your original payment method (UPI, Credit/Debit Card, or Net Banking) within:
                </p>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "16px 0" }}>
                  {[
                    { method: "UPI / Wallets", time: "1–3 Business Days" },
                    { method: "Credit / Debit Card", time: "5–7 Business Days" },
                    { method: "Net Banking", time: "3–5 Business Days" },
                  ].map(({ method, time }) => (
                    <div key={method} style={styles.timeCard}>
                      <div style={{ fontWeight: 700, color: "#38bdf8", marginBottom: 4, fontSize: 13 }}>{method}</div>
                      <div style={{ fontWeight: 800, color: "#ffffff", fontSize: 15 }}>{time}</div>
                    </div>
                  ))}
                </div>
                <p style={styles.p}>
                  Actual processing time depends on your bank or payment provider. Razorpay&apos;s processing is subject to <a href="https://razorpay.com/refund-policy/" target="_blank" rel="noopener noreferrer" style={styles.link}>Razorpay&apos;s Refund Policy</a>.
                </p>
              </section>

              {/* 4. NO REFUND CASES */}
              <section style={styles.section}>
                <h2 style={styles.h2}>4. Situations Where Refunds Are Not Provided</h2>
                <ul style={styles.ul}>
                  {[
                    "Credit top-up pack purchases (always non-refundable once credited)",
                    "Subscription renewal charges for any billing cycle beyond the first",
                    "First-time subscription purchases where more than 20% of quotas have been consumed",
                    "Requests made after 7 calendar days of the initial purchase date",
                    "Dissatisfaction with AI-generated output quality (AI outputs are assistive in nature; results vary)",
                    "Third-party API outages (e.g., OpenAI, Meta, Google) that temporarily affect platform features",
                    "Account suspensions resulting from violations of our Terms & Conditions",
                    "Unused subscription quota that expires at the end of a billing cycle",
                  ].map((item, i) => (
                    <li key={i} style={styles.li}><span style={{ color: "#f87171" }}>✗</span> {item}</li>
                  ))}
                </ul>
              </section>

              {/* 5. HOW TO REQUEST */}
              <section style={styles.section}>
                <h2 style={styles.h2}>5. How to Request a Cancellation or Refund</h2>
                <p style={styles.p}>To submit a cancellation or refund request, contact us with the following information:</p>
                <ul style={styles.ul}>
                  {[
                    "Your full name",
                    "Email address registered to your GabbarInfo AI account",
                    "Razorpay Transaction ID or Order ID",
                    "Date of purchase",
                    "Reason for refund request",
                    "Screenshot of the transaction (if available)",
                  ].map((item, i) => (
                    <li key={i} style={styles.li}><span style={{ color: "#38bdf8" }}>✦</span> {item}</li>
                  ))}
                </ul>
                <div style={styles.alertCard}>
                  <div style={styles.alertTitle}>📧 Contact for Refund Requests</div>
                  <p style={styles.alertText}><strong style={styles.white}>Nishant Dantare</strong> · Gabbarinfo Digital Solutions</p>
                  <p style={styles.alertText}>📧 <a href="mailto:contactus@gabbarinfo.com" style={styles.link}>contactus@gabbarinfo.com</a></p>
                  <p style={styles.alertText}>Subject Line: <em>&ldquo;Refund Request — GabbarInfo AI&rdquo;</em></p>
                  <p style={styles.alertText}>📞 +91 97239 27645</p>
                  <p style={{ ...styles.alertText, marginBottom: 0 }}>📍 New SG Road, Jagatpur, Ahmedabad, Gujarat 382470, India</p>
                </div>
                <p style={styles.p}>We will respond to all refund requests within <strong style={styles.white}>7 working days</strong> of receipt.</p>
              </section>

              {/* 6. CHANGES */}
              <section style={{ ...styles.section, borderBottom: "none", marginBottom: 0, paddingBottom: 0 }}>
                <h2 style={styles.h2}>6. Changes to This Policy</h2>
                <p style={styles.p}>
                  We may update this Refund &amp; Cancellation Policy from time to time. The &ldquo;Last Updated&rdquo; date at the top will reflect any changes. Continued use of GabbarInfo AI after the effective date constitutes acceptance of the updated policy.
                </p>
              </section>

            </div>
          </div>
        </main>

        <footer style={styles.footer}>
          <p style={styles.footerText}>© {new Date().getFullYear()} Gabbarinfo Digital Solutions. All rights reserved.</p>
          <div style={styles.footerLinks}>
            <Link href="/privacy-policy" style={styles.footerLink}>Privacy Policy</Link>
            <Link href="/terms" style={styles.footerLink}>Terms &amp; Conditions</Link>
            <Link href="/refund-policy" style={styles.footerLink}>Refund Policy</Link>
            <Link href="/plans" style={styles.footerLink}>Plans &amp; Pricing</Link>
          </div>
        </footer>
      </div>
    </>
  );
}

const styles = {
  page: { background: "#080b11", minHeight: "100vh", color: "#e2e8f0", fontFamily: "'Plus Jakarta Sans', sans-serif" },
  nav: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 32px", borderBottom: "1px solid rgba(255,255,255,0.07)", position: "sticky", top: 0, background: "rgba(8,11,17,0.95)", backdropFilter: "blur(12px)", zIndex: 100, flexWrap: "wrap", gap: 12 },
  logo: { display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 18, color: "#f8fafc", textDecoration: "none" },
  navLinks: { display: "flex", alignItems: "center", gap: 20 },
  navLink: { color: "#94a3b8", textDecoration: "none", fontSize: 14, fontWeight: 600 },
  navLinkBtn: { background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.3)", borderRadius: 8, padding: "7px 16px", color: "#38bdf8", textDecoration: "none", fontSize: 14, fontWeight: 700 },
  main: { padding: "60px 24px 80px" },
  container: { maxWidth: 900, margin: "0 auto" },
  header: { textAlign: "center", marginBottom: 40, paddingBottom: 36, borderBottom: "1px solid rgba(255,255,255,0.07)" },
  badge: { display: "inline-block", background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)", borderRadius: 100, padding: "5px 16px", fontSize: 11, fontWeight: 800, color: "#38bdf8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 },
  h1: { fontSize: "clamp(2rem, 4vw, 2.8rem)", fontWeight: 800, color: "#ffffff", margin: "0 0 12px", letterSpacing: "-0.02em" },
  meta: { fontSize: 14, color: "#64748b", margin: "0 0 8px" },
  metaSub: { fontSize: 15, color: "#94a3b8", margin: 0 },
  alertCard: { background: "linear-gradient(135deg, rgba(56,189,248,0.07), rgba(8,11,17,0.9))", border: "1.5px solid rgba(56,189,248,0.3)", borderRadius: 14, padding: "24px 28px", marginBottom: 44 },
  alertTitle: { fontWeight: 800, fontSize: 15, color: "#38bdf8", marginBottom: 14 },
  alertText: { fontSize: 14, color: "#cbd5e1", lineHeight: 1.7, marginBottom: 10 },
  greenCard: { background: "rgba(16,185,129,0.06)", border: "1.5px solid rgba(16,185,129,0.3)", borderRadius: 12, padding: "20px 24px", margin: "16px 0 24px" },
  redCard: { background: "rgba(239,68,68,0.05)", border: "1.5px solid rgba(239,68,68,0.25)", borderRadius: 12, padding: "20px 24px", margin: "16px 0 24px" },
  timeCard: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "16px 20px", flex: 1, minWidth: 140 },
  content: { lineHeight: 1.8 },
  section: { marginBottom: 44, paddingBottom: 36, borderBottom: "1px solid rgba(255,255,255,0.05)" },
  h2: { fontSize: "1.3rem", fontWeight: 800, color: "#ffffff", marginTop: 0, marginBottom: 16, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.07)" },
  h3: { fontSize: "1rem", fontWeight: 700, color: "#f1f5f9", marginTop: 20, marginBottom: 10 },
  p: { fontSize: 14, color: "#94a3b8", lineHeight: 1.75, marginBottom: 12 },
  ul: { paddingLeft: 0, margin: "10px 0 14px 0", listStyle: "none" },
  li: { fontSize: 14, color: "#94a3b8", lineHeight: 1.65, marginBottom: 8, display: "flex", gap: 10, alignItems: "flex-start" },
  link: { color: "#38bdf8", textDecoration: "underline", textUnderlineOffset: 3 },
  white: { color: "#ffffff" },
  footer: { borderTop: "1px solid rgba(255,255,255,0.07)", padding: "24px 32px", textAlign: "center" },
  footerText: { fontSize: 13, color: "#475569", marginBottom: 10 },
  footerLinks: { display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" },
  footerLink: { fontSize: 13, color: "#64748b", textDecoration: "none" },
};
