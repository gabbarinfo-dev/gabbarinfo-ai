// pages/privacy-policy.js
// GabbarInfo AI — Dedicated Privacy Policy
// Compliant with: GDPR, DPDP Act 2023 & Rules 2025, Razorpay requirements
// Hosted at: ai.gabbarinfo.com/privacy-policy

import Head from "next/head";
import Link from "next/link";

const LAST_UPDATED = "15 September 2026";

export default function PrivacyPolicy() {
  return (
    <>
      <Head>
        <title>Privacy Policy — GabbarInfo AI</title>
        <meta name="description" content="Privacy Policy for GabbarInfo AI (ai.gabbarinfo.com) — a self-serve SaaS subscription platform. GDPR, DPDP Act 2023, and Razorpay compliant." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://ai.gabbarinfo.com/privacy-policy" />
      </Head>

      <div style={styles.page}>
        {/* NAV */}
        <nav style={styles.nav}>
          <Link href="/" style={styles.logo}><span>⚡</span> GabbarInfo AI</Link>
          <div style={styles.navLinks}>
            <Link href="/terms" style={styles.navLink}>Terms</Link>
            <Link href="/refund-policy" style={styles.navLink}>Refund Policy</Link>
            <Link href="/plans" style={styles.navLinkBtn}>View Plans →</Link>
          </div>
        </nav>

        <main style={styles.main}>
          <div style={styles.container}>

            {/* HEADER */}
            <div style={styles.header}>
              <div style={styles.badge}>GDPR · DPDP Act 2023</div>
              <h1 style={styles.h1}>Privacy Policy</h1>
              <p style={styles.meta}>Last Updated: {LAST_UPDATED} &nbsp;·&nbsp; Effective: {LAST_UPDATED}</p>
              <p style={styles.metaSub}>
                This policy applies exclusively to <strong style={{ color: "#38bdf8" }}>ai.gabbarinfo.com</strong> — the GabbarInfo AI SaaS platform.
              </p>
            </div>

            {/* SAAS CLASSIFICATION — CRITICAL */}
            <div style={styles.alertCard}>
              <div style={styles.alertTitle}>🛡️ Product Classification — Software-as-a-Service (SaaS)</div>
              <p style={styles.alertText}>
                <strong>GabbarInfo AI is a self-serve, subscription-based Software-as-a-Service (SaaS) platform.</strong> Users independently sign up, purchase a subscription or AI credit pack, and use AI tools themselves — entirely on their own accounts and under their own control.
              </p>
              <p style={styles.alertText}>
                All actions on connected advertising accounts require the user&apos;s explicit in-platform confirmation before anything is published. All payments collected are exclusively for <strong>software subscription access and AI credit packs</strong>.
              </p>
            </div>

            <div style={styles.content}>

              {/* 1. WHO WE ARE */}
              <section style={styles.section}>
                <h2 style={styles.h2}>1. Who We Are</h2>
                <div style={styles.infoCard}>
                  <p style={styles.p}><strong style={styles.white}>Operator:</strong> Nishant Dantare, trading as <strong style={styles.white}>Gabbarinfo Digital Solutions</strong> (Individual / Sole Proprietor)</p>
                  <p style={styles.p}><strong style={styles.white}>Platform:</strong> GabbarInfo AI — <a href="https://ai.gabbarinfo.com" style={styles.link}>ai.gabbarinfo.com</a></p>
                  <p style={styles.p}><strong style={styles.white}>Email:</strong> <a href="mailto:contactus@gabbarinfo.com" style={styles.link}>contactus@gabbarinfo.com</a></p>
                  <p style={styles.p}><strong style={styles.white}>Phone:</strong> +91 97239 27645</p>
                  <p style={{ ...styles.p, marginBottom: 0 }}><strong style={styles.white}>Address:</strong> New SG Road, Jagatpur, Ahmedabad, Gujarat 382470, India</p>
                </div>
                <p style={styles.p}>
                  GabbarInfo AI is operated by an individual (sole proprietor). We are the Data Fiduciary under India&apos;s Digital Personal Data Protection Act 2023 (DPDP Act) and the Data Controller under the EU General Data Protection Regulation (GDPR) for personal data processed through this platform.
                </p>
              </section>

              {/* 2. SCOPE */}
              <section style={styles.section}>
                <h2 style={styles.h2}>2. Scope of This Policy</h2>
                <p style={styles.p}>
                  This Privacy Policy governs personal data collected and processed exclusively through the GabbarInfo AI platform at <a href="https://ai.gabbarinfo.com" style={styles.link}>ai.gabbarinfo.com</a>. It does not apply to gabbarinfo.com (the digital marketing services website), which operates under its own separate privacy policy.
                </p>
                <p style={styles.p}>This policy covers:</p>
                <ul style={styles.ul}>
                  {["Account registration and authentication (Google Sign-In, Facebook Login)","Subscription and credit purchases processed by Razorpay","AI tool usage within the platform","Connection of Google Ads and Meta/Facebook/Instagram business assets","AI-generated content (ad copy, blogs, social posts, images, reels)","Technical logs, session data, and analytics"].map((item, i) => (
                    <li key={i} style={styles.li}><span style={{ color: "#38bdf8" }}>✦</span> {item}</li>
                  ))}
                </ul>
              </section>

              {/* 3. DATA WE COLLECT */}
              <section style={styles.section}>
                <h2 style={styles.h2}>3. Data We Collect</h2>

                <h3 style={styles.h3}>3.1 Account &amp; Authentication Data</h3>
                <p style={styles.p}>When you sign up or sign in, we collect your name, email address, profile picture URL, and OAuth session tokens — used solely to create and maintain your GabbarInfo AI account.</p>

                <h3 style={styles.h3}>3.2 Business Configuration Data</h3>
                <p style={styles.p}>To personalise AI outputs, you may provide your business name, industry, target location, website URL, and product/service descriptions. This is used only to generate relevant content for your account.</p>

                <h3 style={styles.h3}>3.3 Google Ads Account Data</h3>
                <p style={styles.p}>If you connect your Google Ads account via OAuth consent, we access account identifiers and campaign metadata required to build campaign drafts. We do not access your Google billing data, Gmail, contacts, or any other Google service.</p>

                <h3 style={styles.h3}>3.4 Meta / Facebook &amp; Instagram Data</h3>
                <p style={styles.p}>If you connect Meta business assets, we access — only through permissions you explicitly grant — Facebook Page IDs, Instagram Business Account IDs, Meta Ad Account IDs, and Business Manager identifiers via the official Meta Graph API.</p>
                <p style={styles.p}>We do not access personal Facebook timelines, friend lists, private messages, personal photos, or any data unrelated to business advertising functionality.</p>

                <h3 style={styles.h3}>3.5 Payment Data</h3>
                <p style={styles.p}>Payments are processed exclusively by <strong style={styles.white}>Razorpay Software Pvt. Ltd.</strong> We do not collect, store, or handle your card number, CVV, UPI PIN, or net banking credentials. We receive only a payment confirmation token and transaction ID for billing records.</p>

                <h3 style={styles.h3}>3.6 Technical &amp; Usage Data</h3>
                <p style={styles.p}>We automatically collect IP address, browser/device type, session duration, features accessed, and error logs — for security, troubleshooting, and platform improvement.</p>
              </section>

              {/* 4. HOW WE USE YOUR DATA */}
              <section style={styles.section}>
                <h2 style={styles.h2}>4. How We Use Your Data</h2>
                <div style={{ overflowX: "auto" }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Purpose</th>
                        <th style={styles.th}>GDPR Basis</th>
                        <th style={styles.th}>DPDP Basis</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["Authenticate and maintain your account","Contract","Consent"],
                        ["Generate AI marketing content for your business","Contract","Consent"],
                        ["Process subscription / credit payments via Razorpay","Contract","Consent"],
                        ["Push campaigns to your Google Ads / Meta (on your explicit approval only)","Contract + Consent","Consent"],
                        ["Send transactional emails (receipts, alerts)","Contract","Consent"],
                        ["Maintain platform security and prevent fraud","Legitimate interest","Legitimate use"],
                        ["Comply with applicable law (tax, accounting)","Legal obligation","Legal obligation"],
                      ].map(([p, g, d], i) => (
                        <tr key={i}>
                          <td style={styles.td}>{p}</td>
                          <td style={{ ...styles.td, color: "#38bdf8" }}>{g}</td>
                          <td style={{ ...styles.td, color: "#34d399" }}>{d}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* 5. GOOGLE SIGN-IN */}
              <section style={styles.section}>
                <h2 style={styles.h2}>5. Google Sign-In</h2>
                <p style={styles.p}>GabbarInfo AI uses Google OAuth 2.0 for authentication. When you sign in with Google, we receive your name, email, and profile picture solely to create your account. We do not access Gmail, Google Drive, contacts, Calendar, or any other Google service outside the scope you explicitly authorise.</p>
              </section>

              {/* 6. META LOGIN */}
              <section style={styles.section}>
                <h2 style={styles.h2}>6. Meta / Facebook Login &amp; APIs</h2>
                <p style={styles.p}>Our registered Meta applications:</p>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "12px 0 18px" }}>
                  {[{ name: "GabbarInfo AI – Login", id: "1478698813661517" }, { name: "GabbarInfo AI", id: "741627915051634" }].map(app => (
                    <div key={app.id} style={styles.appCard}>
                      <div style={{ fontWeight: 700, color: "#38bdf8", marginBottom: 4 }}>{app.name}</div>
                      <div style={{ fontFamily: "monospace", fontSize: 12, color: "#64748b" }}>App ID: {app.id}</div>
                    </div>
                  ))}
                </div>
                <p style={styles.p}>All Meta API access is based on permissions you explicitly grant. No advertising action is taken without your in-platform confirmation. You may revoke permissions at any time via <a href="https://www.facebook.com/settings?tab=applications" target="_blank" rel="noopener noreferrer" style={styles.link}>Facebook App Settings</a>.</p>
              </section>

              {/* 7. RAZORPAY PAYMENTS */}
              <section style={styles.section}>
                <h2 style={styles.h2}>7. Payments &amp; Razorpay</h2>
                <p style={styles.p}>
                  All subscription and credit purchases are processed by <strong style={styles.white}>Razorpay Software Pvt. Ltd.</strong> (CIN: U74999KA2013PTC097389), a licensed Payment Aggregator regulated by the Reserve Bank of India.
                </p>
                <p style={styles.p}>
                  GabbarInfo AI does not collect, transmit, or store any card number, CVV, UPI PIN, or net banking credentials. The payment interface is hosted and secured by Razorpay under PCI-DSS compliance. All payment data is subject to <a href="https://razorpay.com/privacy/" target="_blank" rel="noopener noreferrer" style={styles.link}>Razorpay&apos;s Privacy Policy</a>.
                </p>
                <p style={styles.p}>We retain only: transaction ID, payment status, amount, plan purchased, and timestamp — for billing records and customer support.</p>
              </section>

              {/* 8. THIRD-PARTY PROVIDERS */}
              <section style={styles.section}>
                <h2 style={styles.h2}>8. Third-Party Service Providers</h2>
                <div style={{ overflowX: "auto" }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Category</th>
                        <th style={styles.th}>Purpose</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["AI Language Models (OpenAI, Anthropic, etc.)","Ad copy, blog content, social captions generation"],
                        ["AI Image Generation (Replicate, Stability AI, etc.)","Ad creatives, featured images, infographics"],
                        ["Cloud Hosting (Vercel, AWS, etc.)","Platform hosting and delivery"],
                        ["Database (Supabase / PostgreSQL)","Encrypted storage of account and session data"],
                        ["Razorpay","Payment processing for subscriptions and credits"],
                        ["Google (OAuth 2.0 + Ads API)","Authentication and campaign delivery"],
                        ["Meta (Graph API)","Facebook/Instagram post and campaign workflows"],
                      ].map(([cat, purpose], i) => (
                        <tr key={i}>
                          <td style={styles.td}>{cat}</td>
                          <td style={styles.td}>{purpose}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={styles.p}>We do not share one user&apos;s data or business configuration with any other user. We require all processors to implement appropriate security safeguards.</p>
              </section>

              {/* 9. RETENTION */}
              <section style={styles.section}>
                <h2 style={styles.h2}>9. Data Retention</h2>
                <ul style={styles.ul}>
                  {[
                    ["Account data", "Active until you delete your account + up to 90 days post-deletion for technical cleanup."],
                    ["AI-generated content", "Retained in your dashboard for your subscription period."],
                    ["Payment records", "Retained for 7 years per Indian tax / accounting law (Income Tax Act, 1961)."],
                    ["OAuth tokens (Google / Meta)", "Retained while the connection is active. Immediately revocable."],
                    ["Technical logs", "Retained for up to 90 days for security and debugging."],
                  ].map(([label, desc], i) => (
                    <li key={i} style={styles.li}><span style={{ color: "#38bdf8" }}>✦</span> <span><strong style={styles.white}>{label}:</strong> {desc}</span></li>
                  ))}
                </ul>
              </section>

              {/* 10. YOUR RIGHTS */}
              <section style={styles.section}>
                <h2 style={styles.h2}>10. Your Rights</h2>
                <h3 style={styles.h3}>10.1 Under GDPR (EU / EEA Users)</h3>
                <ul style={styles.ul}>
                  {[
                    "Right to access (Art. 15) — obtain a copy of your personal data.",
                    "Right to rectification (Art. 16) — correct inaccurate data.",
                    "Right to erasure / 'Right to be Forgotten' (Art. 17) — request deletion.",
                    "Right to restriction (Art. 18) — restrict processing in certain circumstances.",
                    "Right to data portability (Art. 20) — receive data in a machine-readable format.",
                    "Right to object (Art. 21) — object to processing based on legitimate interests.",
                    "Right to withdraw consent — at any time without penalty.",
                    "Right to lodge a complaint with your local Data Protection Authority.",
                  ].map((right, i) => (
                    <li key={i} style={styles.li}><span style={{ color: "#38bdf8" }}>✦</span> {right}</li>
                  ))}
                </ul>

                <h3 style={styles.h3}>10.2 Under DPDP Act 2023 (India)</h3>
                <ul style={styles.ul}>
                  {[
                    "Right to access a summary of your personal data and processing activities.",
                    "Right to correction and erasure of inaccurate or unnecessary data.",
                    "Right to grievance redressal through our contact channels.",
                    "Right to withdraw consent at any time.",
                    "Right to nominate another person to exercise these rights in case of death or incapacity.",
                  ].map((right, i) => (
                    <li key={i} style={styles.li}><span style={{ color: "#34d399" }}>✦</span> {right}</li>
                  ))}
                </ul>

                <div style={styles.infoCard}>
                  <p style={{ ...styles.p, color: "#38bdf8", fontWeight: 700, marginBottom: 8 }}>To exercise any right:</p>
                  <p style={{ ...styles.p, marginBottom: 0 }}>
                    📧 <a href="mailto:contactus@gabbarinfo.com" style={styles.link}>contactus@gabbarinfo.com</a> · Subject: <em>&ldquo;Privacy / DPDP / GDPR Data Rights Request&rdquo;</em>
                    <br />We respond within <strong style={styles.white}>30 days</strong> (GDPR) / DPDP statutory timelines.
                  </p>
                </div>
              </section>

              {/* 11. DATA DELETION */}
              <section style={styles.section}>
                <h2 style={styles.h2}>11. Data Deletion</h2>
                <p style={styles.p}>
                  To delete your GabbarInfo AI account and all associated personal data, email <a href="mailto:contactus@gabbarinfo.com" style={styles.link}>contactus@gabbarinfo.com</a> with the subject <em>&ldquo;Data Deletion Request&rdquo;</em> and your registered email address.  We process verified requests within <strong style={styles.white}>7 working days</strong> where technically feasible.
                </p>
                <p style={styles.p}>
                  Payment transaction records may be retained for up to 7 years as required by law. For Meta-linked data, you may also use Facebook&apos;s <a href="https://www.facebook.com/help/contact/1433400596897244" target="_blank" rel="noopener noreferrer" style={styles.link}>Data Deletion Tool</a> (App IDs: 1478698813661517 and 741627915051634).
                </p>
              </section>

              {/* 12. COOKIES */}
              <section style={styles.section}>
                <h2 style={styles.h2}>12. Cookies &amp; Local Storage</h2>
                <p style={styles.p}>GabbarInfo AI uses only essential cookies for: session management (keeping you logged in via NextAuth), user preference storage, and CSRF security tokens. We do not use advertising cookies, cross-site tracking, or third-party marketing cookies on this platform.</p>
              </section>

              {/* 13. SECURITY */}
              <section style={styles.section}>
                <h2 style={styles.h2}>13. Data Security</h2>
                <p style={styles.p}>We implement: HTTPS/TLS encryption for all data in transit, encrypted storage of sensitive tokens, role-based access controls, automated backup routines, and server-side security monitoring. In the event of a confirmed personal data breach, we will notify affected users and the relevant supervisory authority within the statutorily prescribed timelines.</p>
              </section>

              {/* 14. INTERNATIONAL TRANSFERS */}
              <section style={styles.section}>
                <h2 style={styles.h2}>14. International Data Transfers</h2>
                <p style={styles.p}>Some third-party providers (AI processing, cloud infrastructure) operate outside India. Cross-border transfers are conducted in accordance with DPDP Act provisions and, where GDPR applies, through standard contractual clauses or other lawful transfer mechanisms.</p>
              </section>

              {/* 15. CHILDREN */}
              <section style={styles.section}>
                <h2 style={styles.h2}>15. Children&apos;s Data</h2>
                <p style={styles.p}>GabbarInfo AI is intended for business use by adults (18+). We do not knowingly collect personal data from anyone under the age of 18. If you believe a minor has created an account, please contact us immediately and we will delete the data.</p>
              </section>

              {/* 16. CHANGES */}
              <section style={styles.section}>
                <h2 style={styles.h2}>16. Changes to This Policy</h2>
                <p style={styles.p}>We may update this Privacy Policy periodically. The &ldquo;Last Updated&rdquo; date at the top will reflect any changes. For material changes, we will notify you via email or a prominent platform notice. Continued use of GabbarInfo AI after the effective date constitutes acceptance of the updated policy.</p>
              </section>

              {/* 17. GRIEVANCE OFFICER */}
              <section style={{ ...styles.section, borderBottom: "none", marginBottom: 0, paddingBottom: 0 }}>
                <h2 style={styles.h2}>17. Grievance Officer &amp; Contact</h2>
                <div style={styles.alertCard}>
                  <div style={styles.alertTitle}>📋 Grievance / Privacy Officer</div>
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
  h3: { fontSize: "1rem", fontWeight: 700, color: "#f1f5f9", marginTop: 20, marginBottom: 10 },
  p: { fontSize: 14, color: "#94a3b8", lineHeight: 1.75, marginBottom: 12 },
  ul: { paddingLeft: 0, margin: "10px 0 14px 0", listStyle: "none" },
  li: { fontSize: 14, color: "#94a3b8", lineHeight: 1.65, marginBottom: 8, paddingLeft: 0, display: "flex", gap: 10, alignItems: "flex-start" },
  infoCard: { background: "rgba(15,23,42,0.7)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "18px 22px", margin: "14px 0" },
  appCard: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "12px 16px", minWidth: 190 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13.5, background: "rgba(15,23,42,0.5)", borderRadius: 10, overflow: "hidden", margin: "14px 0" },
  th: { background: "rgba(30,41,59,0.8)", color: "#38bdf8", padding: "11px 14px", textAlign: "left", fontWeight: 700, fontSize: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" },
  td: { padding: "10px 14px", color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 13 },
  link: { color: "#38bdf8", textDecoration: "underline", textUnderlineOffset: 3 },
  white: { color: "#ffffff" },
  footer: { borderTop: "1px solid rgba(255,255,255,0.07)", padding: "24px 32px", textAlign: "center" },
  footerText: { fontSize: 13, color: "#475569", marginBottom: 10 },
  footerLinks: { display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" },
  footerLink: { fontSize: 13, color: "#64748b", textDecoration: "none" },
};
