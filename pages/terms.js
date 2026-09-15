// pages/terms.js
// GabbarInfo AI — Terms & Conditions
// Hosted at: ai.gabbarinfo.com/terms

import Head from "next/head";
import Link from "next/link";

const LAST_UPDATED = "15 September 2026";

export default function Terms() {
  return (
    <>
      <Head>
        <title>Terms &amp; Conditions — GabbarInfo AI</title>
        <meta name="description" content="Terms and Conditions for GabbarInfo AI — a self-serve AI SaaS subscription platform. Read about subscriptions, credits, billing, user obligations, and acceptable use." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://ai.gabbarinfo.com/terms" />
      </Head>

      <div style={styles.page}>
        <nav style={styles.nav}>
          <Link href="/" style={styles.logo}><span>⚡</span> GabbarInfo AI</Link>
          <div style={styles.navLinks}>
            <Link href="/privacy-policy" style={styles.navLink}>Privacy Policy</Link>
            <Link href="/refund-policy" style={styles.navLink}>Refund Policy</Link>
            <Link href="/plans" style={styles.navLinkBtn}>View Plans →</Link>
          </div>
        </nav>

        <main style={styles.main}>
          <div style={styles.container}>

            <div style={styles.header}>
              <div style={styles.badge}>Terms &amp; Conditions · GabbarInfo AI</div>
              <h1 style={styles.h1}>Terms &amp; Conditions</h1>
              <p style={styles.meta}>Last Updated: {LAST_UPDATED} &nbsp;·&nbsp; Effective: {LAST_UPDATED}</p>
              <p style={styles.metaSub}>
                These terms apply exclusively to <strong style={{ color: "#38bdf8" }}>ai.gabbarinfo.com</strong> — the GabbarInfo AI SaaS platform.
              </p>
            </div>

            {/* SAAS CLASSIFICATION — CRITICAL */}
            <div style={styles.alertCard}>
              <div style={styles.alertTitle}>🛡️ Nature of Service — Software-as-a-Service (SaaS)</div>
              <p style={styles.alertText}>
                <strong>GabbarInfo AI is a self-serve, subscription-based Software-as-a-Service (SaaS) platform.</strong> It is not a lead generation service, PPC management agency, or performance advertising agency. Users sign up, choose a plan, and use AI-powered tools independently on their own Google Ads and Meta accounts.
              </p>
              <p style={{ ...styles.alertText, marginBottom: 0 }}>
                All payments on this platform are for <strong>software subscription access and AI credit packs</strong> only. GabbarInfo does not accept payment for managing campaigns, generating leads, or performing any advertising service on behalf of users.
              </p>
            </div>

            <div style={styles.content}>

              {/* 1. AGREEMENT */}
              <section style={styles.section}>
                <h2 style={styles.h2}>1. Agreement to These Terms</h2>
                <p style={styles.p}>
                  By accessing or using GabbarInfo AI at <a href="https://ai.gabbarinfo.com" style={styles.link}>ai.gabbarinfo.com</a>, you agree to be bound by these Terms &amp; Conditions and our <Link href="/privacy-policy" style={styles.link}>Privacy Policy</Link>. If you do not agree, do not use this platform.
                </p>
                <p style={styles.p}>
                  These Terms constitute a binding agreement between you and <strong style={styles.white}>Gabbarinfo Digital Solutions</strong> (operated by Nishant Dantare, sole proprietor), registered address: New SG Road, Jagatpur, Ahmedabad, Gujarat 382470, India.
                </p>
              </section>

              {/* 2. ELIGIBILITY */}
              <section style={styles.section}>
                <h2 style={styles.h2}>2. Eligibility</h2>
                <ul style={styles.ul}>
                  {[
                    "You must be at least 18 years of age to use GabbarInfo AI.",
                    "You must be using the platform for a legitimate business purpose.",
                    "You must have the legal authority to connect any Google Ads or Meta accounts you link to the platform.",
                    "By using this platform, you represent and warrant that all of the above conditions are met.",
                  ].map((item, i) => <li key={i} style={styles.li}><span style={{ color: "#38bdf8" }}>✦</span> {item}</li>)}
                </ul>
              </section>

              {/* 3. WHAT GABBARINFO AI IS */}
              <section style={styles.section}>
                <h2 style={styles.h2}>3. What GabbarInfo AI Is (and Is Not)</h2>
                <p style={styles.p}>GabbarInfo AI provides the following self-serve, AI-powered software tools:</p>
                <ul style={styles.ul}>
                  {[
                    "Google Ads campaign draft generation (Search, PMax) — pushed to your account on your explicit approval",
                    "Meta (Facebook/Instagram) ad copy and creative generation — published on your explicit approval",
                    "Social media post and image creation — published to your connected pages on your explicit approval",
                    "WordPress SEO blog article generation and autopublishing to your own website",
                    "AI credit system for on-demand content generation",
                  ].map((item, i) => <li key={i} style={styles.li}><span style={{ color: "#34d399" }}>✦</span> {item}</li>)}
                </ul>
                <div style={styles.infoCard}>
                  <p style={{ ...styles.p, color: "#f87171", fontWeight: 700, marginBottom: 8 }}>GabbarInfo AI does NOT:</p>
                  <ul style={styles.ul}>
                    {[
                      "Manage, optimise, or operate advertising campaigns on your behalf",
                      "Access your ad accounts without your explicit OAuth consent",
                      "Publish any content or campaign without your in-platform confirmation",
                      "Guarantee specific advertising results, ROAS, leads, or conversions",
                      "Provide human campaign management, media buying, or agency services",
                    ].map((item, i) => <li key={i} style={styles.li}><span style={{ color: "#f87171" }}>✗</span> {item}</li>)}
                  </ul>
                </div>
              </section>

              {/* 4. ACCOUNT */}
              <section style={styles.section}>
                <h2 style={styles.h2}>4. Your Account</h2>
                <p style={styles.p}>You are responsible for maintaining the security of your account credentials. You must not share your account with others or allow unauthorised access. You are responsible for all activity that occurs under your account.</p>
                <p style={styles.p}>We reserve the right to suspend or terminate accounts that violate these Terms, are found to be fraudulent, or are used for activities that harm the platform or third parties.</p>
              </section>

              {/* 5. SUBSCRIPTIONS */}
              <section style={styles.section}>
                <h2 style={styles.h2}>5. Subscription Plans</h2>
                <p style={styles.p}>
                  GabbarInfo AI offers monthly subscription plans. Current plans and pricing are published at <Link href="/plans" style={styles.link}>ai.gabbarinfo.com/plans</Link>.
                </p>
                <ul style={styles.ul}>
                  {[
                    ["Billing Cycle", "Subscriptions are billed monthly from the date of initial purchase. Your subscription remains active until the earlier of: (a) 30 calendar days; (b) exhaustion of all included service quotas; or (c) exhaustion of all included bonus credits."],
                    ["Auto-Renewal", "Monthly subscriptions auto-renew at the end of each billing cycle unless you cancel at least 24 hours before the next billing date. You will receive an advance email notification before each renewal, in accordance with Consumer Protection (E-Commerce) Rules, 2020."],
                    ["Quota Reset", "All included service quotas (blogs, social posts, ad campaigns, etc.) reset at the start of each new billing cycle. Unused quota does not carry forward."],
                    ["Cancellation", "You may cancel your subscription at any time via your account dashboard or by emailing contactus@gabbarinfo.com. Cancellation stops future renewals; your subscription remains active until the end of the current paid period."],
                  ].map(([label, desc], i) => (
                    <li key={i} style={styles.li}><span style={{ color: "#38bdf8" }}>✦</span> <span><strong style={styles.white}>{label}:</strong> {desc}</span></li>
                  ))}
                </ul>
              </section>

              {/* 6. AI CREDITS */}
              <section style={styles.section}>
                <h2 style={styles.h2}>6. AI Credits</h2>
                <p style={styles.p}>
                  AI Credits are a pre-purchased digital unit of account (1 Credit = ₹1) redeemable exclusively within the GabbarInfo AI platform. Credits are not cash, currency, or a financial instrument and have no value outside the platform.
                </p>
                <ul style={styles.ul}>
                  {[
                    ["Deduction at Generation", "Credits are deducted at the moment GabbarInfo AI begins processing your request (i.e., when AI generation starts), regardless of whether you subsequently use, publish, or discard the output."],
                    ["Non-Refundable", "All credit top-up purchases are final and non-refundable once credited to your account, whether used or unused."],
                    ["Minimum Purchase", "Credits may be purchased in packs. Minimum purchase: ₹99 (110 Credits)."],
                    ["Expiry", "Purchased credit packs are valid for 12 months from the date of purchase. Bonus credits included in a subscription plan expire at the end of the billing cycle in which they were issued. Expired credits are forfeited without refund."],
                  ].map(([label, desc], i) => (
                    <li key={i} style={styles.li}><span style={{ color: "#38bdf8" }}>✦</span> <span><strong style={styles.white}>{label}:</strong> {desc}</span></li>
                  ))}
                </ul>
              </section>

              {/* 7. PAYMENTS & RAZORPAY */}
              <section style={styles.section}>
                <h2 style={styles.h2}>7. Payments &amp; Razorpay</h2>
                <p style={styles.p}>
                  All payments are processed by <strong style={styles.white}>Razorpay Software Pvt. Ltd.</strong> (CIN: U74999KA2013PTC097389), a licensed Payment Aggregator regulated by the Reserve Bank of India. By completing a payment, you also agree to <a href="https://razorpay.com/terms/" target="_blank" rel="noopener noreferrer" style={styles.link}>Razorpay&apos;s Terms of Service</a>.
                </p>
                <p style={styles.p}>
                  GabbarInfo AI does not store your payment card data, UPI credentials, or net banking passwords. All payment data is handled exclusively by Razorpay under PCI-DSS compliance.
                </p>
                <p style={styles.p}>
                  All prices are in Indian Rupees (INR) and inclusive of applicable taxes where required. By purchasing a subscription or credit pack, you authorise Razorpay to charge your selected payment method for the stated amount.
                </p>
              </section>

              {/* 8. AUTOPILOT SERVICES */}
              <section style={styles.section}>
                <h2 style={styles.h2}>8. Autopilot &amp; Automated Services</h2>
                <p style={styles.p}>
                  GabbarInfo AI offers optional automated content generation and publishing services (&ldquo;Autopilot&rdquo;). By enabling Autopilot, you authorise GabbarInfo AI to generate and publish content on your connected platforms at the configured frequency.
                </p>
                <ul style={styles.ul}>
                  {[
                    "Credits or quota required for each scheduled generation are consumed at the time the AI generation begins.",
                    "If a generation run completes but publishing fails (e.g., due to a WordPress connectivity error), credits for that generation are still consumed.",
                    "You are responsible for the accuracy, suitability, and legality of all prompts, business details, and configurations you provide.",
                    "GabbarInfo AI does not guarantee that AI-generated content will be error-free, SEO-optimal, or appropriate for every context.",
                  ].map((item, i) => <li key={i} style={styles.li}><span style={{ color: "#38bdf8" }}>✦</span> {item}</li>)}
                </ul>
              </section>

              {/* 9. USER RESPONSIBILITIES */}
              <section style={styles.section}>
                <h2 style={styles.h2}>9. User Responsibilities &amp; Prohibited Use</h2>
                <p style={styles.p}>You agree to use GabbarInfo AI only for lawful business purposes. You must not:</p>
                <ul style={styles.ul}>
                  {[
                    "Use the platform to generate content that is illegal, defamatory, fraudulent, or violates any third-party rights",
                    "Attempt to reverse-engineer, scrape, or exploit the platform's underlying AI models or infrastructure",
                    "Resell, sublicense, or redistribute access to GabbarInfo AI without our written permission",
                    "Connect ad accounts or business assets that you do not own or have authority to manage",
                    "Use the platform to generate spam, misleading ads, or content that violates Google Ads or Meta advertising policies",
                    "Attempt to circumvent billing, credit deduction, or account restrictions",
                  ].map((item, i) => <li key={i} style={styles.li}><span style={{ color: "#f87171" }}>✗</span> {item}</li>)}
                </ul>
              </section>

              {/* 10. AI OUTPUTS */}
              <section style={styles.section}>
                <h2 style={styles.h2}>10. AI-Generated Content &amp; Outputs</h2>
                <p style={styles.p}>
                  AI-generated content (ad copy, blog articles, social posts, images) produced using GabbarInfo AI for your own business or businesses you manage as an agency client is permitted under these Terms.
                </p>
                <p style={styles.p}>
                  You acknowledge that AI-generated outputs may occasionally contain inaccuracies, grammatical errors, or contextual gaps. You are responsible for reviewing and approving all AI-generated content before publication. GabbarInfo AI is not liable for any losses arising from content you choose to publish.
                </p>
                <p style={styles.p}>
                  You retain ownership of the AI-generated outputs produced using your account and your input prompts. We do not claim ownership of your generated content.
                </p>
              </section>

              {/* 11. THIRD-PARTY SERVICES */}
              <section style={styles.section}>
                <h2 style={styles.h2}>11. Third-Party Services &amp; Force Majeure</h2>
                <p style={styles.p}>
                  GabbarInfo AI relies on third-party APIs (including but not limited to OpenAI, Replicate, Meta, Google, and WordPress) to deliver its features. We are not responsible for any interruption, policy change, or discontinuation of such third-party services.
                </p>
                <ul style={styles.ul}>
                  {[
                    "Credits are NOT deducted if AI generation was not initiated (i.e., the API call failed before processing began).",
                    "We are not liable for losses arising from third-party API outages, platform policy changes, or force majeure events beyond our reasonable control.",
                  ].map((item, i) => <li key={i} style={styles.li}><span style={{ color: "#38bdf8" }}>✦</span> {item}</li>)}
                </ul>
              </section>

              {/* 12. DISCLAIMER */}
              <section style={styles.section}>
                <h2 style={styles.h2}>12. Disclaimer of Warranties</h2>
                <p style={styles.p}>
                  GabbarInfo AI is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranty of any kind, express or implied. We do not warrant that the platform will be uninterrupted, error-free, or free of viruses. We do not guarantee specific advertising results, rankings, leads, conversions, or return on ad spend (ROAS).
                </p>
              </section>

              {/* 13. LIMITATION OF LIABILITY */}
              <section style={styles.section}>
                <h2 style={styles.h2}>13. Limitation of Liability</h2>
                <p style={styles.p}>
                  To the maximum extent permitted by applicable law, Gabbarinfo Digital Solutions shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of GabbarInfo AI, including lost profits, lost data, or missed business opportunities. Our total aggregate liability to you for any claim shall not exceed the amount you paid to us in the 3 months preceding the claim.
                </p>
              </section>

              {/* 14. INTELLECTUAL PROPERTY */}
              <section style={styles.section}>
                <h2 style={styles.h2}>14. Intellectual Property</h2>
                <p style={styles.p}>
                  The GabbarInfo AI platform — including its software, design, branding, AI workflows, and infrastructure — is the proprietary property of Gabbarinfo Digital Solutions. You may not copy, modify, distribute, or create derivative works from the platform without our express written permission.
                </p>
              </section>

              {/* 15. GOVERNING LAW */}
              <section style={styles.section}>
                <h2 style={styles.h2}>15. Governing Law &amp; Disputes</h2>
                <p style={styles.p}>
                  These Terms are governed by the laws of India. Any disputes arising out of or relating to these Terms or the platform shall be subject to the exclusive jurisdiction of the courts of Ahmedabad, Gujarat, India. All claims must be filed within one (1) year of the cause of action arising.
                </p>
              </section>

              {/* 16. MODIFICATIONS */}
              <section style={styles.section}>
                <h2 style={styles.h2}>16. Modifications to These Terms</h2>
                <p style={styles.p}>
                  We may update these Terms periodically. The &ldquo;Last Updated&rdquo; date will be revised accordingly. Continued use of GabbarInfo AI after the updated effective date constitutes acceptance of the new Terms.
                </p>
              </section>

              {/* 17. CONTACT */}
              <section style={{ ...styles.section, borderBottom: "none", marginBottom: 0, paddingBottom: 0 }}>
                <h2 style={styles.h2}>17. Contact Us</h2>
                <div style={styles.alertCard}>
                  <div style={styles.alertTitle}>📋 Contact &amp; Support</div>
                  <p style={styles.alertText}><strong style={styles.white}>Nishant Dantare</strong> · Gabbarinfo Digital Solutions</p>
                  <p style={styles.alertText}>📧 <a href="mailto:contactus@gabbarinfo.com" style={styles.link}>contactus@gabbarinfo.com</a></p>
                  <p style={styles.alertText}>📞 +91 97239 27645</p>
                  <p style={{ ...styles.alertText, marginBottom: 0 }}>📍 New SG Road, Jagatpur, Ahmedabad, Gujarat 382470, India</p>
                </div>
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
  content: { lineHeight: 1.8 },
  section: { marginBottom: 44, paddingBottom: 36, borderBottom: "1px solid rgba(255,255,255,0.05)" },
  h2: { fontSize: "1.3rem", fontWeight: 800, color: "#ffffff", marginTop: 0, marginBottom: 16, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.07)" },
  p: { fontSize: 14, color: "#94a3b8", lineHeight: 1.75, marginBottom: 12 },
  ul: { paddingLeft: 0, margin: "10px 0 14px 0", listStyle: "none" },
  li: { fontSize: 14, color: "#94a3b8", lineHeight: 1.65, marginBottom: 8, display: "flex", gap: 10, alignItems: "flex-start" },
  infoCard: { background: "rgba(15,23,42,0.7)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "18px 22px", margin: "14px 0" },
  link: { color: "#38bdf8", textDecoration: "underline", textUnderlineOffset: 3 },
  white: { color: "#ffffff" },
  footer: { borderTop: "1px solid rgba(255,255,255,0.07)", padding: "24px 32px", textAlign: "center" },
  footerText: { fontSize: 13, color: "#475569", marginBottom: 10 },
  footerLinks: { display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" },
  footerLink: { fontSize: 13, color: "#64748b", textDecoration: "none" },
};
